<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useContractStore } from '../../../stores/contract'
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

const contractStore = useContractStore()
const { contractDraft } = storeToRefs(contractStore)

const selectedDataSource = ref('')
const sheetName = ref('')
const rangeMethod = ref<'header' | 'fixed' | 'column'>('header')
const headerRow = ref<number>(1)
const dataStartRow = ref<number>(2)
const headerName = ref('')
const fixedRange = ref('')
const columnList = ref<string[]>([''])
const fixedRangeError = ref('')
const columnErrors = ref<string[]>([''])

// 回显：从已保存的binding中加载配置，如果不存在则清空
const loadExistingBinding = () => {
  if (!contractDraft.value) return

  const existingBinding = contractDraft.value.bindings.find(
    (b) => b.mark === props.mark && b.type === 'list'
  ) as ListBinding | undefined

  if (existingBinding) {
    // 有配置，回显
    selectedDataSource.value = existingBinding.dataSource
    sheetName.value = existingBinding.sheetName
    rangeMethod.value = existingBinding.rangeMethod

    // 根据不同模式回显不同的字段
    if (existingBinding.rangeMethod === 'header') {
      headerRow.value = existingBinding.headerRow ?? 1
      dataStartRow.value = existingBinding.dataStartRow ?? 2
      headerName.value = existingBinding.fieldMappings?.[0]?.headerText ?? ''
      // 清空其他模式的字段
      fixedRange.value = ''
      columnList.value = ['']
      fixedRangeError.value = ''
      columnErrors.value = ['']
    } else if (existingBinding.rangeMethod === 'fixed') {
      fixedRange.value = existingBinding.fixedRange ?? ''
      // 清空其他模式的字段
      headerRow.value = 1
      dataStartRow.value = 2
      headerName.value = ''
      columnList.value = ['']
      fixedRangeError.value = ''
      columnErrors.value = ['']
    } else if (existingBinding.rangeMethod === 'column') {
      columnList.value = existingBinding.columns && existingBinding.columns.length > 0
        ? [...existingBinding.columns]
        : ['']
      columnErrors.value = columnList.value.map(() => '')
      // 清空其他模式的字段
      headerRow.value = 1
      dataStartRow.value = 2
      headerName.value = ''
      fixedRange.value = ''
      fixedRangeError.value = ''
    }
  } else {
    // 无配置，清空表单
    selectedDataSource.value = ''
    sheetName.value = ''
    rangeMethod.value = 'header'
    headerRow.value = 1
    dataStartRow.value = 2
    headerName.value = ''
    fixedRange.value = ''
    columnList.value = ['']
    fixedRangeError.value = ''
    columnErrors.value = ['']
  }
}

// 组件挂载时加载
onMounted(() => {
  loadExistingBinding()
})

// 监听mark变化（用户切换不同的标记时）
watch(
  () => props.mark,
  () => {
    loadExistingBinding()
  }
)

