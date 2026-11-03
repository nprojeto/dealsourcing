<script setup lang="ts">
import type { SimStatus } from '~/utils/labels'
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial'] })
useHead({ title: 'Simulações · DealSourcing' })

interface Row {
  id: string; isp_id: string; client_base: number; region: string; regularized: string; poles_valid_pct: number; employment_type: string;
  arpu: number; status: SimStatus; formalized_at: string | null; created_at: string; referral_code: string | null;
  isp: { trade_name: string; city: string; state: string } | null;
  result: { value_min: number; value_max: number; total_penalty: number; parameter_version: number } | null
}
const api = useApi()
const toast = useToast()
const f = reactive({ status: '', region: '', from: '', to: '', page: 1 })
const items = ref<Row[]>([])
const total = ref(0)
const loading = ref(false)
const pageSize = 25
async function load() {
  loading.value = true
  try { const r = await api.get<{ items: Row[]; total: number }>('/crm/simulations', { ...f, page_size: pageSize }); items.value = r.items; total.value = r.total }
  catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
watch(() => [f.status, f.region, f.from, f.to], () => { f.page = 1; load() })
onMounted(load)
const sum = computed(() => items.value.reduce((a, r) => ({ min: a.min + Number(r.result?.value_min ?? 0), max: a.max + Number(r.result?.value_max ?? 0) }), { min: 0, max: 0 }))
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <div class="eyebrow">Comercial</div>
        <h1>Simulações</h1>
        <p>Todas as avaliações preliminares registradas, com valores internos. Visível somente para administradores e gestores.</p>
      </div>
    </div>
    <div class="card filters">
      <select v-model="f.status" class="select" aria-label="Status">
        <option value="">Todas</option>
        <option value="simulated">Sem formalização</option>
        <option value="interest_formalized">Interesse formalizado</option>
      </select>
      <select v-model="f.region" class="select" aria-label="Região">
        <option value="">Todas as regiões</option>
        <option v-for="(l, k) in REGION_LABEL" :key="k" :value="k">{{ l }}</option>
      </select>
      <label class="row small">De <input v-model="f.from" type="date" class="input date"></label>
      <label class="row small">Até <input v-model="f.to" type="date" class="input date"></label>
      <span v-if="items.length" class="small muted grow" style="text-align:right">Nesta página: {{ fmtBRLShort(sum.min) }} – {{ fmtBRLShort(sum.max) }}</span>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Data</th><th>Provedor</th><th>Clientes</th><th>ARPU</th><th>Penalização</th><th>Valor estimado</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-if="loading && !items.length"><td colspan="7" class="empty"><span class="spinner" /></td></tr>
          <tr v-else-if="!items.length"><td colspan="7" class="empty">Nenhuma simulação encontrada.</td></tr>
          <tr v-for="r in items" :key="r.id" class="clickable" @click="navigateTo(`/crm/provedores?id=${r.isp_id}`)">
            <td class="nowrap">{{ fmtDateTime(r.created_at) }}</td>
            <td><div class="t-strong">{{ r.isp?.trade_name }}</div><div class="small muted">{{ r.isp?.city }}/{{ r.isp?.state }} · {{ REGION_LABEL[r.region] }}</div></td>
            <td>{{ fmtInt(r.client_base) }}</td>
            <td class="nowrap">{{ fmtBRL(r.arpu) }}</td>
            <td>{{ fmtPct(r.result?.total_penalty) }}<div class="small muted">v{{ r.result?.parameter_version }}</div></td>
            <td class="nowrap"><strong class="money">{{ fmtBRLShort(r.result?.value_min) }} – {{ fmtBRLShort(r.result?.value_max) }}</strong></td>
            <td><span class="badge" :class="SIM_STATUS_TONE[r.status]">{{ SIM_STATUS_LABEL[r.status] }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPager :page="f.page" :page-size="pageSize" :total="total" @change="(p) => { f.page = p; load() }" />
  </div>
</template>

<style scoped>
.filters { display: flex; gap: .75rem; padding: .85rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
.filters .select { width: auto; min-width: 190px; }
.date { width: auto; min-height: 40px; }
.money { color: var(--navy); }
</style>
