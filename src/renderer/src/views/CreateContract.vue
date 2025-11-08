<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useContractStore } from '../stores/contract'
import Button from '../components/ui/Button.vue'
import Step1UploadTemplate from '../components/contract-steps/Step1UploadTemplate.vue'
import Step2ConfigureContract from '../components/contract-steps/Step2ConfigureContract.vue'
import Step3TestAndSave from '../components/contract-steps/Step3TestAndSave.vue'
import type { MarkItem } from '@shared/types/contract'

const router = useRouter()
const contractStore = useContractStore()

const currentStep = ref(1)

watch(
  () => contractStore.draftContractId,
  (newId) => {
    if (newId && currentStep.value === 1) {
      currentStep.value = 2
    }
  },
  { immediate: true }
)

// 步骤1完成后的回调
const handleStep1Complete = (
  templateFileName: string,
  templatePath: string,
  templateChecksum: string,
  markItems: MarkItem[]
) => {
  contractStore.createNewDraft(templateFileName, templatePath, templateChecksum, markItems)
  currentStep.value = 2
}

// 步骤2的数据
const canProceedToStep3 = computed(() => {
  if (!contractStore.contractDraft) return false
  // 检查是否所有标记都已配置
  return contractStore.contractDraft.markItems.every((m) => m.configured)
})

// 进入步骤3
const handleProceedToStep3 = () => {
  if (canProceedToStep3.value) {
    currentStep.value = 3
  }
}

// 步骤3完成后的回调
const handleStep3Complete = async (contractName: string, description?: string) => {
  if (!contractStore.contractDraft) return

  const normalizedDescription = description && description.length > 0 ? description : undefined

  try {
    await contractStore.saveContract({
      name: contractName,
      description: normalizedDescription
    })
    contractStore.clearDraft()
    router.push('/')
  } catch (error) {
    console.error('保存报表契约失败', error)
    alert('保存报表契约失败，请稍后再试。')
  }
}

// 取消创建
const handleCancel = () => {
  if (confirm('确定要取消创建吗？所有未保存的更改将丢失。')) {
    contractStore.clearDraft()
    router.push('/')
  }
}

// 返回上一步
const handlePrevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}
</script>

<template>
  <div class="h-screen bg-gray-50 flex flex-col">
    <!-- 顶部导航栏 -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">创建新报表</h1>
            <p class="text-sm text-gray-600 mt-1">按照步骤配置您的报表契约</p>
          </div>
          <Button variant="outline" @click="handleCancel">取消</Button>
        </div>
      </div>
    </header>

    <!-- 步骤指示器 -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <nav class="flex items-center justify-center">
          <ol class="flex items-center space-x-4">
            <!-- 步骤1 -->
            <li class="flex items-center">
              <div
                :class="[
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors',
                  currentStep >= 1
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-500'
                ]"
              >
                <span class="text-sm font-semibold">1</span>
              </div>
              <span
                :class="[
                  'ml-2 text-sm font-medium',
                  currentStep >= 1 ? 'text-gray-900' : 'text-gray-500'
                ]"
              >
                上传模板
              </span>
            </li>

            <!-- 连接线 -->
            <div :class="['w-16 h-0.5', currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300']"></div>

            <!-- 步骤2 -->
            <li class="flex items-center">
              <div
                :class="[
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors',
                  currentStep >= 2
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-500'
                ]"
              >
                <span class="text-sm font-semibold">2</span>
              </div>
              <span
                :class="[
                  'ml-2 text-sm font-medium',
                  currentStep >= 2 ? 'text-gray-900' : 'text-gray-500'
                ]"
              >
                配置契约
              </span>
            </li>

            <!-- 连接线 -->
            <div :class="['w-16 h-0.5', currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-300']"></div>

            <!-- 步骤3 -->
            <li class="flex items-center">
              <div
                :class="[
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors',
                  currentStep >= 3
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-500'
                ]"
              >
                <span class="text-sm font-semibold">3</span>
              </div>
              <span
                :class="[
                  'ml-2 text-sm font-medium',
                  currentStep >= 3 ? 'text-gray-900' : 'text-gray-500'
                ]"
              >
                测试与保存
              </span>
            </li>
          </ol>
        </nav>
      </div>
    </div>

    <!-- 主内容区 -->
    <main class="flex-1 overflow-y-auto">
      <div class="max-w-7xl mx-auto px-6 py-8">
        <!-- 步骤1: 上传模板 -->
        <Step1UploadTemplate v-if="currentStep === 1" @complete="handleStep1Complete" />

        <!-- 步骤2: 配置契约 -->
        <Step2ConfigureContract
          v-if="currentStep === 2"
          :can-proceed="canProceedToStep3"
          @prev="handlePrevStep"
          @next="handleProceedToStep3"
        />

        <!-- 步骤3: 测试与保存 -->
        <Step3TestAndSave
          v-if="currentStep === 3"
          @prev="handlePrevStep"
          @complete="handleStep3Complete"
        />
      </div>
    </main>
  </div>
</template>
