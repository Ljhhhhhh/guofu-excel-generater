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
    headerRow.value = existingBinding.headerRow ?? 1
    dataStartRow.value = existingBinding.dataStartRow ?? 2

    // 如果是header模式且有fieldMappings，回显表头名
    if (existingBinding.rangeMethod === 'header' && existingBinding.fieldMappings?.length) {
      headerName.value = existingBinding.fieldMappings[0].headerText
    } else {
      headerName.value = ''
    }
  } else {
    // 无配置，清空表单
    selectedDataSource.value = ''
    sheetName.value = ''
    rangeMethod.value = 'header'
    headerRow.value = 1
    dataStartRow.value = 2
    headerName.value = ''
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
