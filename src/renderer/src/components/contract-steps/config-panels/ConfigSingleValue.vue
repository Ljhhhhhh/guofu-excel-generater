<script setup lang="ts">
import { ref } from 'vue'
import Input from '../../ui/Input.vue'
import Button from '../../ui/Button.vue'
import type { DataSource, SingleValueBinding } from '../../../types/contract'

interface Props {
  mark: string
  dataSources: DataSource[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', binding: SingleValueBinding): void
}>()

const selectedDataSource = ref('')
const sheetName = ref('')
const cellCoordinate = ref('')
const dataType = ref<'auto' | 'text' | 'number' | 'date'>('auto')

const handleSave = () => {
  if (!selectedDataSource.value || !sheetName.value || !cellCoordinate.value) {
    alert('请填写所有必填项')
    return
  }

  const binding: SingleValueBinding = {
    type: 'single',
    mark: props.mark,
    dataSource: selectedDataSource.value,
    sheetName: sheetName.value,
    cellCoordinate: cellCoordinate.value,
    dataType: dataType.value
  }

  emit('save', binding)
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-lg font-semibold text-gray-900">
      配置：<code class="text-blue-600">{{ mark }}</code> (单个值)
    </h3>

    <div class="space-y-4">
      <!-- 选择数据源 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          1. 选择数据源 <span class="text-red-500">*</span>
        </label>
        <select
          v-model="selectedDataSource"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- 请选择 --</option>
          <option v-for="ds in dataSources" :key="ds.id" :value="ds.name">
            {{ ds.name }}
          </option>
        </select>
      </div>

      <!-- 工作表名称 -->
      <Input
        v-model="sheetName"
        label="2. 选择工作表 (Sheet Name)"
        placeholder="例如: Sheet1"
        required
      />

      <!-- 单元格坐标 -->
      <Input
        v-model="cellCoordinate"
        label="3. 单元格坐标 (Cell Coordinate)"
        placeholder="例如: E5"
        required
      />

      <!-- 数据类型 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1"> 4. 数据类型 (可选) </label>
        <select
          v-model="dataType"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="auto">自动检测</option>
          <option value="text">文本</option>
          <option value="number">数字</option>
          <option value="date">日期</option>
        </select>
      </div>

      <div class="pt-4">
        <Button variant="primary" @click="handleSave"> 保存此项配置 </Button>
      </div>
    </div>
  </div>
</template>
