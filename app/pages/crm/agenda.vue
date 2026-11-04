<script setup lang="ts">
import type { Assignee, MeetingItem } from '~/utils/simulator'
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial', 'colaborador'] })
useHead({ title: 'Agenda · DealSourcing' })

const api = useApi()
const toast = useToast()
const auth = useAuth()
const route = useRoute()
const router = useRouter()
const TZ = 'America/Sao_Paulo'

const view = ref<'mes' | 'lista'>(route.query.visao === 'lista' ? 'lista' : 'mes')
const cursor = ref(new Date())
const organizer = ref(auth.isManager.value ? '' : 'me')
const status = ref('')
const items = ref<MeetingItem[]>([])
const unscheduled = ref<MeetingItem[]>([])
const pending = ref<MeetingItem[]>([])
const assignees = ref<Assignee[]>([])
const loading = ref(false)

const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })
const monthStart = computed(() => new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1))
const gridStart = computed(() => { const d = new Date(monthStart.value); d.setDate(d.getDate() - d.getDay()); return d })
const days = computed(() => Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart.value); d.setDate(d.getDate() + i); return d }))
const monthLabel = computed(() => capFirst(monthStart.value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })))

async function load() {
  loading.value = true
  const from = view.value === 'mes' ? new Date(gridStart.value) : new Date(new Date().setHours(0, 0, 0, 0))
  const to = view.value === 'mes' ? new Date(days.value[41]!.getTime() + 86400_000) : new Date(Date.now() + 90 * 86400_000)
  try {
    const r = await api.get<{ items: MeetingItem[]; unscheduled: MeetingItem[]; pending_result: MeetingItem[] }>('/crm/meetings',
      { from: from.toISOString(), to: to.toISOString(), organizer: organizer.value, status: status.value })
    items.value = r.items; unscheduled.value = r.unscheduled; pending.value = r.pending_result
  } catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
watch([view, organizer, status, cursor], load)
watch(view, (v) => router.replace({ query: { ...route.query, visao: v } }))
onMounted(async () => {
  try { assignees.value = (await api.get<{ items: Assignee[] }>('/crm/assignees')).items } catch { /* sem lista */ }
  await load()
  if (route.query.novo) openForm(String(route.query.novo))
})

const byDay = computed(() => {
  const map: Record<string, MeetingItem[]> = {}
  for (const m of items.value) if (m.starts_at) (map[dayKey(new Date(m.starts_at))] ??= []).push(m)
  return map
})
const today = dayKey(new Date())
const listGroups = computed(() => Object.entries(byDay.value).sort(([a], [b]) => a.localeCompare(b))
  .map(([k, list]) => ({ key: k, label: capFirst(new Date(`${k}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })), list })))
const time = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : ''
function shift(n: number) { const d = new Date(cursor.value); d.setMonth(d.getMonth() + n, 1); cursor.value = d }

// ----- detalhes e formulário -----
const openId = ref<string | null>(route.query.id ? String(route.query.id) : null)
watch(() => route.query.id, (v) => { openId.value = v ? String(v) : null })
function openMeeting(id: string) { openId.value = id; router.replace({ query: { ...route.query, id } }) }
function closeMeeting() { openId.value = null; router.replace({ query: { ...route.query, id: undefined } }) }
const form = reactive({ open: false, meeting: null as MeetingItem | null, opp: null as string | null, date: null as string | null })
function openForm(oppId: string | null = null, date: string | null = null) { Object.assign(form, { open: true, meeting: null, opp: oppId, date }) }
function editMeeting(m: MeetingItem) { Object.assign(form, { open: true, meeting: m, opp: null, date: null }) }
async function onSaved(id: string) {
  form.open = false
  if (route.query.novo) router.replace({ query: { ...route.query, novo: undefined } })
  await load(); openId.value = null; await nextTick(); openMeeting(id)
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><div class="eyebrow">Visão geral</div><h1>Agenda de reuniões</h1><p>Reuniões com provedores, do agendamento ao resultado.</p></div>
      <button class="btn" @click="openForm()"><AppIcon name="plus" :size="18" /> Agendar reunião</button>
    </div>

    <div v-if="pending.length" class="alert warning pend">
      <AppIcon name="alert" :size="18" />
      <div><strong>{{ pending.length }} reunião(ões) aguardando registro do resultado</strong>
        <div class="chips"><button v-for="m in pending" :key="m.id" class="pchip" @click="openMeeting(m.id)">{{ m.opp_name }} · {{ fmtDateTime(m.starts_at) }}</button></div></div>
    </div>

    <div class="bar-top">
      <div class="seg-view">
        <button :class="{ on: view === 'mes' }" @click="view = 'mes'"><AppIcon name="calendar" :size="16" /> Mês</button>
        <button :class="{ on: view === 'lista' }" @click="view = 'lista'"><AppIcon name="menu" :size="16" /> Próximas</button>
      </div>
      <div v-if="view === 'mes'" class="nav">
        <button class="icon-btn" aria-label="Mês anterior" @click="shift(-1)"><AppIcon name="chevron-left" /></button>
        <strong class="month">{{ monthLabel }}</strong>
        <button class="icon-btn" aria-label="Próximo mês" @click="shift(1)"><AppIcon name="chevron-right" /></button>
        <button class="btn btn-ghost btn-sm" @click="cursor = new Date()">Hoje</button>
      </div>
      <div class="row">
        <select v-model="organizer" class="select f" aria-label="Responsável">
          <option v-if="auth.isManager.value" value="">Toda a equipe</option>
          <option value="me">Minhas reuniões</option>
          <option v-if="!auth.isManager.value" value="">Todas que posso ver</option>
          <template v-if="auth.isManager.value"><option v-for="a in assignees" :key="a.id" :value="a.id">{{ a.full_name }}</option></template>
        </select>
        <select v-model="status" class="select f" aria-label="Status"><option value="">Todos os status</option><option v-for="(l, k) in MEETING_STATUS_LABEL" :key="k" :value="k">{{ l }}</option></select>
      </div>
    </div>

    <div class="layout">
      <div>
        <div v-if="view === 'mes'" class="cal card" :class="{ loading }">
          <div v-for="w in ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']" :key="w" class="wd">{{ w }}</div>
          <div v-for="d in days" :key="d.toISOString()" class="day" :class="{ out: d.getMonth() !== monthStart.getMonth(), today: dayKey(d) === today }"
            @dblclick="openForm(null, dayKey(d))">
            <div class="dn"><span>{{ d.getDate() }}</span>
              <button class="add" :aria-label="`Agendar em ${d.toLocaleDateString('pt-BR')}`" @click="openForm(null, dayKey(d))"><AppIcon name="plus" :size="12" /></button></div>
            <button v-for="m in (byDay[dayKey(d)] ?? []).slice(0, 4)" :key="m.id" class="ev" :class="m.status" :title="`${m.title} · ${m.opp_name}`" @click="openMeeting(m.id)">
              <b>{{ time(m.starts_at) }}</b> {{ m.opp_name }}</button>
            <span v-if="(byDay[dayKey(d)] ?? []).length > 4" class="more">+{{ byDay[dayKey(d)]!.length - 4 }}</span>
          </div>
        </div>

        <div v-else class="stack">
          <div v-if="!listGroups.length" class="card empty"><BrandLogo symbol :height="48" />Nenhuma reunião nos próximos 90 dias.</div>
          <section v-for="g in listGroups" :key="g.key" class="card">
            <div class="card-head"><h2 class="cap">{{ g.label }}</h2><span v-if="g.key === today" class="badge info">Hoje</span></div>
            <ul class="mlist">
              <li v-for="m in g.list" :key="m.id" tabindex="0" @click="openMeeting(m.id)" @keydown.enter="openMeeting(m.id)">
                <div class="t"><strong>{{ time(m.starts_at) }}</strong><span class="small muted">{{ m.duration_min }} min</span></div>
                <div class="grow"><div class="t-strong">{{ m.title }}</div>
                  <div class="small muted"><AppIcon :name="MEETING_MODE_ICON[m.mode] ?? 'info'" :size="13" /> {{ MEETING_MODE_LABEL[m.mode] }} · {{ m.opp_name }} · {{ m.organizer?.full_name }}</div></div>
                <span class="badge" :class="MEETING_STATUS_TONE[m.status]">{{ MEETING_STATUS_LABEL[m.status] }}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <aside class="side card">
        <div class="card-head"><h2>Aguardando agendamento</h2><span class="n">{{ unscheduled.length }}</span></div>
        <p v-if="!unscheduled.length" class="small muted pad">Nenhuma reunião sem data.</p>
        <ul v-else class="mlist compact">
          <li v-for="m in unscheduled" :key="m.id" tabindex="0" @click="openMeeting(m.id)" @keydown.enter="openMeeting(m.id)">
            <div class="grow"><div class="t-strong small">{{ m.title }}</div><div class="small muted">{{ m.opp_name }} · {{ m.organizer?.full_name }}</div></div>
            <AppIcon name="chevron-right" :size="16" />
          </li>
        </ul>
        <div class="legend">
          <span v-for="s in ['agendada', 'confirmada', 'reagendada', 'realizada', 'nao_compareceu', 'cancelada']" :key="s" class="lg"><i class="ev-dot" :class="s" /> {{ MEETING_STATUS_LABEL[s] }}</span>
        </div>
      </aside>
    </div>

    <MeetingDrawer :id="openId" @close="closeMeeting" @changed="load" @edit="editMeeting" />
    <MeetingForm :open="form.open" :meeting="form.meeting" :opportunity-id="form.opp" :preset-date="form.date" :assignees="assignees"
      @close="form.open = false" @saved="onSaved" />
  </div>
</template>

<style scoped>
.pend { margin-bottom: 1rem; }
.chips { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .45rem; }
.pchip { border: 1px solid #F1D49B; background: #fff; border-radius: 99px; padding: .25rem .65rem; font: 500 .8rem var(--font-body); cursor: pointer; color: #6E4500; }
.bar-top { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
.seg-view { display: inline-flex; border: 1px solid var(--line-strong); border-radius: var(--radius); overflow: hidden; background: #fff; }
.seg-view button { display: inline-flex; align-items: center; gap: .4rem; padding: .55rem .9rem; border: 0; border-left: 1px solid var(--line-strong); background: none; font: 600 .86rem var(--font-body); color: var(--ink-2); cursor: pointer; }
.seg-view button:first-child { border-left: 0; }
.seg-view button.on { background: var(--navy); color: #fff; }
.nav { display: flex; align-items: center; gap: .3rem; }
.month { font: 700 1.05rem var(--font-head); color: var(--navy); min-width: 170px; text-align: center; }
.select.f { width: auto; min-width: 180px; }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 1.25rem; align-items: start; }
@media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
.cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); overflow: hidden; transition: opacity .15s; }
.cal.loading { opacity: .6; }
.wd { background: var(--navy); color: #fff; font: 600 .74rem var(--font-body); text-transform: uppercase; letter-spacing: .05em; padding: .55rem; text-align: center; }
.day { min-height: 118px; border-top: 1px solid var(--line); border-left: 1px solid var(--line); padding: .35rem; display: flex; flex-direction: column; gap: .2rem; background: #fff; }
.day:nth-child(7n + 1) { border-left: 0; }
.day.out { background: var(--tint); }
.day.out .dn span { color: var(--line-strong); }
.dn { display: flex; justify-content: space-between; align-items: center; }
.dn span { font: 700 .82rem var(--font-head); color: var(--ink-2); width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; }
.today .dn span { background: var(--blue); color: #fff; }
.add { opacity: 0; border: 0; background: var(--blue-100); color: var(--blue); width: 20px; height: 20px; border-radius: 5px; display: grid; place-items: center; cursor: pointer; }
.day:hover .add, .add:focus-visible { opacity: 1; }
.ev { display: block; width: 100%; text-align: left; border: 0; border-left: 3px solid var(--blue); background: var(--blue-100); color: var(--navy); border-radius: 4px; padding: .15rem .35rem; font: 500 .74rem var(--font-body); cursor: pointer; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ev b { font-weight: 700; }
.ev.confirmada, .ev-dot.confirmada { border-color: var(--success); background: var(--success-bg); }
.ev.reagendada, .ev-dot.reagendada { border-color: #E0A100; background: var(--warning-bg); }
.ev.realizada, .ev-dot.realizada { border-color: var(--navy); background: #E1E5EF; }
.ev.cancelada, .ev-dot.cancelada { border-color: var(--line-strong); background: #F1F2F5; color: var(--muted); text-decoration: line-through; }
.ev.nao_compareceu, .ev-dot.nao_compareceu { border-color: var(--danger); background: var(--danger-bg); }
.more { font-size: .72rem; color: var(--muted); padding-left: .3rem; }
.cap { }
.mlist { list-style: none; margin: 0; padding: 0; }
.mlist li { display: flex; align-items: center; gap: .9rem; padding: .8rem 1.25rem; border-top: 1px solid var(--line); cursor: pointer; }
.mlist li:first-child { border-top: 0; }
.mlist li:hover { background: var(--tint); }
.mlist .t { display: flex; flex-direction: column; min-width: 56px; }
.mlist .t strong { font: 700 1rem var(--font-head); color: var(--navy); }
.mlist.compact li { padding: .65rem 1rem; }
.side .n { background: var(--tint); border: 1px solid var(--line); border-radius: 99px; padding: 0 .5rem; font-weight: 700; font-size: .8rem; }
.pad { padding: 1rem; margin: 0; }
.legend { display: grid; gap: .3rem; padding: .9rem 1rem; border-top: 1px solid var(--line); font-size: .78rem; color: var(--ink-2); }
.lg { display: flex; align-items: center; gap: .45rem; }
.ev-dot { width: 14px; height: 10px; border-radius: 3px; border-left: 3px solid var(--blue); background: var(--blue-100); display: inline-block; }
@media (max-width: 700px) { .day { min-height: 72px; } .ev { font-size: 0; padding: 0; height: 6px; } .ev b { display: none; } .wd { font-size: .62rem; padding: .4rem .1rem; } }
</style>
