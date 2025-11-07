<script setup lang="ts">
import { ref } from 'vue'
import Card from '../ui/Card.vue'
import Button from '../ui/Button.vue'
import FileUpload from '../ui/FileUpload.vue'
import type { MarkItem } from '../../types/contract'

const emit = defineEmits<{
  (e: 'complete', templateFileName: string, templatePath: string, markItems: MarkItem[]): void
}>()

const uploadedFile = ref<File | null>(null)
const isProcessing = ref(false)

const handleFileUpload = (file: File | File[]) => {
  if (Array.isArray(file)) {
    uploadedFile.value = file[0]
  } else {
    uploadedFile.value = file
  }
}

const handleProceed = async () => {
  if (!uploadedFile.value) return

  isProcessing.value = true

  // 模拟解析模板
  // 实际实现: const result = await window.api.parseTemplate(uploadedFile.value.path)
  await new Promise((resolve) => setTimeout(resolve, 1500))

  // 模拟解析结果
  const mockMarkItems: MarkItem[] = [
    {
      mark: 'd.company_name',
      markType: 'single',
      configured: false,
      displayText: ''
    },
    {
      mark: 'd.users[]',
      markType: 'list',
      configured: false,
      displayText: ''
    },
    {
      mark: 'v.report_month',
      markType: 'parameter',
      configured: false,
      displayText: ''
    }
  ]

  isProcessing.value = false

  emit('complete', uploadedFile.value.name, '/path/to/template', mockMarkItems)
}
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <Card title="步骤 1：上传模板">
      <div class="space-y-6">
        <div class="prose prose-sm max-w-none">
          <p class="text-gray-600">
            请上传您的 Excel 报表模板文件。系统将自动解析模板中的所有 Carbone 标记（例如
            <code class="text-sm bg-gray-100 px-1 py-0.5 rounded"
              >{'{'}{{ '{' }} d.name {'}'}{{ '}' }}</code
            >、
            <code class="text-sm bg-gray-100 px-1 py-0.5 rounded"
              >{'{'}{{ '{' }} d.users[] {'}'}{{ '}' }}</code
            >、
            <code class="text-sm bg-gray-100 px-1 py-0.5 rounded"
              >{'{'}{{ '{' }} v.report_month {'}'}{{ '}' }}</code
            >
            ），并为您生成配置清单。
          </p>
        </div>

        <FileUpload label="选择模板文件" accept=".xlsx,.xls" @upload="handleFileUpload" />

        <div v-if="uploadedFile" class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-start">
            <svg
              class="w-5 h-5 text-green-600 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div class="ml-3">
              <h4 class="text-sm font-medium text-green-800">文件已上传</h4>
              <p class="text-sm text-green-700 mt-1">{{ uploadedFile.name }}</p>
            </div>
          </div>
        </div>

        <div v-if="isProcessing" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-center">
            <svg
              class="animate-spin h-5 w-5 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span class="ml-3 text-sm text-blue-800">正在解析模板，请稍候...</span>
          </div>
        </div>

        <div class="flex justify-end">
          <Button
            variant="primary"
            size="lg"
            :disabled="!uploadedFile || isProcessing"
            @click="handleProceed"
          >
            {{ isProcessing ? '解析中...' : '下一步：配置契约' }}
          </Button>
        </div>
      </div>
    </Card>
  </div>
</template>
