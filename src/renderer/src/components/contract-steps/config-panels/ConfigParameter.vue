<script setup lang="ts">
import { ref } from 'vue'
import Input from '../../ui/Input.vue'
import Button from '../../ui/Button.vue'
import type { ParameterDefinition } from '../../../types/contract'

interface Props {
  mark: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', binding: ParameterDefinition): void
}>()

const displayLabel = ref('')
const dataType = ref<'text' | 'number' | 'date'>('text')
const defaultValue = ref('')

const handleSave = () => {
  if (!displayLabel.value) {
    alert('请填写显示标签')
    return
  }

  const binding: ParameterDefinition = {
    type: 'parameter',
    mark: props.mark,
    displayLabel: displayLabel.value,
    dataType: dataType.value,
    defaultValue: defaultValue.value || undefined
  }

  emit('save', binding)
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-lg font-semibold text-gray-900">
      配置：<code class="text-purple-600">{{ mark }}</code> (运行时参数)
    </h3>

    <div class="space-y-4">
      <!-- 显示标签 -->
      <Input
        v-model="displayLabel"
        label="1. 显示标签"
        placeholder="例如: 请输入统计月份："
        required
      >
        <template #help>
          <p class="text-xs text-gray-500 mt-1">提示：在"运行"时显示给用户的友好名称</p>
        </template>
      </Input>

      <!-- 数据类型 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          2. 数据类型 <span class="text-red-500">*</span>
        </label>
        <select
          v-model="dataType"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="text">文本</option>
          <option value="number">数字</option>
          <option value="date">日期</option>
        </select>
      </div>

      <!-- 默认值 -->
      <Input
        v-model="defaultValue"
        label="3. 默认值（可选）"
        :type="dataType === 'number' ? 'number' : dataType === 'date' ? 'date' : 'text'"
        placeholder="例如: 2025.11"
      />

      <div class="pt-4">
        <Button variant="primary" @click="handleSave"> 保存此项配置 </Button>
      </div>
    </div>
  </div>
</template>
