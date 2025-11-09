import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import type { ReportContract, DataSource, DataBinding, MarkItem } from '@shared/types/contract'

function createRandomId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

export const useContractStore = defineStore('contract', () => {
  // 状态
  const contracts = ref<ReportContract[]>([])
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

  const currentContract = ref<ReportContract | null>(null)

  // 当前编辑的契约草稿
  const contractDraft = ref<{
    templateFileName: string
    templatePath: string
    templateChecksum: string
    dataSources: DataSource[]
    markItems: MarkItem[]
    bindings: DataBinding[]
  } | null>(null)
  const draftContractId = ref<string | null>(null)
  const draftRuntimeScopeId = ref<string | null>(null)

  const isSaving = ref(false)
  const deletingContractIds = ref<string[]>([])

  // 计算属性
  const contractCount = computed(() => contracts.value.length)
  const isEditingDraft = computed(() => draftContractId.value !== null)

  const getContractById = computed(() => {
    return (id: string) => contracts.value.find((c) => c.id === id)
  })

  // 动作
  async function loadContracts(options: { force?: boolean } = {}) {
    if (!options.force && contracts.value.length > 0) return
    if (!window.api?.contracts) {
      console.warn('contracts API 未注册')
      return
    }

    isLoading.value = true
    loadError.value = null
    try {
      const list = await window.api.contracts.list()
      contracts.value = list
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : String(error)
      console.error('加载契约列表失败', error)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchContractById(id: string): Promise<ReportContract | null> {
    const cached = contracts.value.find((c) => c.id === id)
    if (cached) {
      currentContract.value = cached
      return cached
    }

    if (!window.api?.contracts) {
      console.warn('contracts API 未注册')
      return null
    }

    try {
      const contract = await window.api.contracts.get(id)
      if (contract) {
        currentContract.value = contract
        upsertLocalContract(contract)
      }
      return contract ?? null
    } catch (error) {
      console.error(`加载契约(${id})失败`, error)
      throw error
    }
  }

  function createNewDraft(
    templateFileName: string,
    templatePath: string,
    templateChecksum: string,
    markItems: MarkItem[]
  ) {
    const defaultDataSourceId = createRandomId('ds')
    draftRuntimeScopeId.value = createRandomId('draft')
    contractDraft.value = {
      templateFileName,
      templatePath,
      templateChecksum,
      dataSources: [{ id: defaultDataSourceId, name: 'Source 1' }],
      markItems,
      bindings: []
    }
    draftContractId.value = null
  }

  function loadDraftFromContract(contract: ReportContract) {
    const dataSources = contract.dataSources.map((ds) => ({ ...ds }))
    const bindings = cloneBindings(contract.bindings)
    const markItems = bindings.map<MarkItem>((binding) => ({
      mark: binding.mark,
      markType: binding.type,
      configured: true,
      displayText: getBindingDisplayText(binding, dataSources)
    }))

    contractDraft.value = {
      templateFileName: contract.templateFileName,
      templatePath: contract.templatePath,
      templateChecksum: contract.templateChecksum,
      dataSources,
      markItems,
      bindings
    }
    draftContractId.value = contract.id
    draftRuntimeScopeId.value = null
  }

  function updateDraftBinding(binding: DataBinding) {
    if (!contractDraft.value) return

    const index = contractDraft.value.bindings.findIndex((b) => b.mark === binding.mark)
    if (index !== -1) {
      contractDraft.value.bindings[index] = binding
    } else {
      contractDraft.value.bindings.push(binding)
    }

    refreshMarkDisplay(binding)
  }

  function addDataSource(name: string) {
    if (!contractDraft.value) return

    const newId = createRandomId('ds')
    contractDraft.value.dataSources.push({ id: newId, name })
  }

  function renameDataSource(id: string, newName: string) {
    if (!contractDraft.value) return

    const ds = contractDraft.value.dataSources.find((d) => d.id === id)
    if (ds) {
      ds.name = newName
      refreshAllMarkDisplays()
    }
  }

  async function saveContract(options: {
    name: string
    description?: string
  }): Promise<ReportContract> {
    if (!contractDraft.value) {
      throw new Error('当前没有正在编辑的契约草稿')
    }
    if (!window.api?.contracts?.create || !window.api.contracts.update) {
      throw new Error('contracts API 未注册')
    }

    const draft = toRaw(contractDraft.value)

    const dataSources = draft.dataSources.map((ds) => ({
      id: ds.id,
      name: ds.name
    }))

    const bindings = cloneBindings(draft.bindings)

    const payload = {
      name: options.name,
      description: options.description,
      templatePath: draft.templatePath,
      templateFileName: draft.templateFileName,
      templateChecksum: draft.templateChecksum,
      dataSources,
      bindings
    }

    const isUpdating = Boolean(draftContractId.value)
    const runtimeScopeBeforeSave = getRuntimeScope()

    isSaving.value = true
    try {
      let result: ReportContract
      if (draftContractId.value) {
        result = await window.api.contracts.update({
          id: draftContractId.value,
          ...payload
        })
      } else {
        result = await window.api.contracts.create(payload)
      }
      upsertLocalContract(result)
      draftContractId.value = result.id
      if (!isUpdating) {
        draftRuntimeScopeId.value = null
        if (runtimeScopeBeforeSave.scopeType === 'draft' && window.api?.runtime?.cleanupScope) {
          window.api.runtime.cleanupScope(runtimeScopeBeforeSave).catch((error) => {
            console.warn('清理草稿运行文件失败', error)
          })
        }
      }
      return result
    } catch (error) {
      console.error('保存契约失败', error)
      throw error
    } finally {
      isSaving.value = false
    }
  }

  async function deleteContract(id: string) {
    if (!window.api?.contracts?.delete) {
      throw new Error('contracts API 未注册')
    }

    if (!deletingContractIds.value.includes(id)) {
      deletingContractIds.value = [...deletingContractIds.value, id]
    }

    try {
      await window.api.contracts.delete(id)
      const index = contracts.value.findIndex((c) => c.id === id)
      if (index !== -1) {
        contracts.value.splice(index, 1)
      }
    } catch (error) {
      console.error('删除契约失败', error)
      throw error
    } finally {
      deletingContractIds.value = deletingContractIds.value.filter((existing) => existing !== id)
    }
  }

  function clearDraft() {
    contractDraft.value = null
    draftContractId.value = null
    draftRuntimeScopeId.value = null
  }

  function upsertLocalContract(contract: ReportContract) {
    const index = contracts.value.findIndex((c) => c.id === contract.id)
    if (index !== -1) {
      contracts.value[index] = contract
    } else {
      contracts.value.push(contract)
    }
  }

  // 辅助函数
  function getBindingDisplayText(binding: DataBinding, dataSourcesOverride?: DataSource[]): string {
    if (binding.type === 'single') {
      const dsName = resolveDataSourceName(binding.dataSource, dataSourcesOverride)
      return `[${dsName}]!${binding.sheetName}!${binding.cellCoordinate}`
    } else if (binding.type === 'list') {
      const dsName = resolveDataSourceName(binding.dataSource, dataSourcesOverride)
      return `[${dsName}]!${binding.sheetName}!(R${binding.headerRow}:...; R${binding.dataStartRow})`
    } else if (binding.type === 'parameter') {
      return `[参数：${binding.displayLabel}]`
    }
    return ''
  }

  function resolveDataSourceName(
    dataSourceId: string | undefined,
    dataSources?: DataSource[]
  ): string {
    if (!dataSourceId) return ''
    const sources = dataSources ?? contractDraft.value?.dataSources ?? []
    const found = sources.find((ds) => ds.id === dataSourceId)
    return found?.name ?? dataSourceId
  }

  function refreshMarkDisplay(binding: DataBinding) {
    if (!contractDraft.value) return
    const markItem = contractDraft.value.markItems.find((m) => m.mark === binding.mark)
    if (markItem) {
      markItem.configured = true
      markItem.displayText = getBindingDisplayText(binding)
    }
  }

  function refreshAllMarkDisplays() {
    if (!contractDraft.value) return
    contractDraft.value.bindings.forEach((binding) => refreshMarkDisplay(binding))
  }

  function cloneBinding(binding: DataBinding): DataBinding {
    if (binding.type === 'single' || binding.type === 'parameter') {
      return { ...binding }
    }
    return {
      ...binding,
      fieldMappings: binding.fieldMappings
        ? binding.fieldMappings.map((fm) => ({ ...fm }))
        : undefined,
      columns: binding.columns ? [...binding.columns] : undefined
    }
  }

  function cloneBindings(bindings: DataBinding[]): DataBinding[] {
    return bindings.map((binding) => cloneBinding(binding))
  }

  function isDeletingContract(id: string): boolean {
    return deletingContractIds.value.includes(id)
  }

  function getRuntimeScope(): { scopeId: string; scopeType: 'draft' | 'contract' } {
    if (draftContractId.value) {
      return {
        scopeId: draftContractId.value,
        scopeType: 'contract'
      }
    }
    if (!draftRuntimeScopeId.value) {
      draftRuntimeScopeId.value = createRandomId('draft')
    }
    return {
      scopeId: draftRuntimeScopeId.value,
      scopeType: 'draft'
    }
  }

  return {
    // 状态
    contracts,
    currentContract,
    contractDraft,
    draftContractId,
    isLoading,
    loadError,
    isSaving,
    // 计算属性
    contractCount,
    getContractById,
    isEditingDraft,
    // 动作
    loadContracts,
    fetchContractById,
    createNewDraft,
    loadDraftFromContract,
    updateDraftBinding,
    addDataSource,
    renameDataSource,
    saveContract,
    deleteContract,
    clearDraft,
    isDeletingContract,
    getRuntimeScope
  }
})
