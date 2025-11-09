<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useContractStore } from '../../stores/contract'
import Card from '../ui/Card.vue'
import Button from '../ui/Button.vue'
import Input from '../ui/Input.vue'
import FileUpload from '../ui/FileUpload.vue'
import type {
  RuntimeParameterValue,
  RuntimeDataSourceFile,
  ContractDraftPayload
} from '@shared/types/contract'
import type { RuntimeSession } from '@shared/types/runtime'
import type { SelectedFile } from '@shared/types/file'

const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'complete', contractName: string, description?: string): void
}>()

const contractStore = useContractStore()

const contractName = ref('')
const contractDescription = ref('')

const draft = computed(() => contractStore.contractDraft)

// 参数定义
const parameters = computed(() => {
  return draft.value?.bindings.filter((b) => b.type === 'parameter') || []
})

// 运行时参数值
const parameterValues = ref<RuntimeParameterValue[]>(
  parameters.value.map((p) => {
    if (p.type !== 'parameter') return { mark: '', value: '' }
    return {
      mark: p.mark,
      value: p.defaultValue || ''
    }
  })
)

const dataSourceFiles = ref<RuntimeDataSourceFile[]>([])

const syncDataSourceFiles = () => {
  const sources = draft.value?.dataSources ?? []
  const currentMap = new Map(dataSourceFiles.value.map((item) => [item.dataSourceId, item]))
  dataSourceFiles.value = sources.map((ds) => {
    const existing = currentMap.get(ds.id)
    return (
      existing ?? {
        dataSourceId: ds.id,
        dataSourceName: ds.name,
        uploaded: false
      }
    )
  })
}

watch(
  () => draft.value?.dataSources.map((ds) => ({ id: ds.id, name: ds.name })),
  () => {
    syncDataSourceFiles()
  },
  { immediate: true, deep: true }
)

// 是否可以运行测试
const canRunTest = computed(() => dataSourceFiles.value.every((df) => df.uploaded))

const isTestRunning = ref(false)
const testResult = ref<'idle' | 'success' | 'error'>('idle')
const testErrorMessage = ref('')
const testOutputPath = ref<string | null>(null)
const isSaving = computed(() => contractStore.isSaving)
const runtimeSession = ref<RuntimeSession | null>(null)
const runtimeError = ref<string | null>(null)
const excelFilters = [{ name: 'Excel 文件', extensions: ['xlsx', 'xls'] }]

const ensureRuntimeSession = async () => {
  if (!window.api?.runtime?.createSession) {
    runtimeError.value = '主进程未暴露 runtime API'
    return null
  }
  try {
    const scope = contractStore.getRuntimeScope()
    const session = await window.api.runtime.createSession({
      ...scope,
      sessionType: 'test'
    })
    runtimeSession.value = session
    runtimeError.value = null
    return session
  } catch (error) {
    runtimeError.value = error instanceof Error ? error.message : String(error)
    return null
  }
}

const cleanupRuntimeSession = async () => {
  if (!runtimeSession.value || !window.api?.runtime?.cleanupSession) return
  try {
    await window.api.runtime.cleanupSession(runtimeSession.value)
  } catch (error) {
    console.warn('清理测试运行会话失败', error)
  } finally {
    runtimeSession.value = null
  }
}

onMounted(() => {
  void ensureRuntimeSession()
})

onBeforeUnmount(() => {
  void cleanupRuntimeSession()
})

// 运行测试
const handleRunTest = async () => {
  if (!canRunTest.value) return
  if (!draft.value) {
    runtimeError.value = '当前没有可测试的契约草稿'
    return
  }
  const session = runtimeSession.value ?? (await ensureRuntimeSession())
  if (!session) return
  if (!window.api?.contracts?.test) {
    runtimeError.value = 'contracts API 未暴露 test 能力'
    return
  }

  isTestRunning.value = true
  testResult.value = 'idle'
  testErrorMessage.value = ''
  testOutputPath.value = null

  const draftPayload: ContractDraftPayload = {
    templatePath: draft.value.templatePath,
    templateFileName: draft.value.templateFileName,
    templateChecksum: draft.value.templateChecksum,
    dataSources: draft.value.dataSources,
    bindings: draft.value.bindings
  }

  try {
    const result = await window.api.contracts.test({
      draft: draftPayload,
      contractId: contractStore.draftContractId ?? undefined,
      runtimeSession: session,
      parameterValues: parameterValues.value,
      dataSourceFiles: dataSourceFiles.value
    })
    testResult.value = 'success'
    testOutputPath.value = result.outputPath
  } catch (error) {
    testResult.value = 'error'
    testErrorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isTestRunning.value = false
  }
}

