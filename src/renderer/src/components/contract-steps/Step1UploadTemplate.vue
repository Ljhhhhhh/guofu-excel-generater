<script setup lang="ts">
import { ref } from 'vue'
import Card from '../ui/Card.vue'
import Button from '../ui/Button.vue'
import FileUpload from '../ui/FileUpload.vue'
import type { MarkItem } from '@shared/types/contract'
import type { SelectedFile } from '@shared/types/file'

const emit = defineEmits<{
  (
    e: 'complete',
    templateFileName: string,
    templatePath: string,
    templateChecksum: string,
    markItems: MarkItem[]
  ): void
}>()

const uploadedFile = ref<SelectedFile | null>(null)
const isProcessing = ref(false)
const parseError = ref<string | null>(null)

const excelFilters = [{ name: 'Excel 模板', extensions: ['xlsx', 'xls'] }]

const handleFileUpload = (file: SelectedFile | SelectedFile[]) => {
  const selected = Array.isArray(file) ? file[0] : file
  if (!selected) return
  uploadedFile.value = selected
  parseError.value = null
}

const handleProceed = async () => {
  if (!uploadedFile.value) return

  if (!window.api?.templates?.parse || !window.api.templates.store) {
    parseError.value = '主进程未暴露模板存储或解析 API'
    return
  }

  isProcessing.value = true
  parseError.value = null
  try {
    const stored = await window.api.templates.store(uploadedFile.value.path)
    const result = await window.api.templates.parse(stored.storedPath)
    console.log(result, 'result')
    emit('complete', stored.fileName, stored.storedPath, stored.checksum, result.markItems)
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <Card title="步骤 1：上传模板">
      <div class="space-y-6">
        <div class="prose prose-sm max-w-none">
          <p class="text-gray-600">
            请上传您的 Excel 报表模板文件。系统将自动解析模板中的所有 Carbone 标记（例如
            <code class="text-sm bg-gray-100 px-1 py-0.5 rounded">{d.name}</code>、
            <code class="text-sm bg-gray-100 px-1 py-0.5 rounded">{d.users[]}</code>、
            <code class="text-sm bg-gray-100 px-1 py-0.5 rounded">{v.report_month}</code>
            ），并为您生成配置清单。
          </p>
        </div>

        <FileUpload label="选择模板文件" :filters="excelFilters" @select="handleFileUpload" />

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

        <div v-if="parseError" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-start">
            <svg
              class="w-5 h-5 text-red-600 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p class="ml-3 text-sm text-red-700">{{ parseError }}</p>
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
