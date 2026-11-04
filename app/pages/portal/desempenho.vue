<script setup lang="ts">
import type { PerformancePayload } from '~/utils/simulator'
definePageMeta({ layout: 'portal', roles: ['parceiro'] })
useHead({ title: 'Minhas indicações · DealSourcing' })
const api = useApi()
const toast = useToast()
const data = ref<PerformancePayload | null>(null)
const loading = ref(true)
onMounted(async () => {
  try { data.value = await api.get<PerformancePayload>('/me/performance') }
  catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
})
</script>

<template>
  <div>
    <div class="page-head">
      <div><div class="eyebrow">Portal do parceiro</div><h1>Minhas indicações</h1>
        <p>Acompanhe os provedores que chegaram pelo seu código e em que etapa cada um está.</p></div>
    </div>
    <div v-if="loading" class="empty"><span class="spinner" /></div>
    <PerformancePanel v-else-if="data" :data="data" />
  </div>
</template>
