<script setup lang="ts">
import { ref, computed } from 'vue'
import Input from '../../ui/Input.vue'
import Button from '../../ui/Button.vue'
import type { DataSource, ListBinding, FieldMapping } from '../../../types/contract'

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

// 模拟从标记解析出的字段
const mockFields = computed(() => {
  // 实际实现: 从 mark 中解析 item.xxx
  if (props.mark.includes('users')) {
    return ['item.name', 'item.email']
  }
  return []
})

// 字段映射
const fieldMappings = ref<FieldMapping[]>(
  mockFields.value.map((field) => ({
    fieldName: field,
    headerText: ''
  }))
)

const handleSave = () => {
  if (!selectedDataSource.value || !sheetName.value) {
    alert('请填写所有必填项')
    return
  }

  if (rangeMethod.value === 'header' && fieldMappings.value.some((fm) => !fm.headerText)) {
    alert('请填写所有字段映射')
    return
  }

  const binding: ListBinding = {
    type: 'list',
    mark: props.mark,
    dataSource: selectedDataSource.value,
    sheetName: sheetName.value,
    rangeMethod: rangeMethod.value,
    headerRow: headerRow.value,
    dataStartRow: dataStartRow.value,
    fieldMappings: fieldMappings.value
  }

  emit('save', binding)
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
          <option v-for="ds in dataSources" :key="ds.id" :value="ds.name">
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
          <label class="block text-sm font-medium text-gray-700 mb-2">
            (b) 绑定字段与"列名（表头文本）"
          </label>
          <p class="text-xs text-gray-600 mb-3">
            模板 <code>{{ mark }}</code> 包含以下字段 (自动解析):
          </p>

          <div class="space-y-3">
            <div
              v-for="(fm, index) in fieldMappings"
              :key="fm.fieldName"
              class="grid grid-cols-2 gap-3"
            >
              <div class="text-sm font-mono text-gray-600 py-2">
                {{ fm.fieldName }}
              </div>
              <Input v-model="fieldMappings[index].headerText" placeholder="例如: 姓名" required />
            </div>
          </div>
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
