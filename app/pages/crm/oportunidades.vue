<script setup lang="ts">
import type { Assignee, OppItem, Stage } from '~/utils/simulator'
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial', 'colaborador'] })
useHead({ title: 'Funil comercial · DealSourcing' })

interface Summary { open: number; queue: number; overdue: number; stale: number; mine: number }
const api = useApi()
const toast = useToast()
const auth = useAuth()
const route = useRoute()
const router = useRouter()

const view = ref<'kanban' | 'tabela' | 'fila'>((['kanban', 'tabela', 'fila'] as const).find((v) => v === route.query.visao) ?? (route.query.alert === 'queue' ? 'fila' : 'kanban'))
const f = reactive({
  q: '', assigned: auth.isManager.value ? '' : 'me', priority: '', state: '', origin: '',
  alert: String(route.query.alert ?? '') === 'queue' ? '' : String(route.query.alert ?? ''), status: 'open',
})
const items = ref<OppItem[]>([])
const summary = ref<Summary>({ open: 0, queue: 0, overdue: 0, stale: 0, mine: 0 })
const stages = ref<Stage[]>([])
const assignees = ref<Assignee[]>([])
const loading = ref(false)
const showClosed = ref(false)

async function loadMeta() {
  const [s, a] = await Promise.all([
    api.get<{ items: Stage[] }>('/crm/stages'),
    api.get<{ items: Assignee[] }>('/crm/assignees').catch(() => ({ items: [] as Assignee[] })),
  ])
  stages.value = s.items; assignees.value = a.items
}
async function load() {
  loading.value = true
  try {
    const status = view.value === 'kanban' ? (showClosed.value ? 'all' : 'open') : view.value === 'fila' ? 'open' : f.status
    const r = await api.get<{ items: OppItem[]; summary: Summary }>('/crm/opportunities', {
      ...f, status, alert: view.value === 'fila' ? 'queue' : f.alert,
    })
    items.value = r.items; summary.value = r.summary
    for (const o of r.items) if (quick[o.id] === undefined) quick[o.id] = ''
  } catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
let deb: ReturnType<typeof setTimeout> | undefined
watch(() => f.q, () => { clearTimeout(deb); deb = setTimeout(load, 300) })
watch(() => [f.assigned, f.priority, f.state, f.origin, f.alert, f.status, view.value, showClosed.value], load)
watch(view, (v) => router.replace({ query: { ...route.query, visao: v, alert: undefined } }))
onMounted(async () => { await loadMeta().catch((e) => toast.error(errorMessage(e))); await load() })

// ----- ficha -----
const openId = ref<string | null>(route.query.id ? String(route.query.id) : null)
watch(() => route.query.id, (v) => { openId.value = v ? String(v) : null })
function openOpp(id: string) { openId.value = id; router.replace({ query: { ...route.query, id } }) }
function closeOpp() { openId.value = null; router.replace({ query: { ...route.query, id: undefined } }) }
async function onChanged() { await Promise.all([load(), loadMeta()]) }

// ----- kanban -----
const columns = computed(() => stages.value
  .filter((s) => s.active && (showClosed.value || (!s.is_won && !s.is_lost)))
  .sort((a, b) => a.position - b.position)
  .map((s) => ({ stage: s, items: items.value.filter((o) => o.stage_key === s.key) })))
const canEdit = (o: OppItem) => auth.isManager.value || o.assigned_to === auth.profile.value?.id || (o.created_by === auth.profile.value?.id && !o.assigned_to)
const dragging = ref<OppItem | null>(null)
const over = ref('')
const pendingMove = reactive({ opp: null as OppItem | null, stage: null as Stage | null, note: '', busy: false })
function onDrop(stage: Stage) {
  over.value = ''
  const o = dragging.value; dragging.value = null
  if (!o || o.stage_key === stage.key) return
  if (stage.requires_note || stage.is_lost) { Object.assign(pendingMove, { opp: o, stage, note: '' }); return }
  doMove(o, stage, '')
}
async function doMove(o: OppItem, stage: Stage, note: string) {
  pendingMove.busy = true
  const prev = o.stage_key
  o.stage_key = stage.key
  try {
    await api.post(`/crm/opportunities/${o.id}/move`, { stage_key: stage.key, note })
    toast.success(`${o.name} → ${stage.name}`)
    pendingMove.opp = null
    await load()
  } catch (e) { o.stage_key = prev; toast.error(errorMessage(e)) } finally { pendingMove.busy = false }
}

// ----- fila: atribuição rápida -----
const quick = reactive<Record<string, string>>({})
async function quickAssign(o: OppItem) {
  const user = quick[o.id]
  if (!user) return
  try { await api.post(`/crm/opportunities/${o.id}/assign`, { user_id: user }); toast.success(`${o.name} atribuída.`); await load(); await loadMeta() }
  catch (e) { toast.error(errorMessage(e)) }
}
const queueSorted = computed(() => [...items.value].sort((a, b) => new Date(a.first_formalized_at ?? a.last_activity_at).getTime() - new Date(b.first_formalized_at ?? b.last_activity_at).getTime()))

// ----- nova oportunidade -----
const nw = reactive({ open: false, busy: false, error: '', prospect_name: '', prospect_cnpj: '', prospect_city: '', prospect_state: '', prospect_contact: '', prospect_phone: '', prospect_email: '', client_base_estimate: '' as string | number, stage_key: 'isp_identificado', priority: 'normal', assigned_to: '', next_step: '', due_at: '', notes: '' })
const nwErrors = ref<Record<string, string>>({})
function openNew() {
  Object.assign(nw, { open: true, error: '', prospect_name: '', prospect_cnpj: '', prospect_city: '', prospect_state: '', prospect_contact: '', prospect_phone: '', prospect_email: '', client_base_estimate: '', stage_key: 'isp_identificado', priority: 'normal', assigned_to: auth.isManager.value ? '' : (auth.profile.value?.id ?? ''), next_step: 'Fazer o primeiro contato', due_at: '', notes: '' })
  nwErrors.value = {}
}
async function createOpp() {
  nw.error = ''; nwErrors.value = {}
  if (nw.prospect_cnpj && !isCNPJ(nw.prospect_cnpj)) { nwErrors.value.prospect_cnpj = 'CNPJ inválido.'; return }
  nw.busy = true
  try {
    const r = await api.post<{ id: string }>('/crm/opportunities', {
      ...nw, prospect_cnpj: onlyDigits(nw.prospect_cnpj), prospect_phone: onlyDigits(nw.prospect_phone), due_at: fromLocalInput(nw.due_at),
    })
    toast.success('Oportunidade criada.'); nw.open = false
    await load(); openOpp(r.id)
  } catch (e) {
    if (e instanceof ApiError && e.data.errors) nwErrors.value = e.data.errors as Record<string, string>
    nw.error = errorMessage(e)
  } finally { nw.busy = false }
}
const chips = computed(() => [
  { key: '', label: 'Em aberto', n: summary.value.open },
  { key: 'overdue', label: 'Prazo vencido', n: summary.value.overdue, tone: 'danger' },
  { key: 'stale', label: 'Paradas', n: summary.value.stale, tone: 'warning' },
])
</script>

<template>
  <div>
    <div class="page-head">
      <div><div class="eyebrow">Comercial</div><h1>Funil comercial</h1>
        <p>Acompanhe cada oportunidade da prospecção à aquisição.</p></div>
      <button class="btn" @click="openNew"><AppIcon name="plus" :size="18" /> Nova oportunidade</button>
    </div>

    <div class="topbar">
      <div class="seg-view" role="tablist">
        <button :class="{ on: view === 'kanban' }" @click="view = 'kanban'"><AppIcon name="dashboard" :size="16" /> Kanban</button>
        <button :class="{ on: view === 'tabela' }" @click="view = 'tabela'"><AppIcon name="menu" :size="16" /> Tabela</button>
        <button :class="{ on: view === 'fila' }" @click="view = 'fila'"><AppIcon name="clock" :size="16" /> Fila de atendimento <span v-if="summary.queue" class="cnt">{{ summary.queue }}</span></button>
      </div>
      <div v-if="view !== 'fila'" class="chips">
        <button v-for="c in chips" :key="c.key" class="chip" :class="[{ on: f.alert === c.key }, c.tone]" @click="f.alert = c.key">{{ c.label }} <b>{{ c.n }}</b></button>
      </div>
    </div>

    <div class="card filters">
      <div class="f-search"><AppIcon name="search" :size="18" /><input v-model="f.q" class="input" placeholder="Buscar por provedor, cidade, contato ou CNPJ" aria-label="Buscar"></div>
      <select v-model="f.assigned" class="select" aria-label="Responsável">
        <option v-if="auth.isManager.value" value="">Todos os responsáveis</option>
        <option value="me">Minhas oportunidades</option>
        <option v-if="auth.isManager.value" value="none">Sem responsável</option>
        <template v-if="auth.isManager.value"><option v-for="a in assignees" :key="a.id" :value="a.id">{{ a.full_name }}</option></template>
        <option v-if="!auth.isManager.value" value="">Todas as que posso ver</option>
      </select>
      <select v-model="f.priority" class="select sm" aria-label="Prioridade"><option value="">Prioridade</option><option v-for="(l, k) in PRIORITY_LABEL" :key="k" :value="k">{{ l }}</option></select>
      <select v-model="f.origin" class="select sm" aria-label="Origem"><option value="">Origem</option><option v-for="(l, k) in ORIGIN_LABEL" :key="k" :value="k">{{ l }}</option></select>
      <select v-model="f.state" class="select xs" aria-label="UF"><option value="">UF</option><option v-for="u in UFS" :key="u" :value="u">{{ u }}</option></select>
      <select v-if="view === 'tabela'" v-model="f.status" class="select sm" aria-label="Situação">
        <option value="open">Em aberto</option><option value="won">Concluídas</option><option value="lost">Perdidas</option><option value="all">Todas</option>
      </select>
      <label v-if="view === 'kanban'" class="switch"><input v-model="showClosed" type="checkbox"><span class="track" /><span class="small">Mostrar encerradas</span></label>
    </div>

    <!-- KANBAN -->
    <div v-if="view === 'kanban'" class="board" :class="{ loading }">
      <section v-for="c in columns" :key="c.stage.key" class="col" :class="{ over: over === c.stage.key, won: c.stage.is_won, lost: c.stage.is_lost }"
        @dragover.prevent="over = c.stage.key" @dragleave="over = over === c.stage.key ? '' : over" @drop.prevent="onDrop(c.stage)">
        <header class="col-head">
          <span class="pos">{{ c.stage.position }}</span>
          <strong :title="c.stage.description ?? ''">{{ c.stage.name }}</strong>
          <span class="n">{{ c.items.length }}</span>
        </header>
        <div class="cards">
          <article v-for="o in c.items" :key="o.id" class="kcard" :class="{ late: o.overdue, idle: !o.overdue && o.stale, hi: o.priority === 'alta' }"
            :draggable="canEdit(o)" tabindex="0" @dragstart="dragging = o" @dragend="dragging = null; over = ''" @click="openOpp(o.id)" @keydown.enter="openOpp(o.id)">
            <div class="k1"><strong>{{ o.name }}</strong><span v-if="o.priority === 'alta'" class="badge danger plain">Alta</span></div>
            <div class="small muted">{{ o.city ? `${o.city}/${o.state}` : 'Local não informado' }}<template v-if="o.client_base"> · {{ fmtInt(o.client_base) }} clientes</template></div>
            <div v-if="o.value_min !== null" class="money small">{{ fmtBRLShort(o.value_min) }} – {{ fmtBRLShort(o.value_max) }}</div>
            <div v-if="o.next_step" class="step small"><AppIcon name="arrow-right" :size="12" /> {{ o.next_step }}</div>
            <div class="k3">
              <span class="avatar xs" :title="o.assignee?.full_name ?? 'Sem responsável'">{{ o.assignee ? initials(o.assignee.full_name) : '—' }}</span>
              <span v-if="o.in_queue" class="badge warning">Fila</span>
              <span v-if="o.overdue" class="flag late"><AppIcon name="alert" :size="12" /> {{ fmtDue(o.due_at) }}</span>
              <span v-else-if="o.stale" class="flag idle"><AppIcon name="clock" :size="12" /> {{ o.days_idle }} d parada</span>
              <span v-else-if="o.due_at" class="flag">{{ fmtDue(o.due_at) }}</span>
            </div>
          </article>
          <p v-if="!c.items.length" class="drop-hint">Arraste para cá</p>
        </div>
      </section>
    </div>

    <!-- TABELA -->
    <div v-else-if="view === 'tabela'" class="table-wrap">
      <table class="table">
        <thead><tr><th>Oportunidade</th><th>Etapa</th><th>Responsável</th><th>Prioridade</th><th>Próximo passo</th><th>Última atividade</th><th>Valor estimado</th></tr></thead>
        <tbody>
          <tr v-if="loading && !items.length"><td colspan="7" class="empty"><span class="spinner" /></td></tr>
          <tr v-else-if="!items.length"><td colspan="7" class="empty">Nenhuma oportunidade com estes filtros.</td></tr>
          <tr v-for="o in items" :key="o.id" class="clickable" tabindex="0" @click="openOpp(o.id)" @keydown.enter="openOpp(o.id)">
            <td><div class="t-strong">{{ o.name }}</div><div class="small muted">{{ o.city ? `${o.city}/${o.state}` : '—' }} · {{ ORIGIN_LABEL[o.origin] }}</div></td>
            <td class="nowrap">{{ o.stage?.name }}<div class="small muted">há {{ o.days_in_stage }} d</div></td>
            <td class="nowrap">{{ o.assignee?.full_name ?? '—' }}<div v-if="o.in_queue" class="small"><span class="badge warning">Na fila</span></div></td>
            <td><span class="badge" :class="PRIORITY_TONE[o.priority]">{{ PRIORITY_LABEL[o.priority] }}</span></td>
            <td class="small">{{ o.next_step ?? '—' }}<div v-if="o.due_at" :class="o.overdue ? 'late-txt' : 'muted'">{{ fmtDue(o.due_at) }}</div></td>
            <td class="nowrap small" :class="{ 'idle-txt': o.stale }">{{ fmtRelative(o.last_activity_at) }}</td>
            <td class="nowrap"><strong v-if="o.value_min !== null" class="money">{{ fmtBRLShort(o.value_min) }} – {{ fmtBRLShort(o.value_max) }}</strong><span v-else class="muted">—</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- FILA -->
    <div v-else class="stack">
      <div class="alert info small"><AppIcon name="info" :size="18" /> Provedores que formalizaram interesse e ainda não têm responsável, do mais antigo para o mais recente.</div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Provedor</th><th>Formalizou em</th><th>Prazo de atendimento</th><th>Valor estimado</th><th>Indicação</th><th v-if="auth.isManager.value">Atribuir a</th></tr></thead>
          <tbody>
            <tr v-if="loading && !items.length"><td colspan="6" class="empty"><span class="spinner" /></td></tr>
            <tr v-else-if="!items.length"><td colspan="6" class="empty">Fila vazia: todas as oportunidades formalizadas têm responsável.</td></tr>
            <tr v-for="o in queueSorted" :key="o.id">
              <td><button class="link-btn" @click="openOpp(o.id)">{{ o.name }}</button><div class="small muted">{{ o.city }}/{{ o.state }}</div></td>
              <td class="nowrap">{{ fmtDateTime(o.first_formalized_at) }}</td>
              <td class="nowrap"><span :class="o.overdue ? 'late-txt' : ''">{{ o.due_at ? fmtDue(o.due_at) : '—' }}</span></td>
              <td class="nowrap"><strong v-if="o.value_min !== null" class="money">{{ fmtBRLShort(o.value_min) }} – {{ fmtBRLShort(o.value_max) }}</strong></td>
              <td class="small">{{ o.isp?.referral_code ?? 'Direto' }}<div v-if="o.referrer" class="muted">{{ o.referrer.full_name }}</div></td>
              <td v-if="auth.isManager.value">
                <div class="row" style="flex-wrap:nowrap">
                  <select v-model="quick[o.id]" class="select xs-sel" :aria-label="`Responsável para ${o.name}`">
                    <option value="">Escolha…</option>
                    <option v-for="a in assignees" :key="a.id" :value="a.id">{{ a.full_name }} ({{ a.open }})</option>
                  </select>
                  <button class="btn btn-sm" :disabled="!quick[o.id]" @click="quickAssign(o)">Atribuir</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <OpportunityDrawer :id="openId" :stages="stages" :assignees="assignees" @close="closeOpp" @changed="onChanged" />

    <AppModal :open="!!pendingMove.opp" :title="`Mover para “${pendingMove.stage?.name ?? ''}”`" @close="pendingMove.opp = null">
      <div class="field"><label for="pmn">{{ pendingMove.stage?.is_lost ? 'Motivo da perda' : 'Observação' }}<span class="req">*</span></label>
        <textarea id="pmn" v-model="pendingMove.note" class="textarea" rows="3" style="min-height:80px" /></div>
      <template #footer>
        <button class="btn btn-ghost" @click="pendingMove.opp = null">Cancelar</button>
        <button class="btn" :class="{ 'btn-danger': pendingMove.stage?.is_lost }" :disabled="pendingMove.busy || pendingMove.note.trim().length < 3" @click="doMove(pendingMove.opp!, pendingMove.stage!, pendingMove.note)">Confirmar</button>
      </template>
    </AppModal>

    <AppModal :open="nw.open" title="Nova oportunidade de prospecção" :width="680" @close="nw.open = false">
      <p class="small muted" style="margin-top:0">Use para provedores identificados pela equipe que ainda não se cadastraram no portal. Para provedores já cadastrados, abra o provedor em <NuxtLink to="/crm/provedores">Provedores</NuxtLink>.</p>
      <div class="form-grid">
        <div class="field full"><label for="n-name">Nome do provedor<span class="req">*</span></label><input id="n-name" v-model="nw.prospect_name" class="input" :aria-invalid="!!nwErrors.prospect_name"><span v-if="nwErrors.prospect_name" class="error">{{ nwErrors.prospect_name }}</span></div>
        <div class="field"><label for="n-cnpj">CNPJ</label><input id="n-cnpj" class="input" :value="nw.prospect_cnpj" inputmode="numeric" :aria-invalid="!!nwErrors.prospect_cnpj" @input="nw.prospect_cnpj = maskDocument(($event.target as HTMLInputElement).value).slice(0, 18)"><span v-if="nwErrors.prospect_cnpj" class="error">{{ nwErrors.prospect_cnpj }}</span><span v-else class="hint">Liga a oportunidade quando ele se cadastrar.</span></div>
        <div class="field"><label for="n-base">Clientes (estimativa)</label><input id="n-base" v-model="nw.client_base_estimate" class="input" type="number" min="0"></div>
        <div class="field"><label for="n-city">Cidade</label><input id="n-city" v-model="nw.prospect_city" class="input"></div>
        <div class="field"><label for="n-uf">UF</label><select id="n-uf" v-model="nw.prospect_state" class="select"><option value="">—</option><option v-for="u in UFS" :key="u" :value="u">{{ u }}</option></select></div>
        <div class="field"><label for="n-ct">Contato</label><input id="n-ct" v-model="nw.prospect_contact" class="input"></div>
        <div class="field"><label for="n-ph">Telefone</label><input id="n-ph" class="input" :value="nw.prospect_phone" @input="nw.prospect_phone = maskPhone(($event.target as HTMLInputElement).value)"></div>
        <div class="field"><label for="n-em">E-mail</label><input id="n-em" v-model="nw.prospect_email" class="input" type="email"></div>
        <div class="field"><label for="n-st">Etapa inicial</label><select id="n-st" v-model="nw.stage_key" class="select"><option value="isp_identificado">ISP identificado</option><option value="primeiro_contato">Primeiro contato</option></select></div>
        <template v-if="auth.isManager.value">
          <div class="field"><label for="n-as">Responsável</label><select id="n-as" v-model="nw.assigned_to" class="select"><option value="">Sem responsável</option><option v-for="a in assignees" :key="a.id" :value="a.id">{{ a.full_name }}</option></select></div>
          <div class="field"><label for="n-pr">Prioridade</label><select id="n-pr" v-model="nw.priority" class="select"><option v-for="(l, k) in PRIORITY_LABEL" :key="k" :value="k">{{ l }}</option></select></div>
        </template>
        <div class="field"><label for="n-ns">Próximo passo</label><input id="n-ns" v-model="nw.next_step" class="input"></div>
        <div class="field"><label for="n-due">Prazo</label><input id="n-due" v-model="nw.due_at" class="input" type="datetime-local"></div>
        <div class="field full"><label for="n-notes">Observações</label><textarea id="n-notes" v-model="nw.notes" class="textarea" rows="2" style="min-height:64px" /></div>
        <div v-if="nw.error" class="alert danger full small"><AppIcon name="alert" :size="18" /> {{ nw.error }}</div>
      </div>
      <template #footer>
        <button class="btn btn-ghost" @click="nw.open = false">Cancelar</button>
        <button class="btn" :disabled="nw.busy || nw.prospect_name.trim().length < 2" @click="createOpp"><span v-if="nw.busy" class="spinner" /> Criar oportunidade</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.topbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: .9rem; }
