<script setup lang="ts">
import type { Assignee, MeetingItem, OppItem, SimResult, Stage } from '~/utils/simulator'
interface OppCommission { id: string; status: string; amount: number | null; paid_amount: number; beneficiary_type: string; rule_snapshot: { name?: string }; beneficiary: { full_name: string } | null }

interface Activity { id: string; kind: string; outcome: string | null; event: string | null; description: string | null; occurred_at: string; user: { full_name: string } | null; data: Record<string, unknown> }
interface Attachment { id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string; uploaded_by: string; uploader: { full_name: string } | null }
interface Sim { id: string; created_at: string; status: string; client_base: number; cities: string[]; arpu: number; poles_valid_pct: number; employment_type: string; clt_pct?: number | null; regularized: string; technicians_count: number; employees_count: number; formalized_at: string | null; result: SimResult | null; version: { version: number } | null }
interface Detail {
  opportunity: OppItem; isp: Record<string, unknown> & { owner?: { full_name: string; email: string; phone: string | null } | null } | null
  simulations: Sim[]; formalizations: { id: string; simulation_id: string; formalized_at: string }[]
  activities: Activity[]; attachments: Attachment[]; contact_stats: { total: number; unanswered: number }
  can_edit: boolean; can_assign: boolean; commissions: OppCommission[]
}

const props = defineProps<{ id: string | null; stages: Stage[]; assignees: Assignee[] }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const api = useApi()
const toast = useToast()
const auth = useAuth()

const d = ref<Detail | null>(null)
const loading = ref(false)
const tab = ref<'resumo' | 'atividades' | 'simulacoes' | 'documentos' | 'reunioes'>('resumo')
const meetings = ref<MeetingItem[]>([])
const busy = ref('')
const o = computed(() => d.value?.opportunity ?? null)

async function load(keepTab = false) {
  if (!props.id) return
  loading.value = !d.value || d.value.opportunity.id !== props.id
  if (!keepTab) tab.value = 'resumo'
  try {
    const [det, mt] = await Promise.all([
      api.get<Detail>(`/crm/opportunities/${props.id}`),
      api.get<{ items: MeetingItem[] }>('/crm/meetings', { opportunity_id: props.id }).catch(() => ({ items: [] as MeetingItem[] })),
    ])
    d.value = det; meetings.value = mt.items; syncForms()
  }
  catch (e) { toast.error(errorMessage(e)); emit('close') } finally { loading.value = false }
}
watch(() => props.id, (v) => { if (v) { d.value = null; load() } }, { immediate: true })
async function refresh() { await load(true); emit('changed') }

// ----- etapa -----
const activeStages = computed(() => props.stages.filter((s) => s.active).sort((a, b) => a.position - b.position))
const stageNum = computed(() => stageNumbers(props.stages))
const move = reactive({ to: '', note: '', open: false, deal: null as number | null })
const target = computed(() => props.stages.find((s) => s.key === move.to))
function askMove(key: string) {
  if (!o.value || key === o.value.stage_key) return
  const st = props.stages.find((s) => s.key === key)
  move.to = key; move.note = ''; move.deal = o.value.deal_value ?? null
  if (st?.requires_note || st?.is_lost || st?.is_won) move.open = true
  else doMove()
}
async function doMove() {
  busy.value = 'move'
  try {
    const r = await api.post<{ to: string }>(`/crm/opportunities/${o.value!.id}/move`, { stage_key: move.to, note: move.note, deal_value: target.value?.is_won ? move.deal : undefined })
    toast.success(`Movida para "${r.to}".`); move.open = false; await refresh()
  } catch (e) { toast.error(errorMessage(e)) } finally { busy.value = '' }
}

// ----- responsável e prioridade -----
const assign = reactive({ user: '', note: '', open: false })
async function doAssign() {
  busy.value = 'assign'
  try {
    await api.post(`/crm/opportunities/${o.value!.id}/assign`, { user_id: assign.user || null, note: assign.note })
    toast.success(assign.user ? 'Responsável definido.' : 'Oportunidade devolvida para a fila.'); assign.open = false; await refresh()
  } catch (e) { toast.error(errorMessage(e)) } finally { busy.value = '' }
}
const deal = ref<number | null>(null)
async function saveDeal() {
  busy.value = 'deal'
  try { await api.patch(`/crm/opportunities/${o.value!.id}`, { deal_value: deal.value }); toast.success('Valor do negócio salvo. Comissões ainda não aprovadas foram recalculadas.'); await refresh() }
  catch (e) { toast.error(errorMessage(e)) } finally { busy.value = '' }
}
const moveOk = computed(() => (target.value?.is_won ? (move.deal ?? 0) > 0 : true) && (!(target.value?.requires_note || target.value?.is_lost) || move.note.trim().length >= 3))
async function setPriority(p: string) {
  try { await api.patch(`/crm/opportunities/${o.value!.id}`, { priority: p }); toast.success('Prioridade atualizada.'); await refresh() }
  catch (e) { toast.error(errorMessage(e)) }
}

