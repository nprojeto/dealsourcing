<script setup lang="ts">
import type { CommissionItem, CommissionPayment, CommissionRule, CommissionSummary, ForecastItem, Stage } from '~/utils/simulator'
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial', 'colaborador'] })
useHead({ title: 'Comissões · DealSourcing' })

const api = useApi()
const toast = useToast()
const auth = useAuth()
const route = useRoute()
const router = useRouter()

type Tab = 'comissoes' | 'previstas' | 'pagamentos' | 'regras'
const tab = ref<Tab>((['previstas', 'pagamentos', 'regras'] as string[]).includes(String(route.query.aba)) ? route.query.aba as Tab : 'comissoes')
watch(tab, (v) => router.replace({ query: { ...route.query, aba: v === 'comissoes' ? undefined : v } }))

const f = reactive({ status: String(route.query.status ?? ''), type: '', beneficiary: '', from: '', to: '', scope: auth.isManager.value ? '' : 'me' })
const items = ref<CommissionItem[]>([])
const forecast = ref<ForecastItem[]>([])
const summary = ref<CommissionSummary | null>(null)
const canManage = ref(false)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const r = await api.get<{ items: CommissionItem[]; forecast: ForecastItem[]; summary: CommissionSummary; can_manage: boolean }>('/commissions',
      { status: f.status, type: f.type, beneficiary: f.beneficiary, from: f.from, to: f.to, scope: f.scope })
    items.value = r.items; forecast.value = r.forecast; summary.value = r.summary; canManage.value = r.can_manage
  } catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
watch(() => [f.status, f.type, f.beneficiary, f.from, f.to, f.scope], load)
const beneficiaries = computed(() => {
  const m = new Map<string, string>()
  for (const c of items.value) if (c.beneficiary) m.set(c.beneficiary_id, c.beneficiary.full_name)
  if (f.beneficiary && !m.has(f.beneficiary)) m.set(f.beneficiary, '(selecionado)')
  return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
})
const listTotal = computed(() => items.value.reduce((a, c) => a + Number(c.amount ?? 0), 0))
const forecastTotal = computed(() => forecast.value.reduce((a, c) => a + Number(c.amount ?? 0), 0))

// ----- pagamentos -----
const pays = ref<CommissionPayment[]>([])
const paysTotal = ref(0)
const pf = reactive({ from: '', to: '' })
async function loadPays() {
  try { const r = await api.get<{ items: CommissionPayment[]; total: number }>('/commissions/payments', { from: pf.from, to: pf.to }); pays.value = r.items; paysTotal.value = r.total }
  catch (e) { toast.error(errorMessage(e)) }
}
watch(() => [pf.from, pf.to], loadPays)

// ----- regras -----
const rules = ref<CommissionRule[]>([])
const stages = ref<Stage[]>([])
async function loadRules() {
  if (!auth.isManager.value) return
  try {
    const [r, s] = await Promise.all([api.get<{ items: CommissionRule[] }>('/admin/commission-rules'), stages.value.length ? null : api.get<{ items: Stage[] }>('/crm/stages')])
    rules.value = r.items; if (s) stages.value = s.items
  } catch (e) { toast.error(errorMessage(e)) }
}
const triggerStages = computed(() => stages.value.filter((s) => s.active && !s.is_lost).sort((a, b) => a.position - b.position))
const blank = () => ({ id: '', name: '', beneficiary_type: 'external', source: 'referral', referral_origin: 'any', role: '', trigger_stage: 'aquisicao_concluida', base: 'deal_value',
  percent: '' as string | number, fixed_amount: null as number | null, max_amount: null as number | null, payment_days: 30 as number | string, payment_terms: '', valid_from: '', valid_to: '', active: true })
