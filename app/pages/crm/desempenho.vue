<script setup lang="ts">
import type { PerformancePayload } from '~/utils/simulator'
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial', 'colaborador'] })
useHead({ title: 'Meu desempenho · DealSourcing' })
const api = useApi()
const toast = useToast()
const data = ref<PerformancePayload | null>(null)
const loading = ref(true)
async function load() {
  loading.value = true
  try { data.value = await api.get<PerformancePayload>('/me/performance') }
  catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <div>
    <div class="page-head">
      <div><div class="eyebrow">Visão geral</div><h1>Meu desempenho</h1>
        <p>Resultados dos provedores cadastrados com o seu código de indicação.</p></div>
      <button class="btn btn-outline btn-sm" :disabled="loading" @click="load"><AppIcon name="refresh" :size="16" /> Atualizar</button>
    </div>
    <div v-if="loading && !data" class="empty"><span class="spinner" /></div>
    <div v-else-if="data" class="stack">
      <div class="top">
        <ReferralCard />
        <article class="card card-body help">
          <div class="eyebrow">Como funciona</div>
          <ol class="small">
            <li>Envie seu link ou código ao proprietário do provedor.</li>
            <li>Ele se cadastra, informa o código e faz a simulação.</li>
            <li>Quando ele formaliza interesse, a oportunidade entra na fila de atendimento.</li>
            <li>Tudo fica registrado no seu nome durante todo o processo comercial.</li>
          </ol>
        </article>
      </div>
      <PerformancePanel :data="data" internal show-assigned />
    </div>
  </div>
</template>

<style scoped>
.top { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.25rem; align-items: start; }
.help ol { margin: 0; padding-left: 1.1rem; display: grid; gap: .45rem; color: var(--ink-2); }
@media (max-width: 960px) { .top { grid-template-columns: 1fr; } }
</style>