// ----- próximo passo, observações, prospecção -----
const f = reactive({ next_step: '', due_at: '', notes: '', prospect_name: '', prospect_city: '', prospect_state: '', prospect_contact: '', prospect_phone: '', prospect_email: '', client_base_estimate: '' as string | number })
function syncForms() {
  const x = d.value!.opportunity
  Object.assign(f, {
    next_step: x.next_step ?? '', due_at: toLocalInput(x.due_at), notes: x.notes ?? '',
    prospect_name: x.prospect_name ?? '', prospect_city: x.prospect_city ?? '', prospect_state: x.prospect_state ?? '',
    prospect_contact: x.prospect_contact ?? '', prospect_phone: maskPhone(x.prospect_phone ?? ''), prospect_email: x.prospect_email ?? '',
    client_base_estimate: x.client_base_estimate ?? '',
  })
  deal.value = x.deal_value ?? null
}
async function saveSummary() {
  busy.value = 'summary'
  try {
    const body: Record<string, unknown> = { next_step: f.next_step, due_at: fromLocalInput(f.due_at), notes: f.notes, client_base_estimate: f.client_base_estimate }
    if (!o.value!.isp_id) Object.assign(body, { prospect_name: f.prospect_name, prospect_city: f.prospect_city, prospect_state: f.prospect_state,
      prospect_contact: f.prospect_contact, prospect_phone: onlyDigits(f.prospect_phone), prospect_email: f.prospect_email })
    await api.patch(`/crm/opportunities/${o.value!.id}`, body)
    toast.success('Alterações salvas.'); await refresh()
  } catch (e) { toast.error(errorMessage(e)) } finally { busy.value = '' }
}

// ----- atividades -----
const act = reactive({ kind: 'ligacao', outcome: 'realizado', description: '', occurred_at: '', next_step: '', due_at: '', error: '' })
const ACT_KINDS = ['ligacao', 'whatsapp', 'email', 'visita', 'reuniao', 'observacao']
async function addActivity() {
  act.error = ''
  busy.value = 'act'
  try {
    const body: Record<string, unknown> = { kind: act.kind, outcome: act.kind === 'observacao' ? undefined : act.outcome, description: act.description, occurred_at: fromLocalInput(act.occurred_at) }
    if (act.next_step || act.due_at) { body.next_step = act.next_step; body.due_at = fromLocalInput(act.due_at) }
    await api.post(`/crm/opportunities/${o.value!.id}/activities`, body)
    toast.success('Atividade registrada.')
    Object.assign(act, { description: '', occurred_at: '', next_step: '', due_at: '' })
    await refresh()
  } catch (e) {
    act.error = e instanceof ApiError && e.data.errors ? Object.values(e.data.errors as Record<string, string>).join(' ') : errorMessage(e)
  } finally { busy.value = '' }
}
function eventText(a: Activity): string {
  if (a.event === 'stage_change' || a.event === 'reopened') {
    const t = `${a.event === 'reopened' ? 'Reaberta' : 'Etapa'}: ${a.data.from_name ?? '—'} → ${a.data.to_name ?? '—'}`
    return a.description ? `${t} · ${a.description}` : t
  }
  return a.description ?? ''
}