const handleSave = () => {
  if (!selectedDataSource.value || !sheetName.value) {
    alert('请填写所有必填项')
    return
  }

  // 验证 header 模式
  if (rangeMethod.value === 'header') {
    if (!headerName.value.trim()) {
      alert('请填写表头名')
      return
    }
  }

  // 验证 fixed 模式
  if (rangeMethod.value === 'fixed') {
    if (!fixedRange.value.trim()) {
      alert('请填写固定范围')
      return
    }
    if (!validateFixedRange(fixedRange.value)) {
      alert('固定范围格式错误，请使用 A1:B10 格式')
      return
    }
  }

  // 验证 column 模式
  if (rangeMethod.value === 'column') {
    const validColumns = columnList.value.filter(c => c.trim())
    if (validColumns.length === 0) {
      alert('请至少填写一个列')
      return
    }
    // 验证所有列格式
    for (let i = 0; i < validColumns.length; i++) {
      if (!validateColumnName(validColumns[i])) {
        alert(`第 ${i + 1} 列格式错误，请使用 A:A 或 A 格式`)
        return
      }
    }
  }

  // 构造不同模式的 binding
  let binding: ListBinding

  if (rangeMethod.value === 'header') {
    const normalizedFieldName = deriveFieldName(props.mark)
    const normalizedHeaderName = headerName.value.trim()
    
    binding = {
      type: 'list',
      mark: props.mark,
      dataSource: selectedDataSource.value,
      sheetName: sheetName.value,
      rangeMethod: 'header',
      headerRow: headerRow.value,
      dataStartRow: dataStartRow.value,
      fieldMappings: [
        {
          fieldName: normalizedFieldName,
          headerText: normalizedHeaderName
        }
      ]
    }
  } else if (rangeMethod.value === 'fixed') {
    binding = {
      type: 'list',
      mark: props.mark,
      dataSource: selectedDataSource.value,
      sheetName: sheetName.value,
      rangeMethod: 'fixed',
      fixedRange: fixedRange.value.trim().toUpperCase()
    }
  } else {
    // column 模式
    const normalizedColumns = columnList.value
      .filter(c => c.trim())
      .map(c => {
        const col = c.trim().toUpperCase()
        // 标准化为 A:A 格式
        if (col.includes(':')) {
          return col
        } else {
          return `${col}:${col}`
        }
      })
    
    binding = {
      type: 'list',
      mark: props.mark,
      dataSource: selectedDataSource.value,
      sheetName: sheetName.value,
      rangeMethod: 'column',
      columns: normalizedColumns
    }
  }

  emit('save', binding)
  
  // 清空表单（可选）
  if (rangeMethod.value === 'header') {
    headerName.value = ''
  }
}

function deriveFieldName(mark: string): string {
  return mark
    .replace(/^d\./, '')
    .replace(/\[.*?\]/g, '')
    .trim()
}

// 格式校验：固定范围（A1:B10）
function validateFixedRange(range: string): boolean {
  if (!range.trim()) return false
  // 匹配格式：A1:B10 或 A1:C100
  const regex = /^[A-Z]+\d+:[A-Z]+\d+$/
  return regex.test(range.trim().toUpperCase())
}

// 格式校验：列名（A:A 或 A）
function validateColumnName(col: string): boolean {
  if (!col.trim()) return false
  const normalized = col.trim().toUpperCase()
  // 匹配 A:A 或 A 或 AB:AB 或 AB
  const regex = /^[A-Z]+(?::[A-Z]+)?$/
  return regex.test(normalized)
}

// 固定范围输入校验
const validateFixedRangeInput = () => {
  if (!fixedRange.value.trim()) {
    fixedRangeError.value = ''
    return
  }
  
  if (!validateFixedRange(fixedRange.value)) {
    fixedRangeError.value = '格式错误，请使用 A1:B10 格式'
  } else {
    fixedRangeError.value = ''
  }
}

// 列名输入校验
const validateColumnInput = (index: number) => {
  const col = columnList.value[index]
  if (!col.trim()) {
    columnErrors.value[index] = ''
    return
  }
  
  if (!validateColumnName(col)) {
    columnErrors.value[index] = '格式错误，请使用 A:A 或 A 格式'
  } else {
    columnErrors.value[index] = ''
  }
}

// 添加列
const addColumn = () => {
  columnList.value.push('')
  columnErrors.value.push('')
}

// 删除列
const removeColumn = (index: number) => {
  if (columnList.value.length > 1) {
    columnList.value.splice(index, 1)
    columnErrors.value.splice(index, 1)
  }
}
</script>

