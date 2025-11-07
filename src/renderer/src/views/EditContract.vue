<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useContractStore } from '../stores/contract'
import CreateContract from './CreateContract.vue'

const route = useRoute()
const contractStore = useContractStore()

onMounted(() => {
  const contractId = route.params.id as string
  const getContract = contractStore.getContractById
  const contract = getContract(contractId)

  if (contract) {
    // 加载现有契约到草稿
    contractStore.createNewDraft(
      contract.templateFileName,
      contract.templatePath,
      [] // 实际实现: 从绑定重新生成标记项
    )
  }
})
</script>

<template>
  <CreateContract />
</template>
