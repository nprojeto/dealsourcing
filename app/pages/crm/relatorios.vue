<script setup lang="ts">
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial'] })
useHead({ title: 'Painel gerencial · DealSourcing' })

interface Group { key: string; total: number; open: number; won: number; lost: number; pipeline_max: number }
interface Dash {
  kpis: Record<string, number | null>
  funnel: { key: string; name: string; reached: number; current: number; conversion: number | null; is_won: boolean }[]
  cohort_size: number
  series: { monthly: boolean; items: { key: string; label: string; registered: number; simulations: number; formalizations: number; won: number; lost: number }[] }
  by_region: Group[]; by_state: Group[]; by_origin: Group[]
  lost_reasons: { reason: string; n: number }[]
  team: { id: string; name: string; role: string; open: number; overdue: number; meetings_done: number; won: number; lost: number; won_value: number; win_rate: number | null; avg_cycle_days: number | null; referrals: number; pipeline_max: number }[]
  partners: { id: string; name: string; referred: number; simulated: number; formalized: number; open: number; won: number; won_value: number; conversion: number | null; commissions: number; paid: number }[]
  options: { states: string[]; cities: { city: string; state: string }[]; assignees: { id: string; name: string }[]; partners: { id: string; name: string; type: string }[]; stages: { key: string; name: string }[] }
  generated_at: string
}

const api = useApi()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const PRESETS: { key: string; label: string }[] = [
  { key: '30d', label: '30 dias' }, { key: '90d', label: '90 dias' }, { key: '12m', label: '12 meses' },
  { key: 'ano', label: 'Este ano' }, { key: 'tudo', label: 'Tudo' }, { key: 'custom', label: 'Personalizado' },
]
const q = (k: string) => (route.query[k] ? String(route.query[k]) : '')
const f = reactive({ preset: q('periodo') || '12m', from: q('from'), to: q('to'), region: q('region'), state: q('state'), city: q('city'),
  assignee: q('assignee'), partner: q('partner'), stage: q('stage'), origin: q('origin') })
const tab = ref<'painel' | 'exportar'>(q('aba') === 'exportar' ? 'exportar' : 'painel')

function rangeOf(p: string): { from: string; to: string } {
  const today = todayISO()
  const back = (days: number) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - days); return d.toLocaleDateString('sv-SE') }
  if (p === '30d') return { from: back(29), to: today }
  if (p === '90d') return { from: back(89), to: today }
  if (p === '12m') { const d = new Date(`${today}T12:00:00`); d.setMonth(d.getMonth() - 11, 1); return { from: d.toLocaleDateString('sv-SE'), to: today } }
  if (p === 'ano') return { from: `${today.slice(0, 4)}-01-01`, to: today }
  if (p === 'tudo') return { from: '', to: '' }
  return { from: f.from, to: f.to }
}
const period = computed(() => rangeOf(f.preset))
const params = computed(() => ({ from: period.value.from, to: period.value.to, region: f.region, state: f.state, city: f.city,
  assignee: f.assignee, partner: f.partner, stage: f.stage, origin: f.origin }))
const activeFilters = computed(() => ['region', 'state', 'city', 'assignee', 'partner', 'stage', 'origin'].filter((k) => f[k as keyof typeof f]).length)

const d = ref<Dash | null>(null)
const loading = ref(false)
let seq = 0
async function load() {
  if (f.preset === 'custom' && f.from && f.to && f.from > f.to) { toast.error('A data inicial deve ser anterior à final.'); return }
  const my = ++seq
  loading.value = true
  try { const r = await api.get<Dash>('/reports/dashboard', params.value); if (my === seq) d.value = r }
  catch (e) { toast.error(errorMessage(e)) } finally { if (my === seq) loading.value = false }
}
watch(() => ({ ...f }), (v) => {
  const query: Record<string, string> = {}
  for (const [k, val] of Object.entries(v)) if (val && !(k === 'preset' && val === '12m') && !(['from', 'to'].includes(k) && v.preset !== 'custom')) query[k === 'preset' ? 'periodo' : k] = val
  if (tab.value === 'exportar') query.aba = 'exportar'
  router.replace({ query })
}, { deep: true })
watch(params, load, { deep: true })
watch(tab, (t) => router.replace({ query: { ...route.query, aba: t === 'exportar' ? 'exportar' : undefined } }))
watch(() => f.state, () => { if (f.city && !cityOptions.value.some((c) => c.city === f.city)) f.city = '' })
onMounted(load)
function clearFilters() { Object.assign(f, { region: '', state: '', city: '', assignee: '', partner: '', stage: '', origin: '' }) }

