<script setup lang="ts">
import { ref } from 'vue'
import Input from '../../ui/Input.vue'
import Button from '../../ui/Button.vue'
import type { DataSource, ListBinding } from '@shared/types/contract'

interface Props {
  mark: string
  dataSources: DataSource[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', binding: ListBinding): void
}>()

const selectedDataSource = ref('')
const sheetName = ref('')
const rangeMethod = ref<'header' | 'fixed' | 'column'>('header')
const headerRow = ref<number>(1)
const dataStartRow = ref<number>(2)
const headerName = ref('')

const handleSave = () => {
  if (!selectedDataSource.value || !sheetName.value) {
    alert('请填写所有必填项')
    return
  }

  if (rangeMethod.value === 'header' && !headerName.value.trim()) {
    alert('请填写表头名')
    return
  }

  const normalizedFieldName = deriveFieldName(props.mark)
  const normalizedHeaderName = headerName.value.trim()
  const normalizedMappings =
    rangeMethod.value === 'header'
      ? [
          {
            fieldName: normalizedFieldName,
            headerText: normalizedHeaderName
          }
        ]
      : undefined

  const binding: ListBinding = {
    type: 'list',
    mark: props.mark,
    dataSource: selectedDataSource.value,
    sheetName: sheetName.value,
    rangeMethod: rangeMethod.value,
    headerRow: headerRow.value,
    dataStartRow: dataStartRow.value,
    fieldMappings: normalizedMappings
  }

  emit('save', binding)
  headerName.value = ''
}

function deriveFieldName(mark: string): string {
  return mark
    .replace(/^d\./, '')
    .replace(/\[.*?\]/g, '')
    .trim()
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-lg font-semibold text-gray-900">
      配置：<code class="text-blue-600">{{ mark }}</code> (列表)
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
          <option v-for="ds in dataSources" :key="ds.id" :value="ds.id">
            {{ ds.name }}
          </option>
        </select>
      </div>

      <!-- 工作表名称 -->
      <Input v-model="sheetName" label="2. 选择工作表" placeholder="例如: DataSheet" required />

      <!-- 指定数据范围方法 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          3. 指定数据范围方法 <span class="text-red-500">*</span>
        </label>
        <div class="space-y-2">
          <label class="flex items-center">
            <input v-model="rangeMethod" type="radio" value="header" class="mr-2" />
            <span class="text-sm">从表头行开始 (推荐)</span>
          </label>
          <label class="flex items-center">
            <input v-model="rangeMethod" type="radio" value="fixed" class="mr-2" />
            <span class="text-sm">固定范围 (例如 A2:C50)</span>
          </label>
          <label class="flex items-center">
            <input v-model="rangeMethod" type="radio" value="column" class="mr-2" />
            <span class="text-sm">整列 (例如 A:A, C:C)</span>
          </label>
        </div>
      </div>

      <!-- 从表头行开始的配置 -->
      <div v-if="rangeMethod === 'header'" class="space-y-4 pl-4 border-l-2 border-blue-200">
        <div class="text-sm font-medium text-gray-700">4. 定义绑定 (从表头行开始)</div>

        <!-- 表头行号 -->
        <Input
          v-model.number="headerRow"
          label="(a) 指定表头行号 (Header Row)"
          type="number"
          placeholder="例如: 1"
          required
        />

        <!-- 字段映射 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"> (b) 表头名 </label>
          <p class="text-xs text-gray-600 mb-3">
            当前标记 <code>{{ mark }}</code> 将匹配此表头所在的列，请输入 Excel 中的表头文本。
          </p>
          <Input v-model="headerName" placeholder="例如: 姓名" required />
        </div>

        <!-- 数据起始行 -->
        <Input
          v-model.number="dataStartRow"
          label="(c) 明确数据区域 (Data Start Row)"
          type="number"
          placeholder="例如: 2"
          required
        />
      </div>

      <div class="pt-4">
        <Button variant="primary" @click="handleSave"> 保存此项配置 </Button>
      </div>
    </div>
  </div>
</template>
