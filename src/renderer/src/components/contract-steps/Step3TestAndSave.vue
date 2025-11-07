<script setup lang="ts">
import { ref, computed } from 'vue'
import { useContractStore } from '../../stores/contract'
import Card from '../ui/Card.vue'
import Button from '../ui/Button.vue'
import Input from '../ui/Input.vue'
import FileUpload from '../ui/FileUpload.vue'
import type { RuntimeParameterValue, RuntimeDataSourceFile } from '../../types/contract'

const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'complete', contractName: string, description?: string): void
}>()

const contractStore = useContractStore()

const contractName = ref('')
const contractDescription = ref('')

const draft = computed(() => contractStore.contractDraft)

// 参数定义
const parameters = computed(() => {
  return draft.value?.bindings.filter(b => b.type === 'parameter') || []
})

// 运行时参数值
const parameterValues = ref<RuntimeParameterValue[]>(
  parameters.value.map(p => {
    if (p.type !== 'parameter') return { mark: '', value: '' }
    return {
      mark: p.mark,
      value: p.defaultValue || ''
    }
  })
)

// 数据源文件
const dataSourceFiles = ref<RuntimeDataSourceFile[]>(
  draft.value?.dataSources.map(ds => ({
    dataSourceId: ds.id,
    dataSourceName: ds.name,
    file: null
  })) || []
)

// 是否可以运行测试
const canRunTest = computed(() => {
  return dataSourceFiles.value.every(df => df.file !== null)
})

const isTestRunning = ref(false)
const testResult = ref<'idle' | 'success' | 'error'>('idle')
const testErrorMessage = ref('')

// 运行测试
const handleRunTest = async () => {
  if (!canRunTest.value) return

  isTestRunning.value = true
  testResult.value = 'idle'

  // 模拟测试执行
  // 实际实现: const result = await window.api.testContract(...)
  await new Promise(resolve => setTimeout(resolve, 2000))

  // 模拟成功
  isTestRunning.value = false
  testResult.value = 'success'
}

// 文件上传处理
const handleFileUpload = (dataSourceId: string, file: File) => {
  const dsFile = dataSourceFiles.value.find(df => df.dataSourceId === dataSourceId)
  if (dsFile) {
    dsFile.file = file
  }
}

// 保存契约
const handleSave = () => {
  if (!contractName.value.trim()) {
    alert('请输入契约名称')
    return
  }

  if (testResult.value !== 'success') {
    if (!confirm('您还没有运行测试，确定要保存吗？')) {
      return
    }
  }

  emit('complete', contractName.value.trim(), contractDescription.value.trim())
}
</script>

<template>
  <div v-if="draft" class="max-w-5xl mx-auto space-y-6">
    <!-- 测试区域 -->
    <Card title="测试报表生成">
      <div class="space-y-6">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-sm text-blue-800">
            在保存之前，建议先运行测试以确保所有配置正确无误。
            系统会模拟"运行报表"的场景。
          </p>
        </div>

        <!-- 参数输入 -->
        <div v-if="parameters.length > 0" class="space-y-4">
          <div class="border-b border-gray-200 pb-2">
            <h4 class="text-lg font-semibold text-gray-900">1. 参数输入</h4>
          </div>
          
          <div
            v-for="(param, index) in parameters"
            :key="param.mark"
            class="space-y-2"
          >
            <Input
              v-if="param.type === 'parameter'"
              v-model="parameterValues[index].value"
              :label="param.displayLabel"
              :type="param.dataType === 'number' ? 'number' : param.dataType === 'date' ? 'date' : 'text'"
              :placeholder="param.defaultValue ? `默认值: ${param.defaultValue}` : ''"
            />
          </div>
        </div>

        <!-- 数据源文件上传 -->
        <div v-if="dataSourceFiles.length > 0" class="space-y-4">
          <div class="border-b border-gray-200 pb-2">
            <h4 class="text-lg font-semibold text-gray-900">
              {{ parameters.length > 0 ? '2. ' : '1. ' }}数据源文件
            </h4>
          </div>

          <div
            v-for="dsFile in dataSourceFiles"
            :key="dsFile.dataSourceId"
            class="space-y-2"
          >
            <FileUpload
              :label="dsFile.dataSourceName"
              @upload="(file) => handleFileUpload(dsFile.dataSourceId, file as File)"
            />
          </div>
        </div>

        <!-- 运行测试按钮 -->
        <div class="flex items-center gap-4">
          <Button
            variant="primary"
            size="lg"
            :disabled="!canRunTest || isTestRunning"
            @click="handleRunTest"
          >
            {{ isTestRunning ? '正在测试...' : '运行测试' }}
          </Button>

          <!-- 测试结果提示 -->
          <div v-if="testResult === 'success'" class="flex items-center text-green-600">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-sm font-medium">测试成功！所有配置正确。</span>
          </div>

          <div v-if="testResult === 'error'" class="flex items-center text-red-600">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-sm font-medium">测试失败</span>
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="testResult === 'error'" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-sm text-red-800">{{ testErrorMessage }}</p>
        </div>

        <!-- 测试成功预览 -->
        <div v-if="testResult === 'success'" class="bg-green-50 border border-green-200 rounded-lg p-4">
          <p class="text-sm text-green-800 mb-2 font-medium">预览结果：</p>
          <div class="bg-white rounded border border-green-300 p-4">
            <p class="text-sm text-gray-600">
              报表生成成功！（这里会显示生成的报表预览）
            </p>
          </div>
        </div>
      </div>
    </Card>

    <!-- 保存契约 -->
    <Card title="保存报表契约">
      <div class="space-y-4">
        <Input
          v-model="contractName"
          label="契约名称"
          placeholder="例如: 每周销售报表"
          required
        />

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            契约描述（可选）
          </label>
          <textarea
            v-model="contractDescription"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="简要描述此报表的用途..."
          />
        </div>

        <div class="flex justify-between pt-4">
          <Button variant="outline" @click="emit('prev')">
            上一步
          </Button>
          <Button
            variant="primary"
            size="lg"
            @click="handleSave"
          >
            保存报表契约
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>