const cityOptions = computed(() => (d.value?.options.cities ?? []).filter((c) => !f.state || c.state === f.state))
const K = computed(() => d.value?.kpis ?? {})
const n = (k: string) => Number(K.value[k] ?? 0)
const periodLabel = computed(() => {
  const p = period.value
  if (!p.from && !p.to) return 'todo o histórico'
  return `${p.from ? fmtDay(p.from) : 'início'} a ${p.to ? fmtDay(p.to) : 'hoje'}`
})

// Gráfico
const showTable = ref(false)
const SERIES = [
  { key: 'registered', name: 'Cadastros', color: '#2D5BD7' },
  { key: 'simulations', name: 'Simulações', color: '#14A38B' },
  { key: 'formalizations', name: 'Formalizações', color: '#D98A1C' },
  { key: 'won', name: 'Aquisições', color: '#B5428F' },
] as const
const chart = computed(() => {
  const items = d.value?.series.items ?? []
  return { labels: items.map((i) => i.label), series: SERIES.map((s) => ({ ...s, values: items.map((i) => i[s.key]) })) }
})
const funnelRows = computed(() => (d.value?.funnel ?? []).map((s) => ({
  key: s.key, label: s.name, value: s.reached, note: s.conversion === null ? '' : `${s.conversion.toLocaleString('pt-BR')}%`,
  noteTone: s.conversion !== null && s.conversion < 50 ? 'low' : '',
  title: `${s.name}: ${s.reached} chegaram a esta etapa · ${s.current} estão nela agora${s.conversion !== null ? ` · ${s.conversion}% da etapa anterior` : ''}`,
})))
const groupRows = (g: Group[] | undefined, label: (k: string) => string) => (g ?? []).map((x) => ({
  key: x.key, label: label(x.key), value: x.total, note: `${x.won} concl.`, title: `${label(x.key)}: ${x.total} oportunidades · ${x.open} abertas · ${x.won} concluídas · ${x.lost} perdidas`,
}))
const regionRows = computed(() => groupRows(d.value?.by_region, (k) => REGION_LABEL[k as keyof typeof REGION_LABEL] ?? 'Não informada'))
const originRows = computed(() => groupRows(d.value?.by_origin, (k) => ORIGIN_LABEL[k] ?? k))
const stateRows = computed(() => groupRows(d.value?.by_state, (k) => k === '—' ? 'Não informado' : k))
const lostRows = computed(() => (d.value?.lost_reasons ?? []).map((x, i) => ({ key: String(i), label: x.reason, value: x.n })))
const pctTxt = (v: number | null | undefined) => v === null || v === undefined ? '—' : `${v.toLocaleString('pt-BR')}%`

// Exportação
const REPORTS = [
  { kind: 'oportunidades', title: 'Oportunidades', desc: 'Funil completo: etapa, responsável, indicação, valores estimados, valor do negócio e motivo de perda.', icon: 'briefcase' },
  { kind: 'provedores', title: 'Provedores', desc: 'ISPs cadastrados com CNPJ, localização, situação, código de indicação e etapa no funil.', icon: 'building' },
  { kind: 'simulacoes', title: 'Simulações', desc: 'Todas as simulações com base de clientes, ARPU, penalização e faixa de valor.', icon: 'file' },
  { kind: 'reunioes', title: 'Reuniões', desc: 'Agenda com situação, formato, responsável, resultado e próximos passos.', icon: 'calendar' },
  { kind: 'comissoes', title: 'Comissões', desc: 'Comissões por beneficiário, regra, valor, pagamentos e situação.', icon: 'wallet' },
]
const exporting = ref('')
function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return String(v).replace('.', ',')
  const s = String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
