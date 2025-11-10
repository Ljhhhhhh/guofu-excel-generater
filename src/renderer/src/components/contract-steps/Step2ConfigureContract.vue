<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useContractStore } from '../../stores/contract'
import Card from '../ui/Card.vue'
import Button from '../ui/Button.vue'
import ConfigSingleValue from './config-panels/ConfigSingleValue.vue'
import ConfigList from './config-panels/ConfigList.vue'
import ConfigParameter from './config-panels/ConfigParameter.vue'
import type { MarkItem, DataBinding } from '@shared/types/contract'

interface Props {
  canProceed: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
}>()

const contractStore = useContractStore()
const { contractDraft: draft } = storeToRefs(contractStore)

const selectedMark = ref<MarkItem | null>(null)
const editingDataSourceId = ref<string | null>(null)
const newDataSourceName = ref('')
const selectedBinding = computed<DataBinding | null>(() => {
  if (!draft.value || !selectedMark.value) return null
  return draft.value.bindings.find((b) => b.mark === selectedMark.value?.mark) ?? null
})
const isSelectedMarkSkipped = computed(() => selectedBinding.value?.type === 'skip')
const canSkipSelectedMark = computed(
  () => selectedMark.value !== null && selectedMark.value.markType !== 'parameter'
)

// 数据标记
const dataMarks = computed(() => {
  if (!draft.value) return []
  return draft.value.markItems.filter((m) => m.markType === 'single' || m.markType === 'list')
})

// 参数标记
const parameterMarks = computed(() => {
  if (!draft.value) return []
  return draft.value.markItems.filter((m) => m.markType === 'parameter')
})

// 选择标记
const selectMark = (mark: MarkItem) => {
  selectedMark.value = mark
}

// 保存绑定
const handleSaveBinding = (binding: DataBinding) => {
  // 保存到内存中的 contractDraft
  contractStore.updateDraftBinding(binding)
  // 保存后清空选中的标记
  selectedMark.value = null
  // 可以添加成功提示
  console.log('保存绑定:', binding.mark)
}

// 添加数据源
const handleAddDataSource = () => {
  if (newDataSourceName.value.trim()) {
    contractStore.addDataSource(newDataSourceName.value.trim())
    newDataSourceName.value = ''
  }
}

// 开始编辑数据源
const startEditDataSource = (id: string) => {
  editingDataSourceId.value = id
  const ds = draft.value?.dataSources.find((d) => d.id === id)
  if (ds) {
    newDataSourceName.value = ds.name
  }
}

// 保存数据源名称
const saveDataSourceName = () => {
  if (editingDataSourceId.value && newDataSourceName.value.trim()) {
    contractStore.renameDataSource(editingDataSourceId.value, newDataSourceName.value.trim())
    editingDataSourceId.value = null
    newDataSourceName.value = ''
  }
}

// 取消编辑数据源
const cancelEditDataSource = () => {
  editingDataSourceId.value = null
  newDataSourceName.value = ''
}

const handleMarkAsSkipped = () => {
  if (!selectedMark.value || !canSkipSelectedMark.value) return
  const confirmed = confirm('确认该模板标记无需配置数据源吗？')
  if (!confirmed) return
  contractStore.markBindingAsSkipped(selectedMark.value.mark, selectedMark.value.markType)
}

const handleResumeConfiguration = () => {
  if (!selectedMark.value) return
  const confirmed = confirm('恢复为需要配置后需重新绑定数据源，确定继续吗？')
  if (!confirmed) return
  contractStore.removeDraftBinding(selectedMark.value.mark)
}
</script>

