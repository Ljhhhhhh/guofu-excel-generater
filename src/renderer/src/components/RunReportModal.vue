<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useContractStore } from '../stores/contract'
import Modal from './ui/Modal.vue'
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'
import FileUpload from './ui/FileUpload.vue'
import type { RuntimeParameterValue, RuntimeDataSourceFile } from '@shared/types/contract'
import type { RuntimeSession } from '@shared/types/runtime'
import type { SelectedFile } from '@shared/types/file'

interface Props {
  show: boolean
  contractId: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (
    e: 'generate',
    data: {
      parameters: RuntimeParameterValue[]
      dataFiles: RuntimeDataSourceFile[]
      runtimeSession: RuntimeSession | null
    }
  ): void
}>()

const contractStore = useContractStore()

// 运行时参数值
const parameterValues = ref<RuntimeParameterValue[]>([])
const dataSourceFiles = ref<RuntimeDataSourceFile[]>([])
const runtimeSession = ref<RuntimeSession | null>(null)
const runtimeError = ref<string | null>(null)
const excelFilters = [{ name: 'Excel 文件', extensions: ['xlsx', 'xls'] }]

const resetDataSourceFiles = () => {
  if (!contract.value) {
    dataSourceFiles.value = []
    return
  }
  const currentMap = new Map(dataSourceFiles.value.map((item) => [item.dataSourceId, item]))
  dataSourceFiles.value = contract.value.dataSources.map((ds) => {
    const existing = currentMap.get(ds.id)
    return (
      existing ?? {
        dataSourceId: ds.id,
        dataSourceName: ds.name,
        uploaded: false
      }
    )
  })
}

// 当前契约
const contract = computed(() => {
  if (!props.contractId) return null
  const getContract = contractStore.getContractById
  return getContract(props.contractId)
})

// 契约中的参数定义
const parameters = computed(() => {
  if (!contract.value) return []
  return contract.value.bindings.filter((b) => b.type === 'parameter')
})

// 是否有参数
const hasParameters = computed(() => parameters.value.length > 0)

// 是否可以生成报表 (所有数据源文件都已上传)
const canGenerate = computed(() => dataSourceFiles.value.every((df) => df.uploaded))

const disposeRuntimeSession = async () => {
  if (!runtimeSession.value || !window.api?.runtime?.cleanupSession) {
    runtimeSession.value = null
    return
  }
  try {
    await window.api.runtime.cleanupSession(runtimeSession.value)
  } catch (error) {
    console.warn('清理运行会话失败', error)
  } finally {
    runtimeSession.value = null
  }
}
// 监听契约变化,初始化表单
watch(
  () => props.contractId,
  async (newId, oldId) => {
    if (newId !== oldId) {
      await disposeRuntimeSession()
    }
    if (!newId || !contract.value) return
    parameterValues.value = parameters.value.map((p) => {
      if (p.type !== 'parameter') return { mark: '', value: '' }
      return {
        mark: p.mark,
        value: p.defaultValue || ''
      }
    })
    resetDataSourceFiles()
    if (props.show) {
      await ensureRuntimeSession()
    }
  },
  { immediate: true }
)

watch(
  () => contract.value?.dataSources.map((ds) => ({ id: ds.id, name: ds.name })),
  () => {
    resetDataSourceFiles()
  },
  { deep: true }
)

watch(
  () => props.show,
  async (show) => {
    if (show) {
      await ensureRuntimeSession()
    } else {
      await disposeRuntimeSession()
    }
  }
)

const ensureRuntimeSession = async () => {
  if (!props.contractId) return null
  if (!window.api?.runtime?.createSession) {
    runtimeError.value = '主进程未暴露 runtime API'
    return null
  }
  try {
    const session = await window.api.runtime.createSession({
      scopeId: props.contractId,
      scopeType: 'contract',
      sessionType: 'run'
    })
    runtimeSession.value = session
    runtimeError.value = null
    return session
  } catch (error) {
    runtimeError.value = error instanceof Error ? error.message : String(error)
    return null
  }
}