// ----- documentos -----
const fileInput = ref<HTMLInputElement | null>(null)
async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) { toast.error('Arquivo maior que 10 MB.'); return }
  const fd = new FormData(); fd.append('file', file)
  busy.value = 'upload'
  try { await api.upload(`/crm/opportunities/${o.value!.id}/attachments`, fd); toast.success('Documento anexado.'); await refresh() }
  catch (err) { toast.error(errorMessage(err)) } finally { busy.value = ''; if (fileInput.value) fileInput.value.value = '' }
}
async function download(a: Attachment) {
  try { const r = await api.get<{ url: string }>(`/crm/attachments/${a.id}/url`); window.open(r.url, '_blank', 'noopener') }
  catch (e) { toast.error(errorMessage(e)) }
}
const removing = ref<Attachment | null>(null)
async function removeAtt() {
  busy.value = 'del'
  try { await api.del(`/crm/attachments/${removing.value!.id}`); toast.success('Documento removido.'); removing.value = null; await refresh() }
  catch (e) { toast.error(errorMessage(e)) } finally { busy.value = '' }
}
const canDeleteAtt = (a: Attachment) => auth.isManager.value || a.uploaded_by === auth.profile.value?.id
const formalizedIds = computed(() => new Set((d.value?.formalizations ?? []).map((x) => x.simulation_id)))
</script>