<template>
  <div class="space-y-6 text-gray-900">
    <div class="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">步骤提示</p>
      <p class="mt-1 text-sm text-slate-600">
        当前列表标记
        <code class="text-blue-600">{{ mark }}</code> 需要完成数据源、工作表与范围三步配置，所有带
        <span class="text-red-500">*</span> 的字段为必填。
      </p>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
        <li>数据源需与后台上传的数据集保持一致。</li>
        <li>表头模式会根据表头文本自动绑定字段，适合动态列表。</li>
        <li>固定 / 整列模式需自行控制 Excel 中的数据范围。</li>
      </ul>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="mb-2 flex items-center justify-between text-sm text-slate-500">
        <span>Step 02 · 列表区间配置</span>
        <span>填写完成后点击右下角保存</span>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- 左列：数据源 + 工作表 -->
        <div class="space-y-6">
          <div>
            <div class="flex items-center justify-between text-sm font-medium text-slate-700">
              <span>1. 选择数据源</span>
              <span class="text-xs text-red-500">必填</span>
            </div>
            <p class="mt-1 text-xs text-slate-500">根据模板所属业务选择已导入的数据源。</p>
            <select
              v-model="selectedDataSource"
              class="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">-- 请选择 --</option>
              <option v-for="ds in dataSources" :key="ds.id" :value="ds.id">
                {{ ds.name }}
              </option>
            </select>
          </div>

          <div class="space-y-2">
            <Input
              v-model="sheetName"
              label="2. 指定工作表名称"
              placeholder="例如：DataSheet"
              required
            />
            <p class="text-xs text-slate-500">请输入 Excel 中真实存在的 Sheet 名称。</p>
          </div>
        </div>

        <!-- 右列：范围方法 -->
        <div class="space-y-3">
          <div class="flex items-center justify-between text-sm font-medium text-slate-700">
            <span>3. 选择取值范围方式</span>
            <span class="text-xs text-red-500">必填</span>
          </div>
          <p class="text-xs text-slate-500">
            针对不同模板结构选择合适的方式，切换后下方配置会自动同步。
          </p>
          <div class="space-y-2">
            <label
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm transition hover:border-blue-400 hover:bg-blue-50/40"
            >
              <input
                v-model="rangeMethod"
                type="radio"
                value="header"
                class="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p class="font-medium text-slate-800">从表头行开始（推荐）</p>
                <p class="text-xs text-slate-500">
                  识别表头文字并自动匹配字段，适合动态列宽 / 可变数据。
                </p>
              </div>
            </label>
            <label
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm transition hover:border-blue-400 hover:bg-blue-50/40"
            >
              <input
                v-model="rangeMethod"
                type="radio"
                value="fixed"
                class="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p class="font-medium text-slate-800">固定范围</p>
                <p class="text-xs text-slate-500">
                  手动维护区间（如 A2:C50），适合结构稳定的明细表。
                </p>
              </div>
            </label>
            <label
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm shadow-sm transition hover:border-blue-400 hover:bg-blue-50/40"
            >
              <input
                v-model="rangeMethod"
                type="radio"
                value="column"
                class="mt-1 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p class="font-medium text-slate-800">整列</p>
                <p class="text-xs text-slate-500">
                  直接引用整列（如 A:A、C:C），适合单列维度收集。
                </p>
              </div>
            </label>
          </div>
        </div>

        <!-- 表头模式专属 -->
        <div
          v-if="rangeMethod === 'header'"
          class="lg:col-span-2 space-y-4 rounded-lg border border-blue-100 bg-blue-50/60 p-5 shadow-inner"
        >
          <p class="text-sm font-semibold text-blue-900">4. 表头模式参数</p>
          <p class="text-xs text-blue-900/80">
            系统会将 <code>{{ mark }}</code> 正规化为字段名并与下列输入的表头文本进行绑定。
          </p>

          <Input
            v-model.number="headerRow"
            label="(a) 表头所在行号"
            type="number"
            placeholder="例如：1"
            required
          />

          <div class="space-y-2">
            <label class="block text-sm font-medium text-blue-900">
              (b) 表头文本
              <span class="text-xs text-red-500">必填</span>
            </label>
            <p class="text-xs text-blue-900/70">请输入 Excel 中显示的原始表头，用于匹配正确列。</p>
            <Input v-model="headerName" placeholder="例如：姓名" required />
          </div>

          <Input
            v-model.number="dataStartRow"
            label="(c) 数据开始行"
            type="number"
            placeholder="例如：2"
            required
          />
        </div>

        <!-- 固定范围模式专属 -->
        <div
          v-if="rangeMethod === 'fixed'"
          class="lg:col-span-2 space-y-4 rounded-lg border border-green-100 bg-green-50/60 p-5 shadow-inner"
        >
          <p class="text-sm font-semibold text-green-900">4. 固定范围参数</p>
          <p class="text-xs text-green-900/80">
            指定固定的单元格区间，系统将读取该区域内的所有数据。
          </p>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-green-900">
              单元格范围
              <span class="text-xs text-red-500">必填</span>
            </label>
            <p class="text-xs text-green-900/70">
              使用 A1 表示法指定范围，例如：A2:C50 表示从 A2 到 C50 的矩形区域。
            </p>
            <Input
              v-model="fixedRange"
              placeholder="例如：A2:C50"
              required
              @blur="validateFixedRangeInput"
            />
            <p v-if="fixedRangeError" class="text-xs text-red-600">
              {{ fixedRangeError }}
            </p>
          </div>

          <div class="rounded-md bg-green-100/50 p-3 text-xs text-green-800">
            <p class="font-medium">格式要求：</p>
            <ul class="mt-1 list-disc space-y-1 pl-4">
              <li>起始单元格:结束单元格（如 A2:C50）</li>
              <li>列名使用大写字母（A-Z、AA-ZZ）</li>
              <li>行号为正整数</li>
            </ul>
          </div>
        </div>

        <!-- 整列模式专属 -->
        <div
          v-if="rangeMethod === 'column'"
          class="lg:col-span-2 space-y-4 rounded-lg border border-purple-100 bg-purple-50/60 p-5 shadow-inner"
        >
          <p class="text-sm font-semibold text-purple-900">4. 整列参数</p>
          <p class="text-xs text-purple-900/80">
            指定一个或多个完整列，系统将读取整列的数据。
          </p>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="block text-sm font-medium text-purple-900">
                列定义
                <span class="text-xs text-red-500">至少需要一列</span>
              </label>
              <Button
                variant="secondary"
                size="sm"
                @click="addColumn"
              >
                + 添加列
              </Button>
            </div>
            <p class="text-xs text-purple-900/70">
              输入列名（可带 :），例如：A:A 或 A 或 AB
            </p>

            <div
              v-for="(_, index) in columnList"
              :key="index"
              class="flex items-start gap-2"
            >
              <div class="flex-1 space-y-1">
                <Input
                  v-model="columnList[index]"
                  :placeholder="`例如：${index === 0 ? 'A:A' : 'B:B'}`"
                  required
                  @blur="validateColumnInput(index)"
                />
                <p v-if="columnErrors[index]" class="text-xs text-red-600">
                  {{ columnErrors[index] }}
                </p>
              </div>
              <Button
                v-if="columnList.length > 1"
                variant="secondary"
                size="sm"
                class="mt-1"
                @click="removeColumn(index)"
              >
                删除
              </Button>
            </div>
          </div>

          <div class="rounded-md bg-purple-100/50 p-3 text-xs text-purple-800">
            <p class="font-medium">格式要求：</p>
            <ul class="mt-1 list-disc space-y-1 pl-4">
              <li>单列名：A、B、C、AA、AB 等大写字母</li>
              <li>带完整引用：A:A、B:B、AB:AB 等</li>
              <li>系统会自动规范化列名格式</li>
            </ul>
          </div>
        </div>
      </div>

      <div
        class="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-sm text-slate-500">保存后可在右侧预览区查看最新映射效果。</p>
        <Button
          variant="primary"
          size="lg"
          class="w-full shadow-lg shadow-blue-200 transition sm:w-auto"
          @click="handleSave"
        >
          保存此项配置
        </Button>
      </div>
    </div>
  </div>
</template>