async function exportReport(kind: string) {
  exporting.value = kind
  try {
    const r = await api.get<{ columns: string[]; rows: (string | number | null)[][] }>(`/reports/export/${kind}`, params.value)
    if (!r.rows.length) { toast.info('Nenhum registro com os filtros atuais.'); return }
    const csv = '﻿' + [r.columns, ...r.rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `dealsourcing-${kind}-${todayISO()}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast.success(`${r.rows.length} linha(s) exportada(s).`)
  } catch (e) { toast.error(errorMessage(e)) } finally { exporting.value = '' }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <div class="eyebrow">Visão geral</div>
        <h1>Painel gerencial</h1>
        <p>Indicadores do funil de aquisição, desempenho da equipe e dos parceiros e relatórios para planilha.</p>
      </div>
      <button class="btn btn-outline btn-sm" :disabled="loading" @click="load"><AppIcon name="refresh" :size="16" /> Atualizar</button>
    </div>

    <section class="card filters">
      <div class="presets" role="group" aria-label="Período">
        <button v-for="p in PRESETS" :key="p.key" type="button" class="chip" :class="{ on: f.preset === p.key }" @click="f.preset = p.key">{{ p.label }}</button>
        <template v-if="f.preset === 'custom'">
          <input v-model="f.from" type="date" class="input date" aria-label="Data inicial">
          <span class="small muted">até</span>
          <input v-model="f.to" type="date" class="input date" aria-label="Data final">
        </template>
      </div>
      <div class="selects">
        <select v-model="f.region" class="select" aria-label="Região"><option value="">Todas as regiões</option><option v-for="(l, k) in REGION_LABEL" :key="k" :value="k">{{ l }}</option></select>
        <select v-model="f.state" class="select" aria-label="Estado"><option value="">Todos os estados</option><option v-for="s in d?.options.states ?? []" :key="s" :value="s">{{ s }}</option></select>
        <select v-model="f.city" class="select" aria-label="Cidade"><option value="">Todas as cidades</option><option v-for="c in cityOptions" :key="`${c.city}-${c.state}`" :value="c.city">{{ c.city }}/{{ c.state }}</option></select>
        <select v-model="f.assignee" class="select" aria-label="Colaborador"><option value="">Todos os responsáveis</option><option value="none">Sem responsável</option><option v-for="a in d?.options.assignees ?? []" :key="a.id" :value="a.id">{{ a.name }}</option></select>
        <select v-model="f.partner" class="select" aria-label="Indicado por"><option value="">Qualquer indicação</option><option value="direct">Cadastro direto (sem código)</option>
          <optgroup label="Parceiros"><option v-for="p in (d?.options.partners ?? []).filter((x) => x.type === 'external')" :key="p.id" :value="p.id">{{ p.name }}</option></optgroup>
          <optgroup label="Equipe"><option v-for="p in (d?.options.partners ?? []).filter((x) => x.type === 'internal')" :key="p.id" :value="p.id">{{ p.name }}</option></optgroup></select>
        <select v-model="f.stage" class="select" aria-label="Etapa"><option value="">Todas as etapas</option><option v-for="s in d?.options.stages ?? []" :key="s.key" :value="s.key">{{ s.name }}</option></select>
        <select v-model="f.origin" class="select" aria-label="Origem"><option value="">Todas as origens</option><option v-for="(l, k) in ORIGIN_LABEL" :key="k" :value="k">{{ l }}</option></select>
        <button v-if="activeFilters" class="btn btn-ghost btn-sm" @click="clearFilters"><AppIcon name="x" :size="14" /> Limpar ({{ activeFilters }})</button>
      </div>
    </section>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'painel' }" @click="tab = 'painel'">Indicadores</button>
      <button class="tab" :class="{ active: tab === 'exportar' }" @click="tab = 'exportar'">Exportar relatórios</button>
    </div>

    <div v-if="!d && loading" class="empty"><span class="spinner" /></div>

    <!-- INDICADORES -->
    <div v-else-if="d && tab === 'painel'" class="stack-lg" :class="{ dim: loading }">
      <p class="small muted" style="margin:0">Período: <b>{{ periodLabel }}</b>. Cada número usa a data do próprio evento (cadastro, simulação, reunião, conclusão…). "Situação atual" mostra o funil de hoje.</p>

      <div class="hero">
        <div class="pipe">
          <span>Pipeline estimado · oportunidades em aberto</span>
          <strong>{{ fmtBRLShort(n('pipeline_min')) }} – {{ fmtBRLShort(n('pipeline_max')) }}</strong>
          <small>{{ n('open') }} oportunidade(s) em aberto · {{ n('overdue') }} com prazo vencido</small>
        </div>
        <div class="won">
          <span>Aquisições concluídas no período</span>
          <strong>{{ n('won') }}</strong>
          <small>{{ n('won_value') ? fmtBRLShort(n('won_value')) + ' em negócios' : 'sem valor informado' }}</small>
        </div>
      </div>

      <div>
        <div class="eyebrow">Captação</div>
        <div class="kgrid">
          <div class="card kpi"><div class="kpi-label">ISPs identificados</div><div class="kpi-value">{{ n('identified') }}</div><div class="kpi-foot">cadastrados + prospecções</div></div>
          <div class="card kpi"><div class="kpi-label">ISPs cadastrados</div><div class="kpi-value">{{ n('registered') }}</div><div class="kpi-foot">no portal</div></div>
          <div class="card kpi"><div class="kpi-label">Simulações</div><div class="kpi-value">{{ n('simulations') }}</div><div class="kpi-foot">avaliações preliminares</div></div>
          <div class="card kpi ok"><div class="kpi-label">Formalizações</div><div class="kpi-value">{{ n('formalizations') }}</div><div class="kpi-foot">interesse formalizado</div></div>
        </div>
      </div>
      <div>
        <div class="eyebrow">Atendimento</div>
        <div class="kgrid">
          <div class="card kpi"><div class="kpi-label">Reuniões agendadas</div><div class="kpi-value">{{ n('meetings_scheduled') }}</div><div class="kpi-foot">no período</div></div>
          <div class="card kpi ok"><div class="kpi-label">Reuniões realizadas</div><div class="kpi-value">{{ n('meetings_done') }}</div><div class="kpi-foot">com resultado registrado</div></div>
          <div class="card kpi"><div class="kpi-label">Em análise</div><div class="kpi-value">{{ n('in_analysis') }}</div><div class="kpi-foot">situação atual, antes da negociação</div></div>
          <div class="card kpi warn"><div class="kpi-label">Em negociação</div><div class="kpi-value">{{ n('negotiating') }}</div><div class="kpi-foot">situação atual, negociação em diante</div></div>
        </div>
      </div>
      <div>
        <div class="eyebrow">Resultado</div>
        <div class="kgrid">
          <div class="card kpi ok"><div class="kpi-label">Aquisições concluídas</div><div class="kpi-value">{{ n('won') }}</div><div class="kpi-foot">{{ fmtBRLShort(n('won_value')) }}</div></div>
          <div class="card kpi bad"><div class="kpi-label">Oportunidades perdidas</div><div class="kpi-value">{{ n('lost') }}</div><div class="kpi-foot">no período</div></div>
          <div class="card kpi"><div class="kpi-label">Taxa de conversão</div><div class="kpi-value">{{ pctTxt(K.win_rate) }}</div><div class="kpi-foot">concluídas ÷ (concluídas + perdidas)</div></div>
          <div class="card kpi"><div class="kpi-label">Ciclo médio</div><div class="kpi-value">{{ K.avg_cycle_days === null ? '—' : `${K.avg_cycle_days} d` }}</div><div class="kpi-foot">da entrada à conclusão</div></div>
        </div>
      </div>

      <section class="card panel">
        <div class="panel-head"><h2>Evolução {{ d.series.monthly ? 'mensal' : 'semanal' }}</h2>
          <button class="btn btn-ghost btn-sm" @click="showTable = !showTable">{{ showTable ? 'Ver gráfico' : 'Ver tabela' }}</button></div>
        <TrendChart v-if="!showTable && chart.labels.length" :labels="chart.labels" :series="chart.series" />
        <div v-else-if="showTable" class="table-wrap">
          <table class="table compact"><thead><tr><th>{{ d.series.monthly ? 'Mês' : 'Semana' }}</th><th v-for="s in SERIES" :key="s.key" class="r">{{ s.name }}</th><th class="r">Perdidas</th></tr></thead>
            <tbody><tr v-for="i in d.series.items" :key="i.key"><td>{{ i.label }}</td><td v-for="s in SERIES" :key="s.key" class="r">{{ i[s.key] }}</td><td class="r">{{ i.lost }}</td></tr></tbody></table>
        </div>
        <p v-else class="small muted">Sem dados no período.</p>
      </section>

      <div class="two">
        <section class="card panel">
          <div class="panel-head"><h2>Funil e conversão</h2><span class="small muted">{{ d.cohort_size }} oportunidade(s) criadas no período</span></div>
          <p class="small muted" style="margin:0 0 .8rem">Quantas oportunidades chegaram a cada etapa e o percentual que avançou a partir da etapa anterior.</p>
          <BarList :rows="funnelRows" color="var(--navy)" empty="Nenhuma oportunidade criada no período." />
        </section>
        <div class="stack-lg">
          <section class="card panel"><div class="panel-head"><h2>Por região</h2></div><BarList :rows="regionRows" /></section>
          <section class="card panel"><div class="panel-head"><h2>Por origem</h2></div><BarList :rows="originRows" /></section>
        </div>
      </div>
      <div class="two">
        <section class="card panel"><div class="panel-head"><h2>Por estado</h2></div><BarList :rows="stateRows" /></section>
        <section class="card panel"><div class="panel-head"><h2>Motivos de perda</h2></div><BarList :rows="lostRows" color="#B4232C" empty="Nenhuma perda no período." /></section>
      </div>

      <section class="card panel">
        <div class="panel-head"><h2>Desempenho da equipe</h2></div>
        <div class="table-wrap">
          <table class="table compact">
            <thead><tr><th>Colaborador</th><th class="r">Em aberto</th><th class="r">Vencidas</th><th class="r">Reuniões</th><th class="r">Concluídas</th><th class="r">Perdidas</th><th class="r">Conversão</th><th class="r">Valor fechado</th><th class="r">Ciclo</th><th class="r">Indicações</th></tr></thead>
            <tbody>
              <tr v-if="!d.team.length"><td colspan="10" class="empty">Nenhum colaborador ativo.</td></tr>
              <tr v-for="t in d.team" :key="t.id">
                <td><div class="t-strong">{{ t.name }}</div><div class="small muted">{{ ROLE_LABEL[t.role as keyof typeof ROLE_LABEL] }}</div></td>
                <td class="r">{{ t.open }}</td><td class="r" :class="{ late: t.overdue }">{{ t.overdue }}</td><td class="r">{{ t.meetings_done }}</td>
                <td class="r"><b>{{ t.won }}</b></td><td class="r">{{ t.lost }}</td><td class="r">{{ pctTxt(t.win_rate) }}</td>
                <td class="r nowrap">{{ t.won_value ? fmtBRLShort(t.won_value) : '—' }}</td><td class="r">{{ t.avg_cycle_days === null ? '—' : `${t.avg_cycle_days} d` }}</td><td class="r">{{ t.referrals }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card panel">
        <div class="panel-head"><h2>Desempenho dos parceiros</h2></div>
        <div class="table-wrap">
          <table class="table compact">
            <thead><tr><th>Parceiro</th><th class="r">Indicados</th><th class="r">Simularam</th><th class="r">Formalizaram</th><th class="r">Em aberto</th><th class="r">Concluídas</th><th class="r">Conversão</th><th class="r">Valor fechado</th><th class="r">Comissões</th><th class="r">Pago</th></tr></thead>
            <tbody>
              <tr v-if="!d.partners.length"><td colspan="10" class="empty">Nenhum parceiro ativo.</td></tr>
              <tr v-for="p in d.partners" :key="p.id">
                <td class="t-strong">{{ p.name }}</td><td class="r">{{ p.referred }}</td><td class="r">{{ p.simulated }}</td><td class="r">{{ p.formalized }}</td>
                <td class="r">{{ p.open }}</td><td class="r"><b>{{ p.won }}</b></td><td class="r">{{ pctTxt(p.conversion) }}</td>
                <td class="r nowrap">{{ p.won_value ? fmtBRLShort(p.won_value) : '—' }}</td><td class="r nowrap">{{ fmtBRL(p.commissions) }}</td><td class="r nowrap">{{ fmtBRL(p.paid) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <p class="small muted" style="margin:0">Atualizado em {{ fmtDateTime(d.generated_at) }}.</p>
    </div>

    <!-- EXPORTAR -->
    <div v-else-if="tab === 'exportar'" class="stack-lg">
      <div class="alert info small"><AppIcon name="info" :size="18" />
        <span>Os relatórios usam os filtros acima (período: <b>{{ periodLabel }}</b>{{ activeFilters ? `, ${activeFilters} filtro(s)` : '' }}). O arquivo CSV abre direto no Excel ou no Google Planilhas. Cada exportação fica registrada na auditoria.</span></div>
      <div class="reports">
        <article v-for="r in REPORTS" :key="r.kind" class="card rep">
          <span class="ic"><AppIcon :name="r.icon" :size="20" /></span>
          <div class="grow"><strong>{{ r.title }}</strong><p class="small muted">{{ r.desc }}</p></div>
          <button class="btn btn-outline btn-sm" :disabled="!!exporting" @click="exportReport(r.kind)">
            <span v-if="exporting === r.kind" class="spinner" /><AppIcon v-else name="file" :size="16" /> Baixar planilha</button>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filters { padding: .85rem; margin-bottom: 1rem; display: grid; gap: .7rem; }
.presets { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; }
.chip { border: 1px solid var(--line-strong); background: #fff; border-radius: 99px; padding: .35rem .8rem; font: 600 .82rem var(--font-body); color: var(--ink-2); cursor: pointer; }
.chip.on { background: var(--navy); border-color: var(--navy); color: #fff; }
.date { width: auto; min-height: 36px; }
.selects { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: .5rem; align-items: center; }
.stack-lg { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr); }
.stack-lg > *, .two > * { min-width: 0; }
.dim { opacity: .55; transition: opacity .2s; }
.hero { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; }
.hero > div { border-radius: var(--radius); padding: 1.2rem 1.4rem; display: grid; gap: .2rem; }
.hero span { font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }
.hero strong { font-family: var(--font-head); font-size: 2rem; line-height: 1.15; }
.hero small { font-size: .82rem; }
.pipe { background: var(--navy); color: #fff; }
.pipe span, .pipe small { color: #9FB0E8; }
.won { background: #fff; border: 1px solid var(--line); color: var(--navy); }
.won span, .won small { color: var(--muted); }
.kgrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; margin-top: .45rem; }
.kpi.bad::before { background: var(--danger); }
.panel { padding: 1.1rem 1.25rem; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .8rem; flex-wrap: wrap; }
.panel-head h2 { font-size: 1.02rem; margin: 0; }
.two { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 1.25rem; align-items: start; }
.r { text-align: right; }
.late { color: var(--danger); font-weight: 600; }
.table.compact td, .table.compact th { padding: .55rem .7rem; }
.reports { display: grid; gap: .75rem; }
.rep { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.2rem; }
.rep p { margin: .15rem 0 0; }
.rep .ic { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: var(--blue-100); color: var(--blue); flex: none; }
@media (max-width: 1100px) { .two { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 900px) { .kgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .hero { grid-template-columns: 1fr; } .hero strong { font-size: 1.6rem; } }
@media (max-width: 640px) { .rep { flex-wrap: wrap; } .rep .btn { width: 100%; } .selects { grid-template-columns: 1fr 1fr; } }
</style>