<template>
  <AppModal :open="!!id" side :width="920" :title="o?.name ?? 'Oportunidade'" @close="emit('close')">
    <div v-if="loading" class="empty"><span class="spinner" /></div>
    <div v-else-if="d && o" class="stack">
      <!-- Cabeçalho -->
      <div class="hdr">
        <div class="row">
          <span class="badge navy plain">{{ o.stage?.name }}</span>
          <span v-if="o.in_queue" class="badge warning">Na fila de atendimento</span>
          <span v-if="o.overdue" class="badge danger">Prazo vencido</span>
          <span v-else-if="o.stale" class="badge warning">Parada há {{ o.days_idle }} d</span>
          <span class="badge plain">{{ ORIGIN_LABEL[o.origin] }}</span>
          <span v-if="o.city" class="small muted">{{ o.city }}/{{ o.state }}</span>
        </div>
        <div v-if="o.value_min !== null" class="val"><span>Valor estimado</span><strong>{{ fmtBRLShort(o.value_min) }} – {{ fmtBRLShort(o.value_max) }}</strong></div>
      </div>

      <div class="ctl">
        <div class="field"><label for="op-stage">Etapa</label>
          <select id="op-stage" class="select" :value="o.stage_key" :disabled="!d.can_edit || busy === 'move'" @change="askMove(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = o.stage_key">
            <option v-for="s in activeStages" :key="s.key" :value="s.key">{{ stageNum[s.key] }}. {{ s.name }}</option>
          </select></div>
        <div class="field"><label>Responsável</label>
          <div class="row" style="flex-wrap:nowrap">
            <span class="who"><span class="avatar sm">{{ initials(o.assignee?.full_name) }}</span>{{ o.assignee?.full_name ?? 'Sem responsável' }}</span>
            <button v-if="d.can_assign" class="btn btn-outline btn-sm" @click="assign.user = o.assigned_to ?? ''; assign.note = ''; assign.open = true">{{ o.assigned_to ? 'Transferir' : 'Atribuir' }}</button>
          </div></div>
        <div class="field"><label for="op-pri">Prioridade</label>
          <select id="op-pri" class="select" :value="o.priority" :disabled="!d.can_assign" @change="setPriority(($event.target as HTMLSelectElement).value)">
            <option v-for="(l, k) in PRIORITY_LABEL" :key="k" :value="k">{{ l }}</option>
          </select></div>
      </div>
      <div v-if="o.lost_reason && o.stage?.is_lost" class="alert danger small"><AppIcon name="info" :size="18" /> Motivo da perda: {{ o.lost_reason }}</div>

      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'resumo' }" @click="tab = 'resumo'">Resumo</button>
        <button class="tab" :class="{ active: tab === 'atividades' }" @click="tab = 'atividades'">Atividades ({{ d.activities.length }})</button>
        <button v-if="o.isp_id" class="tab" :class="{ active: tab === 'simulacoes' }" @click="tab = 'simulacoes'">Simulações ({{ d.simulations.length }})</button>
        <button class="tab" :class="{ active: tab === 'reunioes' }" @click="tab = 'reunioes'">Reuniões ({{ meetings.length }})</button>
        <button class="tab" :class="{ active: tab === 'documentos' }" @click="tab = 'documentos'">Documentos ({{ d.attachments.length }})</button>
      </div>

      <!-- RESUMO -->
      <div v-if="tab === 'resumo'" class="stack">
        <section class="box">
          <div class="eyebrow">Próximo passo</div>
          <div class="form-grid">
            <div class="field"><label for="ns">O que fazer</label><input id="ns" v-model="f.next_step" class="input" :disabled="!d.can_edit" placeholder="Ex.: Enviar proposta de reunião"></div>
            <div class="field"><label for="dd">Prazo</label><input id="dd" v-model="f.due_at" class="input" type="datetime-local" :disabled="!d.can_edit">
              <span v-if="o.due_at" class="hint" :class="{ late: o.overdue }">{{ fmtDue(o.due_at) }}</span></div>
          </div>
        </section>

        <section>
          <div class="eyebrow">{{ o.isp_id ? 'Provedor' : 'Dados da prospecção' }}</div>
          <dl v-if="d.isp" class="dl">
            <dt>Nome empresarial</dt><dd>{{ d.isp.legal_name }}</dd>
            <dt>CNPJ</dt><dd>{{ fmtDocument(String(d.isp.cnpj)) }}</dd>
            <dt>Responsável</dt><dd>{{ d.isp.responsible_name }} · {{ fmtPhone(String(d.isp.phone)) }} · {{ d.isp.email }}</dd>
            <dt>Endereço</dt><dd>{{ d.isp.street }}, {{ d.isp.number }} · {{ d.isp.district }} · {{ d.isp.city }}/{{ d.isp.state }}</dd>
            <dt>Conta do portal</dt><dd>{{ d.isp.owner?.full_name }} · {{ d.isp.owner?.email }}</dd>
            <dt>Indicação</dt><dd><span class="mono">{{ d.isp.referral_code ?? 'Direto' }}</span><template v-if="o.referrer"> · {{ o.referrer.full_name }}</template></dd>
            <template v-if="o.first_formalized_at"><dt>Formalizou em</dt><dd>{{ fmtDateTime(o.first_formalized_at) }}</dd></template>
          </dl>
          <div v-else class="form-grid">
            <div class="field full"><label for="pn">Nome do provedor</label><input id="pn" v-model="f.prospect_name" class="input" :disabled="!d.can_edit"></div>
            <div class="field"><label for="pc">Cidade</label><input id="pc" v-model="f.prospect_city" class="input" :disabled="!d.can_edit"></div>
            <div class="field"><label for="pu">UF</label><select id="pu" v-model="f.prospect_state" class="select" :disabled="!d.can_edit"><option value="">—</option><option v-for="u in UFS" :key="u" :value="u">{{ u }}</option></select></div>
            <div class="field"><label for="pct">Contato</label><input id="pct" v-model="f.prospect_contact" class="input" :disabled="!d.can_edit"></div>
            <div class="field"><label for="pph">Telefone</label><input maxlength="15" id="pph" class="input" :value="f.prospect_phone" :disabled="!d.can_edit" @input="f.prospect_phone = masked($event, maskPhone)"></div>
            <div class="field"><label for="pem">E-mail</label><input id="pem" v-model="f.prospect_email" class="input" type="email" :disabled="!d.can_edit"></div>
            <div class="field"><label for="pcb">Clientes (estimativa)</label><input id="pcb" v-model="f.client_base_estimate" class="input" type="number" min="0" :disabled="!d.can_edit"></div>
            <p class="small muted full" style="margin:0">CNPJ: <span class="mono">{{ o.prospect_cnpj ? fmtDocument(o.prospect_cnpj) : 'não informado' }}</span>. Quando o provedor se cadastrar no portal com este CNPJ, a oportunidade é vinculada automaticamente.</p>
          </div>
        </section>

        <section v-if="d.can_assign" class="box stack">
          <div class="eyebrow">Negócio e comissões</div>
          <div class="row" style="align-items:flex-end">
            <div class="field" style="flex:1;min-width:200px"><label for="dv">Valor do negócio fechado</label>
              <MoneyInput id="dv" v-model="deal" :disabled="!d.can_assign" />
              <span class="hint">{{ o.deal_value_set_at ? `Informado em ${fmtDateTime(o.deal_value_set_at)}` : 'Base das comissões calculadas sobre o valor do negócio.' }}</span></div>
            <button v-if="d.can_assign" class="btn btn-outline btn-sm" style="margin-bottom:1.35rem" :disabled="busy === 'deal' || deal === (o.deal_value ?? null)" @click="saveDeal">Salvar valor</button>
          </div>
          <ul v-if="d.commissions.length" class="files">
            <li v-for="c in d.commissions" :key="c.id">
              <AppIcon name="wallet" :size="18" />
              <div class="grow"><NuxtLink :to="`/crm/comissoes?id=${c.id}`" class="link-btn">{{ c.beneficiary?.full_name }}</NuxtLink>
                <div class="small muted">{{ BENEFICIARY_TYPE_LABEL[c.beneficiary_type] }} · {{ c.rule_snapshot?.name }}</div></div>
              <strong class="small">{{ c.amount === null ? 'A definir' : fmtBRL(c.amount) }}</strong>
              <span class="badge" :class="COMMISSION_STATUS_TONE[c.status]">{{ COMMISSION_STATUS_LABEL[c.status] }}</span>
            </li>
          </ul>
          <p v-else-if="d.can_assign" class="small muted" style="margin:0">As comissões são geradas quando a oportunidade chega à etapa definida nas regras (por padrão, a venda assinada).</p>
        </section>

        <section>
          <div class="field"><label for="obs" class="eyebrow">Observações</label>
            <textarea id="obs" v-model="f.notes" class="textarea" rows="4" :disabled="!d.can_edit" placeholder="Informações importantes sobre a negociação" /></div>
        </section>
        <div v-if="d.can_edit" class="row end"><button class="btn" :disabled="busy === 'summary'" @click="saveSummary"><span v-if="busy === 'summary'" class="spinner" /> Salvar alterações</button></div>
        <p class="small muted" style="margin:0">Criada em {{ fmtDateTime(o.created_at) }}<template v-if="o.creator"> por {{ o.creator.full_name }}</template> · nesta etapa há {{ o.days_in_stage }} d · última atividade {{ fmtRelative(o.last_activity_at) }}</p>
      </div>

      <!-- ATIVIDADES -->
      <div v-else-if="tab === 'atividades'" class="stack">
        <p class="small muted" style="margin:0">{{ d.contact_stats.total }} contato(s) registrado(s) · {{ d.contact_stats.unanswered }} tentativa(s) sem resposta</p>
        <section v-if="d.can_edit" class="box stack">
          <div class="eyebrow">Registrar atividade</div>
          <div class="kinds">
            <button v-for="k in ACT_KINDS" :key="k" type="button" class="kind" :class="{ on: act.kind === k }" @click="act.kind = k">
              <AppIcon :name="ACTIVITY_KIND_ICON[k] ?? 'file'" :size="16" /> {{ ACTIVITY_KIND_LABEL[k] }}</button>
          </div>
          <div class="form-grid">
            <div v-if="act.kind !== 'observacao'" class="field"><label for="ao">Resultado</label>
              <select id="ao" v-model="act.outcome" class="select"><option v-for="(l, k) in OUTCOME_LABEL" :key="k" :value="k">{{ l }}</option></select></div>
            <div class="field"><label for="aw">Quando</label><input id="aw" v-model="act.occurred_at" class="input" type="datetime-local"><span class="hint">Em branco = agora.</span></div>
            <div class="field full"><label for="ad">Descrição</label><textarea id="ad" v-model="act.description" class="textarea" rows="2" style="min-height:64px" placeholder="O que foi conversado" /></div>
            <div class="field"><label for="an">Próximo passo (opcional)</label><input id="an" v-model="act.next_step" class="input"></div>
            <div class="field"><label for="adue">Prazo do próximo passo</label><input id="adue" v-model="act.due_at" class="input" type="datetime-local"></div>
          </div>
          <div v-if="act.error" class="alert danger small"><AppIcon name="alert" :size="18" /> {{ act.error }}</div>
          <div class="row end"><button class="btn btn-sm" :disabled="busy === 'act'" @click="addActivity"><span v-if="busy === 'act'" class="spinner" /> Registrar</button></div>
        </section>
        <ol class="timeline">
          <li v-for="a in d.activities" :key="a.id" :class="{ sys: a.kind === 'sistema' }">
            <span class="ic"><AppIcon :name="ACTIVITY_KIND_ICON[a.kind] ?? 'file'" :size="14" /></span>
            <div>
              <div class="small"><strong>{{ a.kind === 'sistema' ? eventText(a) : ACTIVITY_KIND_LABEL[a.kind] }}</strong>
                <span v-if="a.outcome" class="badge" :class="OUTCOME_TONE[a.outcome]">{{ OUTCOME_LABEL[a.outcome] }}</span></div>
              <div v-if="a.kind !== 'sistema' && a.description" class="desc">{{ a.description }}</div>
              <div class="small muted">{{ fmtDateTime(a.occurred_at) }} · {{ a.user?.full_name ?? 'Sistema' }}</div>
            </div>
          </li>
        </ol>
      </div>

      <!-- SIMULAÇÕES -->
      <div v-else-if="tab === 'simulacoes'" class="stack">
        <p v-if="!d.simulations.length" class="muted small">O provedor ainda não fez simulações.</p>
        <article v-for="s in d.simulations" :key="s.id" class="sim">
          <div class="row between">
            <strong>{{ fmtDateTime(s.created_at) }}</strong>
            <span class="badge" :class="formalizedIds.has(s.id) ? 'success' : 'info'">{{ formalizedIds.has(s.id) ? 'Interesse formalizado' : 'Simulação' }}</span>
          </div>
          <SimulationResult v-if="s.result" :result="s.result" :client-base="s.client_base" />
          <p class="small muted" style="margin:.5rem 0 0">{{ s.cities.join(', ') }} · ARPU {{ fmtBRL(s.arpu) }} · postes {{ Number(s.poles_valid_pct).toLocaleString('pt-BR') }}% · {{ s.technicians_count }} técnicos/{{ s.employees_count }} funcionários ({{ teamMix(s) }}) · regularizado: {{ s.regularized === 'SIM' ? 'sim' : 'não' }}</p>
        </article>
      </div>

      <!-- REUNIÕES -->
      <div v-else-if="tab === 'reunioes'" class="stack">
        <div v-if="d.can_edit && o.open" class="row"><NuxtLink :to="`/crm/agenda?novo=${o.id}`" class="btn btn-sm"><AppIcon name="calendar" :size="16" /> Agendar reunião</NuxtLink></div>
        <p v-if="!meetings.length" class="muted small">Nenhuma reunião registrada.</p>
        <ul v-else class="files">
          <li v-for="m in meetings" :key="m.id">
            <AppIcon :name="MEETING_MODE_ICON[m.mode] ?? 'calendar'" :size="18" />
            <div class="grow"><NuxtLink :to="`/crm/agenda?id=${m.id}`" class="link-btn">{{ m.title }}</NuxtLink>
              <div class="small muted">{{ m.starts_at ? fmtDateTime(m.starts_at) : 'Data a definir' }} · {{ m.organizer?.full_name }}</div></div>
            <span class="badge" :class="MEETING_STATUS_TONE[m.status]">{{ MEETING_STATUS_LABEL[m.status] }}</span>
          </li>
        </ul>
      </div>

      <!-- DOCUMENTOS -->
      <div v-else-if="tab === 'documentos'" class="stack">
        <div v-if="d.can_edit" class="row">
          <input ref="fileInput" type="file" class="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" @change="onFile">
          <button class="btn btn-sm" :disabled="busy === 'upload'" @click="fileInput?.click()"><span v-if="busy === 'upload'" class="spinner" /><AppIcon v-else name="plus" :size="16" /> Anexar documento</button>
          <span class="small muted">PDF, imagem, Word, Excel, CSV ou TXT · até 10 MB</span>
        </div>
        <p v-if="!d.attachments.length" class="muted small">Nenhum documento anexado.</p>
        <ul v-else class="files">
          <li v-for="a in d.attachments" :key="a.id">
            <AppIcon name="file" :size="18" />
            <div class="grow"><button class="link-btn" @click="download(a)">{{ a.file_name }}</button>
              <div class="small muted">{{ fmtBytes(a.size_bytes) }} · {{ fmtDateTime(a.created_at) }} · {{ a.uploader?.full_name }}</div></div>
            <button v-if="canDeleteAtt(a)" class="icon-btn" aria-label="Remover documento" @click="removing = a"><AppIcon name="x" :size="16" /></button>
          </li>
        </ul>
      </div>
    </div>
  </AppModal>

  <AppModal :open="move.open" :title="`Mover para “${target?.name ?? ''}”`" @close="move.open = false">
    <div class="stack">
      <template v-if="target?.is_won">
        <div class="field"><label for="mdv">Valor do negócio fechado<span class="req">*</span></label><MoneyInput id="mdv" v-model="move.deal" />
          <span class="hint">Usado no cálculo das comissões. Pode ser corrigido depois, enquanto as comissões não forem aprovadas.</span></div>
      </template>
      <div class="field"><label for="mn">{{ target?.is_lost ? 'Motivo da perda' : 'Observação' }}<span v-if="target?.requires_note || target?.is_lost" class="req">*</span></label>
        <textarea id="mn" v-model="move.note" class="textarea" rows="3" style="min-height:80px" /></div>
    </div>
    <template #footer>
      <button class="btn btn-ghost" @click="move.open = false">Cancelar</button>
      <button class="btn" :class="{ 'btn-danger': target?.is_lost }" :disabled="busy === 'move' || !moveOk" @click="doMove"><span v-if="busy === 'move'" class="spinner" /> Confirmar</button>
    </template>
  </AppModal>

  <AppModal :open="assign.open" title="Responsável pela oportunidade" @close="assign.open = false">
    <div class="stack">
      <div class="field"><label for="as">Responsável</label>
        <select id="as" v-model="assign.user" class="select">
          <option value="">Sem responsável (devolver para a fila)</option>
          <option v-for="a in assignees" :key="a.id" :value="a.id">{{ a.full_name }} · {{ a.open }} em aberto</option>
        </select></div>
      <div class="field"><label for="asn">Observação (opcional)</label><input id="asn" v-model="assign.note" class="input"></div>
      <p class="small muted" style="margin:0">A pessoa escolhida recebe uma notificação. A mudança fica registrada no histórico.</p>
    </div>
    <template #footer>
      <button class="btn btn-ghost" @click="assign.open = false">Cancelar</button>
      <button class="btn" :disabled="busy === 'assign' || assign.user === (o?.assigned_to ?? '')" @click="doAssign"><span v-if="busy === 'assign'" class="spinner" /> Salvar</button>
    </template>
  </AppModal>

  <AppModal :open="!!removing" title="Remover documento" @close="removing = null">
    <p>Remover <strong>{{ removing?.file_name }}</strong>? A remoção fica registrada no histórico.</p>
    <template #footer>
      <button class="btn btn-ghost" @click="removing = null">Cancelar</button>
      <button class="btn btn-danger" :disabled="busy === 'del'" @click="removeAtt">Remover</button>
    </template>
  </AppModal>
