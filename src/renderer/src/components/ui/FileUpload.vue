<script setup lang="ts">
import { ref } from 'vue'
import type { FileDialogFilter, SelectedFile } from '@shared/types/file'

interface Props {
  label?: string
  multiple?: boolean
  filters?: FileDialogFilter[]
  description?: string
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  filters: () => [],
  description: '支持 Excel 文件 (.xlsx, .xls)'
})

const emit = defineEmits<{
  (e: 'select', file: SelectedFile | SelectedFile[]): void
}>()

const selectedFiles = ref<SelectedFile[]>([])
const isOpening = ref(false)
const errorMessage = ref<string | null>(null)

const handlePick = async () => {
  if (!window.api?.dialogs?.openFile) {
    errorMessage.value = '主进程未暴露文件选择 API'
    return
  }
  isOpening.value = true
  try {
    const files = await window.api.dialogs.openFile({
      multiple: props.multiple,
      filters: props.filters
    })
    if (!files || files.length === 0) {
      return
    }
    selectedFiles.value = files
    emit('select', props.multiple ? files : files[0])
    errorMessage.value = null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isOpening.value = false
  }
}
</script>

<template>
  <div class="w-full">
    <label v-if="label" class="block text-sm font-medium text-gray-700 mb-2">
      {{ label }}
    </label>
    <button
      type="button"
      class="w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:border-gray-400"
      @click="handlePick"
    >
      <div class="space-y-3">
        <svg
          class="mx-auto h-10 w-10 text-gray-400"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <div class="text-sm text-gray-600">
          <span class="font-medium text-blue-600">
            {{ isOpening ? '正在打开文件对话框…' : '点击选择文件' }}
          </span>
        </div>
        <ul v-if="selectedFiles.length > 0" class="text-sm text-gray-700 space-y-1">
          <li v-for="file in selectedFiles" :key="file.path" class="font-medium">
            {{ file.name }}
          </li>
        </ul>
        <p v-else class="text-xs text-gray-500">
          {{ description }}
        </p>
      </div>
    </button>
    <p v-if="errorMessage" class="mt-2 text-sm text-red-600">{{ errorMessage }}</p>
  </div>
</template>
