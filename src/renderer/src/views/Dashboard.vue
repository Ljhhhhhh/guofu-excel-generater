<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useContractStore } from '../stores/contract'
import Button from '../components/ui/Button.vue'
import Card from '../components/ui/Card.vue'
import RunReportModal from '../components/RunReportModal.vue'
const router = useRouter()
const contractStore = useContractStore()

const showRunModal = ref(false)
const selectedContractId = ref<string | null>(null)

onMounted(() => {
  contractStore.loadContracts()
})

const handleCreateNew = () => {
  router.push('/create')
}

const handleRunContract = (contractId: string) => {
  selectedContractId.value = contractId
  showRunModal.value = true
}

const handleEditContract = (contractId: string) => {
  router.push(`/edit/${contractId}`)
}

const handleDeleteContract = async (contractId: string) => {
  if (confirm('确定要删除此报表契约吗？')) {
    try {
      await contractStore.deleteContract(contractId)
    } catch (error) {
      console.error('删除契约失败', error)
      alert('删除契约失败，请稍后再试。')
    }
  }
}

const handleCloseRunModal = () => {
  showRunModal.value = false
  selectedContractId.value = null
}
</script>

<template>
  <div class="h-screen bg-gray-50 flex flex-col">
    <!-- 顶部导航栏 -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <h1 class="text-2xl font-bold text-gray-900">国富 Excel 工具</h1>
        <p class="text-sm text-gray-600 mt-1">报表生成器 - 模板驱动配置</p>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="flex-1 overflow-y-auto">
      <div class="max-w-7xl mx-auto px-6 py-8">
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <!-- 左侧：创建新报表 -->
          <div class="lg:col-span-1">
            <Card :padding="false">
              <div class="p-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">操作</h2>
                <Button variant="primary" size="lg" class="w-full" @click="handleCreateNew">
                  <svg
                    class="w-5 h-5 mr-2 inline-block"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  创建新报表
                </Button>
              </div>
            </Card>

            <!-- 统计信息 -->
            <Card title="统计" class="mt-6">
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-gray-600">报表契约总数</span>
                  <span class="text-2xl font-bold text-blue-600">{{
                    contractStore.contractCount
                  }}</span>
                </div>
              </div>
            </Card>
          </div>

          <!-- 右侧：已保存的报表契约列表 -->
          <div class="lg:col-span-3">
            <div class="mb-4">
              <h2 class="text-xl font-semibold text-gray-900">已保存的报表契约</h2>
              <p class="text-sm text-gray-600 mt-1">选择一个报表契约进行运行或编辑</p>
            </div>

            <div v-if="contractStore.contracts.length === 0" class="text-center py-12">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">暂无报表契约</h3>
              <p class="mt-1 text-sm text-gray-500">点击"创建新报表"开始创建您的第一个报表契约</p>
            </div>

            <div v-else class="space-y-4">
              <Card v-for="contract in contractStore.contracts" :key="contract.id" :padding="false">
                <div class="p-6">
                  <!-- 契约标题 -->
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <h3 class="text-lg font-semibold text-gray-900">{{ contract.name }}</h3>
                      <p v-if="contract.description" class="text-sm text-gray-600 mt-1">
                        {{ contract.description }}
                      </p>
                    </div>
                    <div class="ml-4">
                      <button
                        :class="[
                          'text-gray-400 transition-colors flex items-center justify-center',
                          contractStore.isDeletingContract(contract.id)
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:text-red-600'
                        ]"
                        title="删除"
                        :disabled="contractStore.isDeletingContract(contract.id)"
                        @click="handleDeleteContract(contract.id)"
                      >
                        <svg
                          v-if="!contractStore.isDeletingContract(contract.id)"
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        <svg
                          v-else
                          class="w-5 h-5 animate-spin text-red-600"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          ></circle>
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- 契约信息 -->
                  <div class="mt-4 space-y-2">
                    <div class="text-sm text-gray-600">
                      <span class="font-medium">模板文件：</span>
                      <span class="text-gray-800">{{ contract.templateFileName }}</span>
                    </div>

                    <div v-if="contract.dataSources.length > 0" class="text-sm text-gray-600">
                      <span class="font-medium">需要数据源：</span>
                      <span
                        v-for="(ds, index) in contract.dataSources"
                        :key="ds.id"
                        class="inline-block"
                      >
                        <span class="text-blue-600">[{{ ds.name }}]</span>
                        <span v-if="index < contract.dataSources.length - 1">, </span>
                      </span>
                    </div>

                    <div
                      v-if="contract.bindings.filter((b) => b.type === 'parameter').length > 0"
                      class="text-sm text-gray-600"
                    >
                      <span class="font-medium">需要参数：</span>
                      <span
                        v-for="(param, index) in contract.bindings.filter(
                          (b) => b.type === 'parameter'
                        )"
                        :key="param.mark"
                        class="inline-block"
                      >
                        <span class="text-purple-600">[{{ param.mark }}]</span>
                        <span v-if="index < contract.bindings.length - 1">, </span>
                      </span>
                    </div>

                    <div class="text-xs text-gray-500">
                      创建于：{{ new Date(contract.createdAt).toLocaleString('zh-CN') }}
                    </div>
                  </div>

                  <!-- 操作按钮 -->
                  <div class="mt-6 flex gap-3">
                    <Button variant="primary" @click="handleRunContract(contract.id)">
                      <svg
                        class="w-4 h-4 mr-1 inline-block"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      运行...
                    </Button>
                    <Button variant="outline" @click="handleEditContract(contract.id)">
                      <svg
                        class="w-4 h-4 mr-1 inline-block"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      编辑
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 运行报表模态框 -->
    <RunReportModal
      :show="showRunModal"
      :contract-id="selectedContractId"
      @close="handleCloseRunModal"
    />
  </div>
</template>