const rf = reactive({ open: false, busy: false, errors: {} as Record<string, string>, data: blank() })
function editRule(r?: CommissionRule) {
  rf.errors = {}
  rf.data = r ? { id: r.id, name: r.name, beneficiary_type: r.beneficiary_type, source: r.source, referral_origin: r.referral_origin ?? 'any', role: r.role ?? '', trigger_stage: r.trigger_stage, base: r.base,
    percent: r.percent ?? '', fixed_amount: r.fixed_amount === null ? null : Number(r.fixed_amount), max_amount: r.max_amount === null ? null : Number(r.max_amount),
    payment_days: r.payment_days, payment_terms: r.payment_terms ?? '', valid_from: r.valid_from ?? '', valid_to: r.valid_to ?? '', active: r.active } : blank()
  rf.open = true
}
watch(() => rf.data.beneficiary_type, (v) => { if (v === 'external') { rf.data.source = 'referral'; rf.data.role = '' } })
watch(() => rf.data.source, (v) => { if (v === 'referral') rf.data.referral_origin = 'any' })
async function saveRule() {
  rf.busy = true; rf.errors = {}
  const { id, ...d } = rf.data
  const body = { ...d, percent: d.percent === '' ? null : Number(d.percent), payment_days: Number(d.payment_days), role: d.role || null }
  try {
    if (id) await api.put(`/admin/commission-rules/${id}`, body); else await api.post('/admin/commission-rules', body)
    toast.success(id ? 'Regra atualizada. Comissões já geradas mantêm a regra da época.' : 'Regra criada.'); rf.open = false; await Promise.all([loadRules(), load()])
  } catch (e) {
    if (e instanceof ApiError && e.data.errors) rf.errors = e.data.errors as Record<string, string>
    toast.error(errorMessage(e))
  } finally { rf.busy = false }
}
async function toggleRule(r: CommissionRule) {
  try { await api.put(`/admin/commission-rules/${r.id}`, { active: !r.active }); toast.success(r.active ? 'Regra desativada.' : 'Regra ativada.'); await Promise.all([loadRules(), load()]) }
  catch (e) { toast.error(errorMessage(e)) }
}
function ruleCalc(r: { percent: number | null; fixed_amount: number | null; max_amount: number | null }) {
  const p: string[] = []
  if (r.percent) p.push(`${Number(r.percent).toLocaleString('pt-BR')}%`)
  if (r.fixed_amount) p.push(`${p.length ? '+ ' : ''}${fmtBRL(Number(r.fixed_amount))}`)
  const calc = p.join(' ')
  return r.max_amount ? `${calc} · teto ${fmtBRL(Number(r.max_amount))}` : calc
}
const INTERNAL_ROLES = ['colaborador', 'gestor_comercial', 'admin'] as const

// ----- detalhe -----
const openId = ref<string | null>(route.query.id ? String(route.query.id) : null)
watch(() => route.query.id, (v) => { openId.value = v ? String(v) : null })
function openC(id: string) { openId.value = id; router.replace({ query: { ...route.query, id } }) }
function closeC() { openId.value = null; const q = { ...route.query }; delete q.id; router.replace({ query: q }) }