// 文件上传处理
const handleFileUpload = async (dataSourceId: string, file: SelectedFile | SelectedFile[]) => {
  const dsFile = dataSourceFiles.value.find((df) => df.dataSourceId === dataSourceId)
  if (!dsFile) return

  const targetFile = Array.isArray(file) ? file[0] : file
  if (!targetFile) return

  const session = runtimeSession.value ?? (await ensureRuntimeSession())
  if (!session) return

  if (!window.api?.runtime?.storeDataSourceFile) {
    runtimeError.value = '主进程未暴露 runtime 存储 API'
    return
  }

  try {
    const stored = await window.api.runtime.storeDataSourceFile({
      scopeId: session.scopeId,
      scopeType: session.scopeType,
      sessionType: session.sessionType,
      sessionId: session.sessionId,
      dataSourceId,
      sourcePath: targetFile.path
    })
    dsFile.uploaded = true
    dsFile.fileName = stored.fileName
    dsFile.checksum = stored.checksum
  } catch (error) {
    runtimeError.value = error instanceof Error ? error.message : String(error)
  }
}

// 保存契约
const handleSave = () => {
  if (!contractName.value.trim()) {
    alert('请输入契约名称')
    return
  }

  if (testResult.value !== 'success') {
    if (!confirm('您还没有运行测试，确定要保存吗？')) {
      return
    }
  }

  emit('complete', contractName.value.trim(), contractDescription.value.trim())
}
</script>

<template>
  <div v-if="draft" class="max-w-5xl mx-auto space-y-6">
    <!-- 测试区域 -->
    <Card title="测试报表生成">
      <div class="space-y-6">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-sm text-blue-800">
            在保存之前，建议先运行测试以确保所有配置正确无误。 系统会模拟"运行报表"的场景。
          </p>
        </div>

        <!-- 参数输入 -->
        <div v-if="parameters.length > 0" class="space-y-4">
          <div class="border-b border-gray-200 pb-2">
            <h4 class="text-lg font-semibold text-gray-900">1. 参数输入</h4>
          </div>

          <div v-for="(param, index) in parameters" :key="param.mark" class="space-y-2">
            <Input
              v-if="param.type === 'parameter'"
              v-model="parameterValues[index].value"
              :label="param.displayLabel"
              :type="
                param.dataType === 'number' ? 'number' : param.dataType === 'date' ? 'date' : 'text'
              "
              :placeholder="param.defaultValue ? `默认值: ${param.defaultValue}` : ''"
            />
          </div>
        </div>

        <!-- 数据源文件上传 -->
        <div v-if="dataSourceFiles.length > 0" class="space-y-4">
          <div class="border-b border-gray-200 pb-2">
            <h4 class="text-lg font-semibold text-gray-900">
              {{ parameters.length > 0 ? '2. ' : '1. ' }}数据源文件
            </h4>
          </div>

          <div v-for="dsFile in dataSourceFiles" :key="dsFile.dataSourceId" class="space-y-2">
            <FileUpload
              :label="dsFile.dataSourceName"
              :filters="excelFilters"
              @select="(file) => handleFileUpload(dsFile.dataSourceId, file)"
            />
            <p v-if="dsFile.uploaded" class="text-xs text-green-600">
              已上传：{{ dsFile.fileName }} {{ dsFile.checksum ? `(${dsFile.checksum.slice(0, 8)}···)` : '' }}
            </p>
          </div>
        </div>

        <div v-if="runtimeError" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-sm text-red-800">{{ runtimeError }}</p>
        </div>

        <!-- 运行测试按钮 -->
        <div class="flex items-center gap-4">
          <Button
            variant="primary"
            size="lg"
            :disabled="!canRunTest || isTestRunning"
            @click="handleRunTest"
          >
            {{ isTestRunning ? '正在测试...' : '运行测试' }}
          </Button>

          <!-- 测试结果提示 -->
          <div v-if="testResult === 'success'" class="flex items-center text-green-600">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-sm font-medium">测试成功！所有配置正确。</span>
          </div>

          <div v-if="testResult === 'error'" class="flex items-center text-red-600">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="text-sm font-medium">测试失败</span>
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="testResult === 'error'" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-sm text-red-800">{{ testErrorMessage }}</p>
        </div>

        <!-- 测试成功预览 -->
        <div
          v-if="testResult === 'success'"
          class="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2"
        >
          <p class="text-sm text-green-800 font-medium">测试渲染成功</p>
          <p class="text-sm text-green-900">
            输出文件已保存至：
            <span class="font-semibold break-all">{{ testOutputPath }}</span>
          </p>
          <p class="text-xs text-green-700">可在运行会话目录中打开该文件进行人工校验。</p>
        </div>
      </div>
    </Card>

    <!-- 保存契约 -->
    <Card title="保存报表契约">
      <div class="space-y-4">
        <Input v-model="contractName" label="契约名称" placeholder="例如: 每周销售报表" required />

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"> 契约描述（可选） </label>
          <textarea
            v-model="contractDescription"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="简要描述此报表的用途..."
          />
        </div>

        <div class="flex justify-between pt-4">
          <Button variant="outline" :disabled="isSaving" @click="emit('prev')"> 上一步 </Button>
          <div class="flex items-center gap-3">
            <svg
              v-if="isSaving"
              class="animate-spin h-5 w-5 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <Button variant="primary" size="lg" :disabled="isSaving" @click="handleSave">
              {{ isSaving ? '保存中...' : '保存报表契约' }}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>
