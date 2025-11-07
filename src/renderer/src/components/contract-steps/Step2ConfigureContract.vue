<script setup lang="ts">
import { ref, computed } from 'vue'
import { useContractStore } from '../../stores/contract'
import Card from '../ui/Card.vue'
import Button from '../ui/Button.vue'
import ConfigSingleValue from './config-panels/ConfigSingleValue.vue'
import ConfigList from './config-panels/ConfigList.vue'
import ConfigParameter from './config-panels/ConfigParameter.vue'
import type { MarkItem, DataBinding } from '../../types/contract'

interface Props {
  canProceed: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
}>()

const contractStore = useContractStore()

const selectedMark = ref<MarkItem | null>(null)
const editingDataSourceId = ref<string | null>(null)
const newDataSourceName = ref('')

const draft = computed(() => contractStore.contractDraft)

// 数据标记列表
const dataMarks = computed(() => {
  return draft.value?.markItems.filter(m => m.markType === 'single' || m.markType === 'list') || []
})

// 参数标记列表
const parameterMarks = computed(() => {
  return draft.value?.markItems.filter(m => m.markType === 'parameter') || []
})

// 选择标记
const selectMark = (mark: MarkItem) => {
  selectedMark.value = mark
}

// 保存配置
const handleSaveBinding = (binding: DataBinding) => {
  contractStore.updateDraftBinding(binding)
  // 保存后清除选择,显示提示
  selectedMark.value = null
}

// 添加数据源
const handleAddDataSource = () => {
  if (newDataSourceName.value.trim()) {
    contractStore.addDataSource(newDataSourceName.value.trim())
    newDataSourceName.value = ''
  }
}

// 开始编辑数据源名称
const startEditDataSource = (id: string) => {
  editingDataSourceId.value = id
  const ds = draft.value?.dataSources.find(d => d.id === id)
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

// 取消编辑
const cancelEditDataSource = () => {
  editingDataSourceId.value = null
  newDataSourceName.value = ''
}
</script>

<template>
  <div v-if="draft" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- 左侧：待配置清单 -->
    <div class="lg:col-span-1">
      <Card title="待配置清单" :padding="false">
        <div class="p-4">
          <p class="text-sm text-gray-600 mb-4">
            模板中的所有标记都在这里，请逐项完成配置。
          </p>

          <!-- 数据标记 -->
          <div v-if="dataMarks.length > 0" class="mb-6">
            <h4 class="text-sm font-semibold text-gray-700 mb-2">数据标记 (d.)</h4>
            <div class="space-y-2">
              <button
                v-for="mark in dataMarks"
                :key="mark.mark"
                @click="selectMark(mark)"
                :class="[
                  'w-full text-left px-3 py-2 rounded-md transition-colors',
                  'border',
                  selectedMark?.mark === mark.mark
                    ? 'border-blue-500 bg-blue-50'
                    : mark.configured
                    ? 'border-green-300 bg-green-50 hover:bg-green-100'
                    : 'border-gray-300 bg-white hover:bg-gray-50'
                ]"
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
                    class="w-5 h-5 text-green-600 flex-shrink-0 ml-2"
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
                @click="selectMark(mark)"
                :class="[
                  'w-full text-left px-3 py-2 rounded-md transition-colors',
                  'border',
                  selectedMark?.mark === mark.mark
                    ? 'border-blue-500 bg-blue-50'
                    : mark.configured
                    ? 'border-green-300 bg-green-50 hover:bg-green-100'
                    : 'border-gray-300 bg-white hover:bg-gray-50'
                ]"
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
                    class="w-5 h-5 text-green-600 flex-shrink-0 ml-2"
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

      <!-- 导航按钮 -->
      <div class="mt-6 flex gap-3">
        <Button variant="outline" class="flex-1" @click="emit('prev')">
          上一步
        </Button>
        <Button
          variant="primary"
          class="flex-1"
          :disabled="!canProceed"
          @click="emit('next')"
        >
          下一步
        </Button>
      </div>
    </div>

    <!-- 右侧 -->
    <div class="lg:col-span-2 space-y-6">
      <!-- 右侧区域 A：数据源管理 -->
      <Card title="数据源管理" :padding="false">
        <div class="p-4">
          <p class="text-sm text-gray-600 mb-4">
            声明此契约需要几个数据源。
          </p>

          <div class="space-y-2 mb-4">
            <div
              v-for="ds in draft.dataSources"
              :key="ds.id"
              class="flex items-center gap-2 p-2 border border-gray-200 rounded-md"
            >
              <div
                class="w-2 h-2 rounded-full bg-blue-600"
              ></div>
              
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
                @click="saveDataSourceName"
                class="text-green-600 hover:text-green-700 text-sm"
              >
                保存
              </button>
              <button
                v-if="editingDataSourceId === ds.id"
                @click="cancelEditDataSource"
                class="text-gray-600 hover:text-gray-700 text-sm"
              >
                取消
              </button>
              <button
                v-else
                @click="startEditDataSource(ds.id)"
                class="text-blue-600 hover:text-blue-700 text-sm"
              >
                重命名
              </button>
            </div>
          </div>

          <div class="flex gap-2">
            <input
              v-model="newDataSourceName"
              type="text"
              placeholder="新数据源名称"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              @keyup.enter="handleAddDataSource"
            />
            <Button variant="primary" @click="handleAddDataSource">
              添加数据源
            </Button>
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
            <p class="mt-2 text-sm text-gray-600">请从左侧选择一个标记开始配置</p>
          </div>

          <!-- 配置单个值 -->
          <ConfigSingleValue
            v-if="selectedMark && selectedMark.markType === 'single'"
            :mark="selectedMark.mark"
            :data-sources="draft.dataSources"
            @save="handleSaveBinding"
          />

          <!-- 配置列表 -->
          <ConfigList
            v-if="selectedMark && selectedMark.markType === 'list'"
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