onMounted(() => { load(); loadPays(); loadRules() })
function card(status: string) { tab.value = 'comissoes'; f.status = f.status === status ? '' : status }
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <div class="eyebrow">Comercial</div>
        <h1>Comissões</h1>
        <p v-if="auth.isManager.value">Comissões de parceiros e da equipe, geradas quando o negócio chega à etapa definida nas regras. Simular ou formalizar interesse não gera comissão.</p>
        <p v-else>Suas comissões previstas, geradas e pagas.</p>
      </div>
      <div v-if="auth.isManager.value" class="row">
        <SegmentedControl v-model="f.scope" name="scope" :options="[{ value: '', label: 'Todas' }, { value: 'me', label: 'Minhas' }]" />
      </div>
    </div>

    <div v-if="summary" class="kpis">
      <button class="card kpi" :class="{ sel: tab === 'previstas' }" @click="tab = 'previstas'"><div class="kpi-label">Previstas</div><div class="kpi-value sm">{{ fmtBRLShort(summary.prevista.total) }}</div><div class="kpi-foot">{{ summary.prevista.n }} em oportunidades abertas</div></button>
      <button class="card kpi info" :class="{ sel: f.status === 'gerada' }" @click="card('gerada')"><div class="kpi-label">A aprovar</div><div class="kpi-value sm">{{ fmtBRLShort(summary.gerada.total) }}</div><div class="kpi-foot">{{ summary.gerada.n }} gerada(s)</div></button>
      <button class="card kpi warn" :class="{ sel: f.status === 'aprovada' }" @click="card('aprovada')"><div class="kpi-label">A pagar</div><div class="kpi-value sm">{{ fmtBRLShort(summary.pendente.total - summary.gerada.total) }}</div><div class="kpi-foot">{{ summary.aprovada.n }} aprovada(s)<template v-if="summary.overdue"> · <b class="late">{{ summary.overdue }} atrasada(s)</b></template></div></button>
      <button class="card kpi ok" :class="{ sel: f.status === 'paga' }" @click="card('paga')"><div class="kpi-label">Pagas</div><div class="kpi-value sm">{{ fmtBRLShort(summary.paid_total) }}</div><div class="kpi-foot">{{ summary.paga.n }} quitada(s)</div></button>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'comissoes' }" @click="tab = 'comissoes'">Comissões</button>
      <button class="tab" :class="{ active: tab === 'previstas' }" @click="tab = 'previstas'">Previstas ({{ forecast.length }})</button>
      <button class="tab" :class="{ active: tab === 'pagamentos' }" @click="tab = 'pagamentos'">Pagamentos</button>
      <button v-if="auth.isManager.value" class="tab" :class="{ active: tab === 'regras' }" @click="tab = 'regras'">Regras ({{ rules.length }})</button>
    </div>

    <!-- COMISSÕES -->
    <template v-if="tab === 'comissoes'">
      <div class="card filters">
        <select v-model="f.status" class="select" aria-label="Situação">
          <option value="">Todas as situações</option>
          <option value="pendente">Pendentes (gerada ou aprovada)</option>
          <option value="atrasada">Pagamento atrasado</option>
          <option v-for="(l, k) in COMMISSION_STATUS_LABEL" :key="k" :value="k">{{ l }}</option>
        </select>
        <template v-if="auth.isManager.value">
          <select v-model="f.type" class="select" aria-label="Tipo"><option value="">Parceiros e equipe</option><option value="external">Parceiros</option><option value="internal">Equipe interna</option></select>
          <select v-model="f.beneficiary" class="select" aria-label="Beneficiário"><option value="">Todos os beneficiários</option><option v-for="[id, n] in beneficiaries" :key="id" :value="id">{{ n }}</option></select>
        </template>
        <label class="row small">De <input v-model="f.from" type="date" class="input date"></label>
        <label class="row small">Até <input v-model="f.to" type="date" class="input date"></label>
        <span v-if="items.length" class="small muted grow" style="text-align:right">{{ items.length }} comissão(ões) · {{ fmtBRL(listTotal) }}</span>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Gerada em</th><th>Provedor</th><th>Beneficiário</th><th>Regra</th><th class="r">Valor</th><th class="r">Pago</th><th>Previsão</th><th>Situação</th></tr></thead>
          <tbody>
            <tr v-if="loading && !items.length"><td colspan="8" class="empty"><span class="spinner" /></td></tr>
            <tr v-else-if="!items.length"><td colspan="8" class="empty">Nenhuma comissão encontrada.</td></tr>
            <tr v-for="c in items" :key="c.id" class="clickable" @click="openC(c.id)">
              <td class="nowrap">{{ fmtDate(c.generated_at) }}</td>
              <td><div class="t-strong">{{ c.opp_name }}</div><div v-if="c.opp?.isp" class="small muted">{{ c.opp.isp.city }}/{{ c.opp.isp.state }}</div></td>
              <td>{{ c.beneficiary?.full_name }}<div class="small muted">{{ BENEFICIARY_TYPE_LABEL[c.beneficiary_type] }}</div></td>
              <td class="small">{{ c.rule_snapshot?.name }}</td>
              <td class="r nowrap"><strong class="money">{{ c.amount === null ? 'A definir' : fmtBRL(c.amount) }}</strong></td>
              <td class="r nowrap">{{ fmtBRL(c.paid_amount) }}</td>
              <td class="nowrap" :class="{ late: c.overdue }">{{ c.status === 'paga' || c.status === 'cancelada' ? '—' : fmtDay(c.due_date) }}</td>
              <td><span class="badge" :class="COMMISSION_STATUS_TONE[c.status]">{{ COMMISSION_STATUS_LABEL[c.status] }}</span>
                <span v-if="c.overdue" class="badge danger" style="margin-left:.3rem">Atrasada</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- PREVISTAS -->
    <template v-else-if="tab === 'previstas'">
      <div class="alert info small" style="margin-bottom:1rem"><AppIcon name="info" :size="18" />
        <span>Projeção das comissões das oportunidades em aberto, caso cheguem à etapa da regra. Enquanto o valor do negócio não é informado, a projeção usa a média da faixa estimada pelo simulador. Nada aqui é devido.</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Provedor</th><th>Etapa atual</th><th>Beneficiário</th><th>Regra</th><th>Gera em</th><th v-if="auth.isManager.value" class="r">Base</th><th class="r">Previsto</th></tr></thead>
          <tbody>
            <tr v-if="!forecast.length"><td :colspan="auth.isManager.value ? 7 : 6" class="empty">Nenhuma comissão prevista. {{ auth.isManager.value && !rules.some((r) => r.active) ? 'Cadastre as regras na aba Regras.' : '' }}</td></tr>
            <tr v-for="x in forecast" :key="`${x.opportunity_id}-${x.rule_id}-${x.beneficiary_id}`" class="clickable" @click="navigateTo(`/crm/oportunidades?id=${x.opportunity_id}`)">
              <td class="t-strong">{{ x.opp_name }}</td>
              <td class="small">{{ x.stage }}</td>
              <td>{{ x.beneficiary_name }}<div class="small muted">{{ BENEFICIARY_TYPE_LABEL[x.beneficiary_type] }}</div></td>
              <td class="small">{{ x.rule_name }}</td>
              <td class="small">{{ x.trigger }}</td>
              <td v-if="auth.isManager.value" class="r nowrap">{{ x.base_value === null ? '—' : fmtBRLShort(x.base_value) }}<div v-if="x.estimated" class="small muted">estimativa</div></td>
              <td class="r nowrap"><strong class="money">{{ x.amount === null ? '—' : fmtBRL(x.amount) }}</strong></td>
            </tr>
          </tbody>
          <tfoot v-if="forecast.length"><tr><td :colspan="auth.isManager.value ? 6 : 5" class="r small muted">Total previsto</td><td class="r nowrap"><strong>{{ fmtBRL(forecastTotal) }}</strong></td></tr></tfoot>
        </table>
      </div>
    </template>

    <!-- PAGAMENTOS -->
    <template v-else-if="tab === 'pagamentos'">
      <div class="card filters">
        <label class="row small">De <input v-model="pf.from" type="date" class="input date"></label>
        <label class="row small">Até <input v-model="pf.to" type="date" class="input date"></label>
        <span class="small muted grow" style="text-align:right">{{ pays.length }} pagamento(s) · <strong>{{ fmtBRL(paysTotal) }}</strong></span>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Data</th><th>Beneficiário</th><th>Provedor</th><th>Forma</th><th>Referência</th><th class="r">Valor</th></tr></thead>
          <tbody>
            <tr v-if="!pays.length"><td colspan="6" class="empty">Nenhum pagamento no período.</td></tr>
            <tr v-for="p in pays" :key="p.id" class="clickable" @click="p.commission && openC(p.commission.id)">
              <td class="nowrap">{{ fmtDay(p.paid_at) }}</td>
              <td>{{ p.commission?.beneficiary?.full_name }}<div class="small muted">{{ BENEFICIARY_TYPE_LABEL[p.commission?.beneficiary_type ?? ''] }}</div></td>
              <td>{{ p.commission?.opp?.isp?.trade_name ?? p.commission?.opp?.prospect_name }}</td>
              <td>{{ PAY_METHOD_LABEL[p.method] ?? p.method }}</td>
              <td class="small mono">{{ p.reference ?? '—' }}</td>
              <td class="r nowrap"><strong class="money">{{ fmtBRL(p.amount) }}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- REGRAS -->
    <template v-else-if="tab === 'regras'">
      <div class="row between" style="margin-bottom:1rem">
        <p class="small muted" style="margin:0;max-width:720px">Cada regra define quem recebe, em qual etapa do funil a comissão é gerada e como o valor é calculado. Alterar uma regra vale só para comissões futuras: as já geradas guardam a regra da época.</p>
        <button v-if="canManage" class="btn btn-sm" @click="editRule()"><AppIcon name="plus" :size="16" /> Nova regra</button>
      </div>
      <details class="card tips">
        <summary><AppIcon name="info" :size="16" /> Exemplos de configuração</summary>
        <ul class="small">
          <li><b>Parceiro que indicou:</b> Quem recebe = Parceiros · Direito por = Indicação.</li>
          <li><b>Membro da equipe cujo código foi usado no cadastro:</b> Quem recebe = Equipe interna · Direito por = Indicação.</li>
          <li><b>Bônus para quem atende indicações de parceiros:</b> Quem recebe = Equipe interna · Direito por = Atendimento · Vale para = Indicados por parceiro externo.</li>
          <li>Se a mesma pessoa indicou e atendeu, ela recebe as duas regras que se aplicarem.</li>
        </ul>
      </details>
      <div v-if="!rules.length" class="card empty">Nenhuma regra cadastrada. Sem regras, nenhuma comissão é gerada.</div>
      <div class="rules">
        <article v-for="r in rules" :key="r.id" class="card rule" :class="{ off: !r.active }">
          <div class="row between">
            <strong>{{ r.name }}</strong>
            <span class="badge" :class="r.active ? 'success' : 'plain'">{{ r.active ? 'Ativa' : 'Inativa' }}</span>
          </div>
          <div class="calc">{{ ruleCalc(r) }}</div>
          <dl class="dl small">
            <dt>Quem recebe</dt><dd>{{ BENEFICIARY_TYPE_LABEL[r.beneficiary_type] }} · {{ COMMISSION_SOURCE_LABEL[r.source] }}<template v-if="r.role"> ({{ ROLE_LABEL[r.role as keyof typeof ROLE_LABEL] }})</template></dd>
            <template v-if="r.source === 'assignee'"><dt>Vale para</dt><dd>{{ REFERRAL_ORIGIN_LABEL[r.referral_origin] }}</dd></template>
            <dt>Gera em</dt><dd>{{ r.trigger?.name ?? r.trigger_stage }}</dd>
            <dt>Base</dt><dd>{{ COMMISSION_BASE_LABEL[r.base] }}</dd>
            <dt>Pagamento</dt><dd>até {{ r.payment_days }} dias após a aprovação</dd>
            <template v-if="r.valid_from || r.valid_to"><dt>Vigência</dt><dd>{{ r.valid_from ? fmtDay(r.valid_from) : 'início' }} a {{ r.valid_to ? fmtDay(r.valid_to) : 'sem fim' }}</dd></template>
            <dt>Uso</dt><dd>{{ r.commissions }} comissão(ões)</dd>
          </dl>
          <div v-if="canManage" class="row end">
            <button class="btn btn-ghost btn-sm" @click="toggleRule(r)">{{ r.active ? 'Desativar' : 'Ativar' }}</button>
            <button class="btn btn-outline btn-sm" @click="editRule(r)"><AppIcon name="edit" :size="16" /> Editar</button>
          </div>
        </article>
      </div>
    </template>

    <CommissionDrawer :id="openId" @close="closeC" @changed="load(); loadPays()" />

    <AppModal :open="rf.open" :title="rf.data.id ? 'Editar regra de comissão' : 'Nova regra de comissão'" :width="720" @close="rf.open = false">
      <div class="form-grid">
        <div class="field full"><label for="rn">Nome<span class="req">*</span></label><input id="rn" v-model="rf.data.name" class="input" placeholder="Ex.: Parceiros — aquisição concluída">
          <span v-if="rf.errors.name" class="err">{{ rf.errors.name }}</span></div>
        <div class="field"><label for="rbt">Quem recebe<span class="req">*</span></label>
          <select id="rbt" v-model="rf.data.beneficiary_type" class="select"><option value="external">Parceiros</option><option value="internal">Equipe interna</option></select></div>
        <div class="field"><label for="rsrc">Direito por</label>
          <select id="rsrc" v-model="rf.data.source" class="select" :disabled="rf.data.beneficiary_type === 'external'">
            <option value="referral">Indicação (dono do código)</option>
            <option value="assignee">Atendimento (responsável)</option>
          </select><span v-if="rf.errors.source" class="err">{{ rf.errors.source }}</span>
          <span v-else-if="rf.data.beneficiary_type === 'external'" class="hint">Parceiros recebem somente por indicação. Comissão por atendimento é exclusiva da equipe interna.</span></div>
        <div v-if="rf.data.source === 'assignee'" class="field"><label for="rorig">Vale para provedores</label>
          <select id="rorig" v-model="rf.data.referral_origin" class="select"><option v-for="(l, k) in REFERRAL_ORIGIN_LABEL" :key="k" :value="k">{{ l }}</option></select>
          <span class="hint">Ex.: incentivar a equipe a atender as indicações de parceiros externos.</span></div>
        <div v-if="rf.data.beneficiary_type === 'internal'" class="field"><label for="rrole">Somente o perfil</label>
          <select id="rrole" v-model="rf.data.role" class="select"><option value="">Qualquer perfil interno</option><option v-for="k in INTERNAL_ROLES" :key="k" :value="k">{{ ROLE_LABEL[k] }}</option></select></div>
        <div class="field"><label for="rts">Gera a comissão na etapa<span class="req">*</span></label>
          <select id="rts" v-model="rf.data.trigger_stage" class="select"><option v-for="s in triggerStages" :key="s.key" :value="s.key">{{ s.position }}. {{ s.name }}</option></select>
          <span v-if="rf.errors.trigger_stage" class="err">{{ rf.errors.trigger_stage }}</span></div>
        <div class="field"><label for="rbase">Base de cálculo</label>
          <select id="rbase" v-model="rf.data.base" class="select"><option v-for="(l, k) in COMMISSION_BASE_LABEL" :key="k" :value="k">{{ l }}</option></select></div>
        <div class="field"><label for="rpct">Percentual (%)</label><input id="rpct" v-model="rf.data.percent" class="input" type="number" min="0" max="100" step="0.01" placeholder="Ex.: 2">
          <span v-if="rf.errors.percent" class="err">{{ rf.errors.percent }}</span></div>
        <div class="field"><label for="rfix">Valor fixo</label><MoneyInput id="rfix" v-model="rf.data.fixed_amount" /><span class="hint">Somado ao percentual.</span></div>
        <div class="field"><label for="rmax">Teto por comissão</label><MoneyInput id="rmax" v-model="rf.data.max_amount" placeholder="Sem teto" /></div>
        <div class="field"><label for="rdays">Prazo de pagamento (dias)</label><input id="rdays" v-model="rf.data.payment_days" class="input" type="number" min="0" max="365">
          <span v-if="rf.errors.payment_days" class="err">{{ rf.errors.payment_days }}</span><span v-else class="hint">Contado a partir da aprovação.</span></div>
        <div class="field"><label for="rvf">Vigência: início</label><input id="rvf" v-model="rf.data.valid_from" class="input" type="date"></div>
        <div class="field"><label for="rvt">Vigência: fim</label><input id="rvt" v-model="rf.data.valid_to" class="input" type="date"></div>
        <div class="field full"><label for="rterm">Condições de pagamento</label><textarea id="rterm" v-model="rf.data.payment_terms" class="textarea" rows="2" style="min-height:60px" placeholder="Visível ao beneficiário. Ex.: Pagamento após assinatura do contrato e emissão de nota fiscal." /></div>
        <label class="check small full"><input v-model="rf.data.active" type="checkbox"> Regra ativa</label>
      </div>
      <template #footer>
        <button class="btn btn-ghost" @click="rf.open = false">Cancelar</button>
        <button class="btn" :disabled="rf.busy" @click="saveRule"><span v-if="rf.busy" class="spinner" /> Salvar regra</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
