<script setup lang="ts">
/** Painel individual de desempenho (colaborador ou parceiro). Não exibe valores financeiros. */
import type { PerformancePayload, ReferredIsp } from '~/utils/simulator'
import type { IspStatus } from '~/utils/labels'
const props = withDefaults(defineProps<{ data: PerformancePayload; internal?: boolean; showAssigned?: boolean }>(), { internal: false, showAssigned: false })
const p = computed(() => props.data.performance)

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)
const funnel = computed(() => [
  { label: 'Provedores cadastrados', n: p.value.isps, rate: null as number | null },
  { label: 'Fizeram simulação', n: p.value.isps_simulated, rate: pct(p.value.isps_simulated, p.value.isps) },
  { label: 'Formalizaram interesse', n: p.value.isps_formalized, rate: pct(p.value.isps_formalized, p.value.isps_simulated) },
  { label: 'Aquisição concluída', n: p.value.acquisitions, rate: pct(p.value.acquisitions, p.value.isps_formalized) },
])
const maxN = computed(() => Math.max(1, p.value.isps))

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')
}
function situation(i: ReferredIsp): { text: string; tone: string } {
  if (i.won) return { text: 'Aquisição concluída', tone: 'success' }
  if (i.lost) return { text: 'Oportunidade encerrada', tone: '' }
  if (i.stage) return { text: i.stage, tone: 'info' }
  return { text: ISP_STATUS_LABEL[i.status as IspStatus] ?? i.status, tone: ISP_STATUS_TONE[i.status as IspStatus] ?? 'plain' }
}
function openIsp(i: ReferredIsp) { if (props.internal) navigateTo(`/crm/provedores?id=${i.id}`) }
</script>

<template>
  <div class="perf stack">
    <div class="grid-4 kpis">
      <div class="card kpi"><div class="kpi-label">Provedores indicados</div><div class="kpi-value">{{ p.isps }}</div><div class="kpi-foot">cadastrados com o código</div></div>
      <div class="card kpi"><div class="kpi-label">Simulações</div><div class="kpi-value">{{ p.simulations }}</div><div class="kpi-foot">{{ p.isps_simulated }} provedor(es) simularam</div></div>
      <div class="card kpi ok"><div class="kpi-label">Interesses formalizados</div><div class="kpi-value">{{ p.isps_formalized }}</div><div class="kpi-foot">{{ p.opportunities_open }} em andamento · {{ p.meetings ?? 0 }} reunião(ões)</div></div>
      <div class="card kpi navy"><div class="kpi-label">Aquisições concluídas</div><div class="kpi-value">{{ p.acquisitions }}</div><div class="kpi-foot">{{ p.lost }} encerrada(s) sem acordo</div></div>
    </div>
    <p v-if="showAssigned && p.assigned_open" class="small muted" style="margin:0">Você também é responsável por <strong>{{ p.assigned_open }}</strong> oportunidade(s) em atendimento.</p>

    <div class="two">
      <article class="card">
        <div class="card-head"><h2>Conversão das indicações</h2></div>
        <div class="card-body stack">
          <div v-for="(f, i) in funnel" :key="f.label" class="fn">
            <div class="row between small">
              <span>{{ f.label }}</span>
              <span><strong>{{ f.n }}</strong><span v-if="i > 0" class="muted"> · {{ f.rate }}% da etapa anterior</span></span>
            </div>
            <div class="bar"><span :style="{ width: `${(f.n / maxN) * 100}%` }" /></div>
          </div>
          <p v-if="!p.isps" class="small muted" style="margin:0">Compartilhe seu código para começar a acompanhar suas indicações.</p>
        </div>
      </article>

      <article class="card">
        <div class="card-head"><h2>Últimos 6 meses</h2><span v-if="p.last_activity" class="small muted">Última atividade {{ fmtRelative(p.last_activity) }}</span></div>
        <div class="table-wrap" style="border:0;border-radius:0">
          <table class="table">
            <thead><tr><th>Mês</th><th>Cadastros</th><th>Simulações</th><th>Formalizações</th></tr></thead>
            <tbody>
              <tr v-for="m in [...p.monthly].reverse()" :key="m.month">
                <td class="t-strong nowrap">{{ monthLabel(m.month) }}</td>
                <td>{{ m.isps }}</td><td>{{ m.simulations }}</td><td>{{ m.formalizations }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>

    <article class="card">
      <div class="card-head"><h2>Provedores indicados ({{ data.isps.length }})</h2></div>
      <div v-if="!data.isps.length" class="empty small"><BrandLogo symbol :height="48" />Nenhum provedor cadastrado com este código ainda.</div>
      <div v-else class="table-wrap" style="border:0;border-radius:0">
        <table class="table">
          <thead><tr><th>Provedor</th><th>Local</th><th>Cadastro</th><th>Simulações</th><th>Situação</th></tr></thead>
          <tbody>
            <tr v-for="i in data.isps" :key="i.id" :class="{ clickable: internal }" @click="openIsp(i)">
              <td class="t-strong">{{ i.trade_name }}</td>
              <td class="nowrap">{{ i.city }}/{{ i.state }}</td>
              <td class="nowrap">{{ fmtDate(i.created_at) }}</td>
              <td>{{ i.simulations }}<span v-if="i.last_simulation_at" class="small muted"> · última {{ fmtDate(i.last_simulation_at) }}</span></td>
              <td><span class="badge" :class="situation(i).tone">{{ situation(i).text }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </div>
</template>

<style scoped>
.kpi.navy { background: var(--navy); border-color: var(--navy); }
.kpi.navy::before { background: #8FA2DE; }
.kpi.navy .kpi-label, .kpi.navy .kpi-foot { color: #9FB0E8; }
.kpi.navy .kpi-value { color: #fff; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; align-items: start; }
.fn .bar { margin-top: .35rem; }
@media (max-width: 960px) { .two { grid-template-columns: 1fr; } }
</style>