</template>

<style scoped>
.hdr { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.val { background: var(--navy); color: #fff; border-radius: var(--radius); padding: .45rem .8rem; text-align: right; }
.val span { display: block; font-size: .66rem; text-transform: uppercase; letter-spacing: .08em; color: #9FB0E8; }
.val strong { font-family: var(--font-head); }
.ctl { display: grid; grid-template-columns: 1.3fr 1.3fr .8fr; gap: .9rem; padding: .9rem; background: var(--tint); border: 1px solid var(--line); border-radius: var(--radius); }
.who { display: inline-flex; align-items: center; gap: .45rem; flex: 1; font-size: .9rem; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.avatar.sm { width: 28px; height: 28px; font-size: .7rem; }
.box { border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; background: var(--tint); }
.hint.late { color: var(--danger); font-weight: 600; }
.kinds { display: flex; flex-wrap: wrap; gap: .4rem; }
.kind { display: inline-flex; align-items: center; gap: .35rem; padding: .4rem .7rem; border: 1px solid var(--line-strong); border-radius: 99px; background: #fff; font: 500 .84rem var(--font-body); color: var(--ink-2); cursor: pointer; }
.kind.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: .9rem; }
.timeline li { display: flex; gap: .7rem; }
.ic { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--blue-100); color: var(--blue); }
.sys .ic { background: var(--tint); color: var(--muted); border: 1px solid var(--line); }
.sys strong { font-weight: 500; color: var(--ink-2); }
.desc { font-size: .9rem; white-space: pre-wrap; margin: .15rem 0; }
.timeline .badge { margin-left: .4rem; }
.sim { border: 1px solid var(--line); border-radius: var(--radius); padding: .9rem; display: grid; gap: .6rem; }
.files { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; }
.files li { display: flex; align-items: center; gap: .7rem; padding: .6rem .8rem; border: 1px solid var(--line); border-radius: var(--radius); }
.files li > :deep(svg) { color: var(--blue); }
.link-btn { background: none; border: 0; padding: 0; color: var(--blue); font: 600 .9rem var(--font-body); cursor: pointer; text-align: left; }
.link-btn:hover { text-decoration: underline; }
@media (max-width: 720px) { .ctl { grid-template-columns: 1fr; } }
</style>
