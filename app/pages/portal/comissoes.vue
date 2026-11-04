<script setup lang="ts">
import type { CommissionItem, CommissionSummary } from '~/utils/simulator'
definePageMeta({ layout: 'portal', roles: ['parceiro'] })
useHead({ title: 'Comissões · DealSourcing' })
const api = useApi()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const items = ref<CommissionItem[]>([])
const summary = ref<CommissionSummary | null>(null)
const loading = ref(true)
onMounted(async () => {
  try { const r = await api.get<{ items: CommissionItem[]; summary: CommissionSummary }>('/commissions'); items.value = r.items; summary.value = r.summary }
  catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
})
const openId = ref<string | null>(route.query.id ? String(route.query.id) : null)
function openC(id: string) { openId.value = id; router.replace({ query: { id } }) }
function closeC() { openId.value = null; router.replace({ query: {} }) }
</script>

<template>
  <div>
    <div class="page-head">
      <div><div class="eyebrow">Portal do parceiro</div><h1>Comissões</h1>
        <p>As comissões são geradas quando a aquisição de um provedor indicado por você é concluída e passam por aprovação antes do pagamento.</p></div>
    </div>
    <div v-if="loading" class="empty"><span class="spinner" /></div>
    <template v-else-if="summary">
      <div class="kpis">
        <div class="card kpi info"><div class="kpi-label">Em aprovação</div><div class="kpi-value sm">{{ fmtBRL(summary.gerada.total) }}</div><div class="kpi-foot">{{ summary.gerada.n }} comissão(ões)</div></div>
        <div class="card kpi warn"><div class="kpi-label">A receber</div><div class="kpi-value sm">{{ fmtBRL(summary.pendente.total - summary.gerada.total) }}</div><div class="kpi-foot">{{ summary.aprovada.n }} aprovada(s)</div></div>
        <div class="card kpi ok"><div class="kpi-label">Recebido</div><div class="kpi-value sm">{{ fmtBRL(summary.paid_total) }}</div><div class="kpi-foot">{{ summary.paga.n }} quitada(s)</div></div>
      </div>
      <div v-if="!items.length" class="card empty">
        <AppIcon name="wallet" :size="36" />
        <p>Você ainda não tem comissões. Elas aparecem aqui quando um provedor indicado pelo seu código conclui a aquisição.</p>
        <NuxtLink to="/portal/desempenho" class="btn btn-outline btn-sm">Ver minhas indicações</NuxtLink>
      </div>
      <div v-else class="list">
        <button v-for="c in items" :key="c.id" class="card item" @click="openC(c.id)">
          <div class="grow">
            <strong>{{ c.opp_name }}</strong>
            <div class="small muted">{{ c.opp?.isp ? `${c.opp.isp.city}/${c.opp.isp.state} · ` : '' }}gerada em {{ fmtDate(c.generated_at) }}<template v-if="c.due_date && c.status === 'aprovada'"> · previsão {{ fmtDay(c.due_date) }}</template></div>
          </div>
          <div class="amt">
            <strong>{{ c.amount === null ? 'A definir' : fmtBRL(c.amount) }}</strong>
            <div v-if="c.paid_amount && c.status !== 'paga'" class="small muted">pago {{ fmtBRL(c.paid_amount) }}</div>
          </div>
          <span class="badge" :class="COMMISSION_STATUS_TONE[c.status]">{{ COMMISSION_STATUS_LABEL[c.status] }}</span>
        </button>
      </div>
    </template>
    <CommissionDrawer :id="openId" portal @close="closeC" />
  </div>
</template>

<style scoped>
.kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
.kpi.info::before { background: var(--blue); }
.kpi-value.sm { font-size: 1.4rem; }
.list { display: grid; gap: .6rem; }
.item { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.1rem; border: 1px solid var(--line); text-align: left; font: inherit; cursor: pointer; width: 100%; }
.item:hover { border-color: var(--blue); }
.amt { text-align: right; font-family: var(--font-head); color: var(--navy); white-space: nowrap; }
.empty :deep(svg) { color: var(--blue); margin: 0 auto .5rem; }
@media (max-width: 640px) { .kpis { grid-template-columns: 1fr; } .item { flex-wrap: wrap; } }
</style>
