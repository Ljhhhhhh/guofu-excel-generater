import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ReportContract, DataSource, DataBinding, MarkItem } from '../types/contract'

export const useContractStore = defineStore('contract', () => {
  // 状态
  const contracts = ref<ReportContract[]>([
    // 模拟数据 - 实际使用时从 IPC 加载
    {
      id: '1',
      name: '每周销售报表',
      description: '每周销售数据汇总报表',
      templatePath: '/path/to/template1.xlsx',
      templateFileName: 'template1.xlsx',
      dataSources: [
        { id: 'ds1', name: '销售数据' },
        { id: 'ds2', name: '员工数据' }
      ],
      bindings: [
        {
          type: 'parameter',
          mark: 'v.report_month',
          displayLabel: '请输入统计月份：',
          dataType: 'text',
          defaultValue: '2025.11'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: '2',
      name: '季度 KPI 汇总',
      description: '季度关键绩效指标汇总',
      templatePath: '/path/to/template2.xlsx',
      templateFileName: 'template2.xlsx',
      dataSources: [{ id: 'ds3', name: 'KPI 数据' }],
      bindings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ])

  const currentContract = ref<ReportContract | null>(null)

  // 当前编辑的契约草稿
  const contractDraft = ref<{
    templateFileName: string
    templatePath: string
    dataSources: DataSource[]
    markItems: MarkItem[]
    bindings: DataBinding[]
  } | null>(null)

  // 计算属性
  const contractCount = computed(() => contracts.value.length)

  const getContractById = computed(() => {
    return (id: string) => contracts.value.find((c) => c.id === id)
  })

  // 动作
  function loadContracts() {
    // 实际实现: await window.api.loadContracts()
    // 模拟加载
    console.log('加载契约列表')
  }

  function createNewDraft(templateFileName: string, templatePath: string, markItems: MarkItem[]) {
    contractDraft.value = {
      templateFileName,
      templatePath,
      dataSources: [{ id: 'ds-default', name: 'Source 1' }],
      markItems,
      bindings: []
    }
  }

  function updateDraftBinding(binding: DataBinding) {
    if (!contractDraft.value) return

    const index = contractDraft.value.bindings.findIndex((b) => b.mark === binding.mark)
    if (index !== -1) {
      contractDraft.value.bindings[index] = binding
    } else {
      contractDraft.value.bindings.push(binding)
    }

    // 更新标记项状态
    const markItem = contractDraft.value.markItems.find((m) => m.mark === binding.mark)
    if (markItem) {
      markItem.configured = true
      markItem.displayText = getBindingDisplayText(binding)
    }
  }

  function addDataSource(name: string) {
    if (!contractDraft.value) return

    const newId = `ds-${Date.now()}`
    contractDraft.value.dataSources.push({ id: newId, name })
  }

  function renameDataSource(id: string, newName: string) {
    if (!contractDraft.value) return

    const ds = contractDraft.value.dataSources.find((d) => d.id === id)
    if (ds) {
      ds.name = newName
    }
  }

  function saveContract(contract: ReportContract) {
    const index = contracts.value.findIndex((c) => c.id === contract.id)
    if (index !== -1) {
      contracts.value[index] = contract
    } else {
      contracts.value.push(contract)
    }
    // 实际实现: await window.api.saveContract(contract)
  }

  function deleteContract(id: string) {
    const index = contracts.value.findIndex((c) => c.id === id)
    if (index !== -1) {
      contracts.value.splice(index, 1)
    }
    // 实际实现: await window.api.deleteContract(id)
  }

  function clearDraft() {
    contractDraft.value = null
  }

  // 辅助函数
  function getBindingDisplayText(binding: DataBinding): string {
    if (binding.type === 'single') {
      return `[${binding.dataSource}]!${binding.sheetName}!${binding.cellCoordinate}`
    } else if (binding.type === 'list') {
      return `[${binding.dataSource}]!${binding.sheetName}!(R${binding.headerRow}:...; R${binding.dataStartRow})`
    } else if (binding.type === 'parameter') {
      return `[参数：${binding.displayLabel}]`
    }
    return ''
  }

  return {
    // 状态
    contracts,
    currentContract,
    contractDraft,
    // 计算属性
    contractCount,
    getContractById,
    // 动作
    loadContracts,
    createNewDraft,
    updateDraftBinding,
    addDataSource,
    renameDataSource,
    saveContract,
    deleteContract,
    clearDraft
  }
})
