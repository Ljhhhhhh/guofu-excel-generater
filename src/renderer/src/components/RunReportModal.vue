<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useContractStore } from '../stores/contract'
import Modal from './ui/Modal.vue'
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'
import FileUpload from './ui/FileUpload.vue'
import type { RuntimeParameterValue, RuntimeDataSourceFile } from '../types/contract'

interface Props {
  show: boolean
  contractId: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (
    e: 'generate',
    data: { parameters: RuntimeParameterValue[]; dataFiles: RuntimeDataSourceFile[] }
  ): void
}>()

const contractStore = useContractStore()

// 运行时参数值
const parameterValues = ref<RuntimeParameterValue[]>([])
// 数据源文件
const dataSourceFiles = ref<RuntimeDataSourceFile[]>([])

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
const canGenerate = computed(() => {
  return dataSourceFiles.value.every((df) => df.file !== null)
})

// 监听契约变化,初始化表单
watch(
  () => props.contractId,
  (newId) => {
    if (!newId || !contract.value) return

    // 初始化参数值
    parameterValues.value = parameters.value.map((p) => {
      if (p.type !== 'parameter') return { mark: '', value: '' }
      return {
        mark: p.mark,
        value: p.defaultValue || ''
      }
    })

    // 初始化数据源文件列表
    dataSourceFiles.value = contract.value.dataSources.map((ds) => ({
      dataSourceId: ds.id,
      dataSourceName: ds.name,
      file: null
    }))
  },
  { immediate: true }
)

const handleFileUpload = (dataSourceId: string, file: File) => {
  const dsFile = dataSourceFiles.value.find((df) => df.dataSourceId === dataSourceId)
  if (dsFile) {
    dsFile.file = file
  }
}

const handleGenerate = () => {
  if (!canGenerate.value) return

  emit('generate', {
    parameters: parameterValues.value,
    dataFiles: dataSourceFiles.value
  })
}

const handleClose = () => {
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
            @upload="(file) => handleFileUpload(dsFile.dataSourceId, file as File)"
          />
        </div>
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