onBeforeUnmount(() => {
  void disposeRuntimeSession()
})

const handleFileUpload = async (dataSourceId: string, file: SelectedFile | SelectedFile[]) => {
  const dsFile = dataSourceFiles.value.find((df) => df.dataSourceId === dataSourceId)
  if (!dsFile) return
  const selected = Array.isArray(file) ? file[0] : file
  if (!selected) return
  const session = runtimeSession.value ?? (await ensureRuntimeSession())
  if (!session) return
  if (!window.api?.runtime?.storeDataSourceFile) {
    runtimeError.value = '主进程未暴露 runtime 存储 API'
    return
  }
  try {
    const stored = await window.api.runtime.storeDataSourceFile({
      scopeId: session.scopeId,
      scopeType: session.scopeType,
      sessionType: session.sessionType,
      sessionId: session.sessionId,
      dataSourceId,
      sourcePath: selected.path
    })
    dsFile.uploaded = true
    dsFile.fileName = stored.fileName
    dsFile.checksum = stored.checksum
  } catch (error) {
    runtimeError.value = error instanceof Error ? error.message : String(error)
  }
}

const handleGenerate = () => {
  if (!canGenerate.value) return

  emit('generate', {
    parameters: parameterValues.value,
    dataFiles: dataSourceFiles.value,
    runtimeSession: runtimeSession.value
  })
}

const handleClose = () => {
  void disposeRuntimeSession()
  emit('close')
}
</script>

<template>
  <Modal :show="show" :title="`运行：${contract?.name || ''}`" size="lg" @close="handleClose">
    <div v-if="contract" class="space-y-6">
      <!-- 说明 -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p class="text-sm text-blue-800">
          <span v-if="hasParameters && contract.dataSources.length > 0">
            此报表需要 {{ parameters.length }} 个参数和 {{ contract.dataSources.length }} 个数据源。
          </span>
          <span v-else-if="hasParameters"> 此报表需要 {{ parameters.length }} 个参数。 </span>
          <span v-else-if="contract.dataSources.length > 0">
            此报表需要 {{ contract.dataSources.length }} 个数据源文件。请上传最新数据。
          </span>
        </p>
      </div>

      <!-- 参数输入区 (如果有参数) -->
      <div v-if="hasParameters" class="space-y-4">
        <div class="border-b border-gray-200 pb-2">
          <h4 class="text-lg font-semibold text-gray-900">1. 参数输入</h4>
        </div>

        <div v-for="(param, index) in parameters" :key="param.mark" class="space-y-2">
          <Input
            v-if="param.type === 'parameter'"
            v-model="parameterValues[index].value"
            :label="param.displayLabel"
            :type="
              param.dataType === 'number' ? 'number' : param.dataType === 'date' ? 'date' : 'text'
            "
            :placeholder="param.defaultValue ? `默认值: ${param.defaultValue}` : ''"
          />
        </div>
      </div>

      <!-- 数据源文件上传区 -->
      <div v-if="contract.dataSources.length > 0" class="space-y-4">
        <div class="border-b border-gray-200 pb-2">
          <h4 class="text-lg font-semibold text-gray-900">
            {{ hasParameters ? '2. ' : '1. ' }}数据源文件
          </h4>
        </div>

        <div v-for="dsFile in dataSourceFiles" :key="dsFile.dataSourceId" class="space-y-2">
          <FileUpload
            :label="dsFile.dataSourceName"
            :filters="excelFilters"
            @select="(file) => handleFileUpload(dsFile.dataSourceId, file)"
          />
          <p v-if="dsFile.uploaded" class="text-xs text-green-600">已上传：{{ dsFile.fileName }}</p>
        </div>
      </div>

      <div v-if="runtimeError" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-sm text-red-800">{{ runtimeError }}</p>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <Button variant="outline" @click="handleClose">取消</Button>
        <Button variant="primary" :disabled="!canGenerate" @click="handleGenerate">
          生成报表
        </Button>
      </div>
    </template>
  </Modal>
</template>