.kpis .kpi { text-align: left; border: 1px solid var(--line); cursor: pointer; font: inherit; display: flex; flex-direction: column; justify-content: flex-start; }
.kpis .kpi.sel { border-color: var(--blue); box-shadow: 0 0 0 2px var(--blue-100); }
.kpi.info::before { background: var(--blue); }
.kpi-value.sm { font-size: 1.45rem; }
.filters { display: flex; gap: .75rem; padding: .85rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
.filters .select { width: auto; min-width: 160px; }
.date { width: auto; min-height: 40px; }
.money { color: var(--navy); }
.r { text-align: right; }
.late { color: var(--danger); font-weight: 600; }
tfoot td { border-top: 2px solid var(--line); }
.rules { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }
.rule { padding: 1.1rem 1.2rem; display: grid; gap: .6rem; align-content: start; }
.rule.off { opacity: .65; }
.tips { padding: .8rem 1rem; margin-bottom: 1rem; }
.tips summary { cursor: pointer; font-weight: 600; color: var(--navy); display: flex; align-items: center; gap: .4rem; }
.tips ul { margin: .6rem 0 0; padding-left: 1.2rem; display: grid; gap: .3rem; }
.calc { font-family: var(--font-head); font-size: 1.25rem; font-weight: 800; color: var(--navy); }
.err { color: var(--danger); font-size: .8rem; }
@media (max-width: 900px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .filters .select, .filters label, .filters .date { width: 100%; } .filters .date { flex: 1; } .kpi-value.sm { font-size: 1.2rem; } }
</style>