.seg-view { display: inline-flex; border: 1px solid var(--line-strong); border-radius: var(--radius); overflow: hidden; background: #fff; }
.seg-view button { display: inline-flex; align-items: center; gap: .4rem; padding: .55rem .9rem; border: 0; border-left: 1px solid var(--line-strong); background: none; font: 600 .86rem var(--font-body); color: var(--ink-2); cursor: pointer; }
.seg-view button:first-child { border-left: 0; }
.seg-view button.on { background: var(--navy); color: #fff; }
.cnt { background: var(--danger); color: #fff; border-radius: 99px; padding: 0 .4rem; font-size: .72rem; }
.chips { display: flex; gap: .4rem; flex-wrap: wrap; }
.chip { border: 1px solid var(--line-strong); background: #fff; border-radius: 99px; padding: .35rem .75rem; font: 500 .82rem var(--font-body); color: var(--ink-2); cursor: pointer; }
.chip b { margin-left: .2rem; color: var(--navy); }
.chip.on { background: var(--blue-100); border-color: var(--blue); color: var(--blue); }
.chip.danger b { color: var(--danger); }
.chip.warning b { color: var(--warning); }
.filters { display: flex; gap: .6rem; padding: .75rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
.filters .select { width: auto; min-width: 190px; }
.filters .select.sm { min-width: 130px; }
.filters .select.xs { min-width: 80px; }
.f-search { position: relative; flex: 1; min-width: 220px; }
.f-search :deep(svg) { position: absolute; left: .8rem; top: 50%; transform: translateY(-50%); color: var(--muted); }
.f-search .input { padding-left: 2.4rem; }
/* Kanban */
.board { display: flex; gap: .75rem; overflow-x: auto; padding-bottom: 1rem; align-items: flex-start; min-height: 60vh; transition: opacity .15s; }
.board.loading { opacity: .6; }
.col { flex: 0 0 272px; background: #E9EDF5; border: 1px solid var(--line); border-radius: var(--radius-lg); display: flex; flex-direction: column; max-height: calc(100vh - 260px); }
.col.over { outline: 2px dashed var(--blue); outline-offset: -2px; background: var(--blue-100); }
.col.won .col-head { border-top-color: var(--success); }
.col.lost .col-head { border-top-color: var(--danger); }
.col-head { display: flex; align-items: center; gap: .5rem; padding: .7rem .8rem; border-top: 4px solid var(--navy); border-radius: var(--radius-lg) var(--radius-lg) 0 0; background: #fff; border-bottom: 1px solid var(--line); font-size: .86rem; color: var(--navy); }
.col-head strong { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pos { font: 700 .7rem var(--font-head); color: var(--muted); }
.n { background: var(--tint); border: 1px solid var(--line); border-radius: 99px; padding: 0 .5rem; font-size: .75rem; font-weight: 700; }
.cards { padding: .6rem; display: grid; gap: .55rem; overflow-y: auto; }
.kcard { background: #fff; border: 1px solid var(--line); border-left: 4px solid var(--line-strong); border-radius: var(--radius); padding: .65rem .7rem; cursor: pointer; display: grid; gap: .25rem; box-shadow: var(--shadow-sm); }
.kcard:hover { border-color: var(--blue); }
.kcard[draggable='true'] { cursor: grab; }
.kcard.hi { border-left-color: var(--danger); }
.kcard.late { background: #FFF8F8; }
.kcard.idle { background: #FFFCF4; }
.k1 { display: flex; justify-content: space-between; gap: .4rem; align-items: flex-start; }
.k1 strong { font-size: .9rem; color: var(--navy); line-height: 1.3; }
.money { color: var(--navy); font-weight: 700; }
.step { color: var(--ink-2); display: flex; gap: .3rem; align-items: baseline; }
.k3 { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; margin-top: .2rem; }
.avatar.xs { width: 24px; height: 24px; font-size: .62rem; }
.flag { font-size: .72rem; color: var(--muted); display: inline-flex; align-items: center; gap: .2rem; }
.flag.late { color: var(--danger); font-weight: 600; }
.flag.idle { color: var(--warning); font-weight: 600; }
.drop-hint { text-align: center; font-size: .78rem; color: var(--muted); padding: 1rem 0; margin: 0; border: 1px dashed var(--line-strong); border-radius: var(--radius); }
.late-txt { color: var(--danger); font-weight: 600; }
.idle-txt { color: var(--warning); font-weight: 600; }
.link-btn { background: none; border: 0; padding: 0; color: var(--blue); font: 700 .92rem var(--font-body); cursor: pointer; text-align: left; }
.xs-sel { min-height: 36px; padding: .3rem 2rem .3rem .6rem; font-size: .85rem; min-width: 170px; }
</style>