<template>
  <div v-if="draft" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- 左侧：待配置清单 -->
    <div class="lg:col-span-1">
      <Card title="待配置清单" :padding="false">
        <div class="p-4">
          <p class="text-sm text-gray-600 mb-4">数据标记和参数标记需要配置数据源。</p>

          <!-- 数据标记 -->
          <div v-if="dataMarks.length > 0" class="mb-6">
            <h4 class="text-sm font-semibold text-gray-700 mb-2">数据标记 (d.)</h4>
            <div class="space-y-2">
              <button
                v-for="mark in dataMarks"
                :key="mark.mark"
                :class="[
                  'w-full text-left px-3 py-2 rounded-md transition-colors',
                  'border',
                  selectedMark?.mark === mark.mark
                    ? 'border-blue-500 bg-blue-50'
                    : mark.configured
                      ? mark.resolutionType === 'skip'
                        ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                        : 'border-green-300 bg-green-50 hover:bg-green-100'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                ]"
                @click="selectMark(mark)"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <code class="text-sm font-mono text-gray-900">{{ mark.mark }}</code>
                    <p v-if="mark.configured" class="text-xs text-gray-600 mt-1">
                      {{ mark.displayText }}
                    </p>
                  </div>
                  <svg
                    v-if="mark.configured"
                    :class="[
                      'w-5 h-5 shrink-0 ml-2',
                      mark.resolutionType === 'skip' ? 'text-amber-600' : 'text-green-600'
                    ]"
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
                </div>
              </button>
            </div>
          </div>

          <!-- 参数标记 -->
          <div v-if="parameterMarks.length > 0">
            <h4 class="text-sm font-semibold text-gray-700 mb-2">参数标记 (v.)</h4>
            <div class="space-y-2">
              <button
                v-for="mark in parameterMarks"
                :key="mark.mark"
                :class="[
                  'w-full text-left px-3 py-2 rounded-md transition-colors',
                  'border',
                  selectedMark?.mark === mark.mark
                    ? 'border-blue-500 bg-blue-50'
                    : mark.configured
                      ? mark.resolutionType === 'skip'
                        ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                        : 'border-green-300 bg-green-50 hover:bg-green-100'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                ]"
                @click="selectMark(mark)"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <code class="text-sm font-mono text-gray-900">{{ mark.mark }}</code>
                    <p v-if="mark.configured" class="text-xs text-gray-600 mt-1">
                      {{ mark.displayText }}
                    </p>
                  </div>
                  <svg
                    v-if="mark.configured"
                    :class="[
                      'w-5 h-5 shrink-0 ml-2',
                      mark.resolutionType === 'skip' ? 'text-amber-600' : 'text-green-600'
                    ]"
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
                </div>
              </button>
            </div>
          </div>
        </div>
      </Card>

      <!-- 右侧：配置面板 -->
      <div class="mt-6 flex gap-3">
        <Button variant="outline" class="flex-1" @click="emit('prev')"> 上一步</Button>
        <Button variant="primary" class="flex-1" :disabled="!canProceed" @click="emit('next')">
          下一步
        </Button>
      </div>
    </div>

    <!-- 右侧：数据源管理 -->
    <div class="lg:col-span-2 space-y-6">
      <!-- 数据源管理 -->
      <Card title="数据源管理" :padding="false">
        <div class="p-4">
          <p class="text-sm text-gray-600 mb-4">声明此契约需要几个数据源。</p>

          <div class="space-y-2 mb-4">
            <div
              v-for="ds in draft.dataSources"
              :key="ds.id"
              class="flex items-center gap-2 p-2 border border-gray-200 rounded-md"
            >
              <div class="w-2 h-2 rounded-full bg-blue-600"></div>

              <input
                v-if="editingDataSourceId === ds.id"
                v-model="newDataSourceName"
                type="text"
                class="flex-1 px-2 py-1 border border-gray-300 rounded"
                @keyup.enter="saveDataSourceName"
                @keyup.esc="cancelEditDataSource"
              />
              <span v-else class="flex-1 text-sm font-medium text-gray-900">{{ ds.name }}</span>

              <button
                v-if="editingDataSourceId === ds.id"
                class="text-green-600 hover:text-green-700 text-sm"
                @click="saveDataSourceName"
              >
                保存
              </button>
              <button
                v-if="editingDataSourceId === ds.id"
                class="text-gray-600 hover:text-gray-700 text-sm"
                @click="cancelEditDataSource"
              >
                取消
              </button>
              <button
                v-else
                class="text-blue-600 hover:text-blue-700 text-sm"
                @click="startEditDataSource(ds.id)"
              >
                重命名
              </button>
            </div>
          </div>

          <div class="flex gap-2">
            <input
              v-model="newDataSourceName"
              type="text"
              placeholder="数据源名称"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              @keyup.enter="handleAddDataSource"
            />
            <Button variant="primary" @click="handleAddDataSource"> 添加数据源</Button>
          </div>
        </div>
      </Card>

      <!-- 右侧区域 B：配置面板 -->
      <Card title="配置面板" :padding="false">
        <div class="p-4">
          <!-- 未选择标记时的提示 -->
          <div v-if="!selectedMark" class="text-center py-12">
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p class="mt-2 text-sm text-gray-600">请选择一个数据标记进行配置。</p>
          </div>

          <div
            v-if="selectedMark && canSkipSelectedMark"
            class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4"
          >
            <p class="text-sm text-amber-800">
              这是一个 Carbone 数据标记，无需配置数据源，直接使用数据源进行计算。
            </p>
            <p
              v-if="
                isSelectedMarkSkipped && selectedBinding?.type === 'skip' && selectedBinding.reason
              "
              class="mt-2 rounded bg-white/70 px-3 py-2 text-xs text-amber-700"
            >
              当前标记：{{ selectedBinding.mark }}，无需配置数据源，直接使用数据源进行计算。
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <Button
                v-if="isSelectedMarkSkipped"
                variant="outline"
                class="border-amber-400 text-amber-700 hover:bg-white"
                @click="handleResumeConfiguration"
              >
                恢复为需要配置
              </Button>
              <Button
                v-else
                variant="secondary"
                class="border-amber-500 bg-amber-100 text-amber-800 hover:bg-amber-200"
                @click="handleMarkAsSkipped"
              >
                标记为无需配置
              </Button>
            </div>
          </div>

          <div
            v-if="selectedMark && isSelectedMarkSkipped"
            class="rounded-lg border border-dashed border-amber-200 bg-amber-50 py-10 text-center text-sm text-amber-700"
          >
            当前标记：{{ selectedBinding?.mark }}，无需配置数据源，直接使用数据源进行计算。
          </div>

          <!-- 配置单值数据 -->
          <ConfigSingleValue
            v-if="selectedMark && !isSelectedMarkSkipped && selectedMark.markType === 'single'"
            :mark="selectedMark.mark"
            :data-sources="draft.dataSources"
            @save="handleSaveBinding"
          />

          <!-- 配置列表数据 -->
          <ConfigList
            v-if="selectedMark && !isSelectedMarkSkipped && selectedMark.markType === 'list'"
            :mark="selectedMark.mark"
            :data-sources="draft.dataSources"
            @save="handleSaveBinding"
          />

          <!-- 配置参数 -->
          <ConfigParameter
            v-if="selectedMark && selectedMark.markType === 'parameter'"
            :mark="selectedMark.mark"
            @save="handleSaveBinding"
          />
        </div>
      </Card>
    </div>
  </div>
</template>
