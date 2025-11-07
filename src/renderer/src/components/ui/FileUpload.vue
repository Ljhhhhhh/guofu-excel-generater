<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  label?: string
  accept?: string
  multiple?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  accept: '.xlsx,.xls',
  multiple: false
})

const emit = defineEmits<{
  (e: 'upload', file: File | File[]): void
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFileName = ref<string>('')

const handleDragEnter = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    handleFiles(files)
  }
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    handleFiles(files)
  }
}

const handleFiles = (files: FileList) => {
  if (props.multiple) {
    selectedFileName.value = `已选择 ${files.length} 个文件`
    emit('upload', Array.from(files))
  } else {
    selectedFileName.value = files[0].name
    emit('upload', files[0])
  }
}

const triggerFileSelect = () => {
  fileInput.value?.click()
}
</script>

<template>
  <div class="w-full">
    <label v-if="label" class="block text-sm font-medium text-gray-700 mb-2">
      {{ label }}
    </label>
    <div
      class="relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 cursor-pointer"
      :class="{
        'border-blue-500 bg-blue-50': isDragging,
        'border-gray-300 hover:border-gray-400': !isDragging
      }"
      @dragenter="handleDragEnter"
      @dragover.prevent
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="triggerFileSelect"
    >
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        :accept="accept"
        :multiple="multiple"
        @change="handleFileSelect"
      />

      <div class="space-y-2">
        <svg
          class="mx-auto h-12 w-12 text-gray-400"
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
          <span class="font-medium text-blue-600 hover:text-blue-500">选择文件</span>
          或拖拽到此处
        </div>

        <p v-if="selectedFileName" class="text-sm text-gray-700 font-medium">
          {{ selectedFileName }}
        </p>

        <p class="text-xs text-gray-500">支持 Excel 文件 (.xlsx, .xls)</p>
      </div>
    </div>
  </div>
</template>
