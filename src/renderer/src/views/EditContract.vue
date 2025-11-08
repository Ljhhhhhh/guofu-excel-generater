<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContractStore } from '../stores/contract'
import CreateContract from './CreateContract.vue'

const route = useRoute()
const router = useRouter()
const contractStore = useContractStore()
const isLoadingContract = ref(true)

onMounted(async () => {
  const contractId = route.params.id as string
  try {
    const contract = await contractStore.fetchContractById(contractId)
    if (contract) {
      contractStore.loadDraftFromContract(contract)
    } else {
      alert('未找到指定的报表契约')
      router.push('/')
    }
  } catch (error) {
    console.error('加载契约失败', error)
    alert('加载契约失败，请稍后重试')
    router.push('/')
  } finally {
    isLoadingContract.value = false
  }
})
</script>

<template>
  <CreateContract v-if="!isLoadingContract" />
</template>
