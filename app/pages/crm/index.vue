<script setup lang="ts">
import type { AccountStatus, Role } from '~/utils/labels'
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial', 'colaborador'] })
useHead({ title: 'Painel · DealSourcing' })

interface Crm { isps: number; isps_7d: number; simulations: number; simulations_7d: number; formalizations: number; queue: number; pipeline_min: number; pipeline_max: number }
interface Stats { crm?: Crm; total: number; by_status: Record<string, number>; by_role: Record<string, number>; pending_approval: number; last_7_days: number; codes_sent_24h: number; verified_24h: number }
interface Row { id: string; full_name: string; email: string; role: Role | null; status: AccountStatus; created_at: string; additional_info: string | null; company_name: string | null }

const auth = useAuth()
const api = useApi()
const toast = useToast()
const stats = ref<Stats | null>(null)
const upcoming = ref<{ id: string; title: string; starts_at: string; opp_name: string; mode: string; status: string; organizer: { full_name: string } | null }[]>([])
const pendingMeetings = ref(0)
const funnel = ref<{ open: number; queue: number; overdue: number; stale: number; mine: number } | null>(null)
const pending = ref<Row[]>([])
const loading = ref(true)
const busy = ref('')

async function load() {
  api.get<{ summary: { open: number; queue: number; overdue: number; stale: number; mine: number } }>('/crm/opportunities', { status: 'open' })
    .then((r) => { funnel.value = r.summary }).catch(() => {})
  api.get<{ items: typeof upcoming.value; pending_result: unknown[] }>('/crm/meetings', { from: new Date().toISOString(), to: new Date(Date.now() + 7 * 86400_000).toISOString(), organizer: auth.isManager.value ? '' : 'me' })
    .then((r) => { upcoming.value = r.items.filter((m) => ['agendada', 'confirmada', 'reagendada'].includes(m.status)).slice(0, 6); pendingMeetings.value = r.pending_result.length }).catch(() => {})
  if (!auth.isManager.value) { loading.value = false; return }
  loading.value = true
  try {
    const [s, p] = await Promise.all([
      api.get<Stats>('/admin/stats'),
      api.get<{ items: Row[] }>('/admin/users', { status: 'pending_approval', page_size: 5 }),
    ])
    stats.value = s; pending.value = p.items
  } catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
onMounted(load)

async function approve(r: Row) {
  busy.value = r.id
  try {
    await api.post(`/admin/users/${r.id}/status`, { action: 'approve' })
    toast.success(`${r.full_name} aprovado(a).`)
    await load()
  } catch (e) { toast.error(errorMessage(e)) } finally { busy.value = '' }
}

const roleRows = computed(() => {
  const s = stats.value
  if (!s) return []
  const max = Math.max(1, ...Object.values(s.by_role))
  return ALL_ROLES.map((r) => ({ role: r, n: s.by_role[r] ?? 0, pct: ((s.by_role[r] ?? 0) / max) * 100 }))
})
const statusRows = computed(() => {
  const s = stats.value
  if (!s) return []
  return (Object.keys(STATUS_LABEL) as AccountStatus[]).map((k) => ({ k, n: s.by_status[k] ?? 0 })).filter((x) => x.n > 0)
})
const hello = computed(() => {
  const h = Number(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }))
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
})
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <div class="eyebrow">Painel</div>
        <h1>{{ hello }}, {{ firstName(auth.profile.value?.full_name) }}</h1>
        <p>{{ auth.isManager.value ? 'Visão geral dos cadastros e acessos da plataforma.' : 'Bem-vindo ao CRM de aquisição de ISPs.' }}</p>
      </div>
      <button v-if="auth.isManager.value" class="btn btn-outline btn-sm" :disabled="loading" @click="load">
        <AppIcon name="refresh" :size="16" /> Atualizar
      </button>
    </div>

    <div v-if="funnel" class="funnel-strip card">
      <div class="fs-title"><AppIcon name="briefcase" :size="18" /> <strong>Funil comercial</strong></div>
      <NuxtLink to="/crm/oportunidades?visao=tabela" class="fs"><b>{{ funnel.open }}</b> em aberto</NuxtLink>
      <NuxtLink to="/crm/oportunidades?alert=queue" class="fs" :class="{ warn: funnel.queue }"><b>{{ funnel.queue }}</b> na fila</NuxtLink>
      <NuxtLink to="/crm/oportunidades?visao=tabela&alert=overdue" class="fs" :class="{ bad: funnel.overdue }"><b>{{ funnel.overdue }}</b> prazo vencido</NuxtLink>
      <NuxtLink to="/crm/oportunidades?visao=tabela&alert=stale" class="fs" :class="{ warn: funnel.stale }"><b>{{ funnel.stale }}</b> paradas</NuxtLink>
      <NuxtLink to="/crm/oportunidades" class="fs"><b>{{ funnel.mine }}</b> comigo</NuxtLink>
    </div>
    <article class="card meet-card">
      <div class="card-head"><h2>Próximas reuniões</h2>
        <div class="row"><span v-if="pendingMeetings" class="badge danger">{{ pendingMeetings }} sem resultado</span><NuxtLink to="/crm/agenda?visao=lista" class="small">Ver agenda</NuxtLink></div></div>
      <p v-if="!upcoming.length" class="small muted" style="padding:1rem 1.4rem;margin:0">Nenhuma reunião nos próximos 7 dias.</p>
      <ul v-else class="meet-list">
        <li v-for="m in upcoming" :key="m.id"><NuxtLink :to="`/crm/agenda?id=${m.id}`">
          <span class="when"><b>{{ new Date(m.starts_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }) }}</b>{{ new Date(m.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) }}</span>
          <span class="grow"><span class="t-strong">{{ m.opp_name }}</span><span class="small muted"> · {{ m.title }} · {{ m.organizer?.full_name }}</span></span>
          <AppIcon :name="MEETING_MODE_ICON[m.mode] ?? 'calendar'" :size="16" /></NuxtLink></li>
      </ul>
    </article>
    <template v-if="auth.isManager.value">
      <div v-if="loading && !stats" class="empty"><span class="spinner" /></div>
      <template v-else-if="stats">
        <div class="row between" style="margin-bottom:.6rem"><div class="eyebrow" style="margin:0">Números gerais</div>
          <NuxtLink to="/crm/relatorios" class="small">Painel gerencial com filtros e relatórios →</NuxtLink></div>
        <div v-if="stats.crm" class="grid-4 crm-kpis">
          <NuxtLink to="/crm/provedores" class="card kpi link"><div class="kpi-label">Provedores cadastrados</div><div class="kpi-value">{{ stats.crm.isps }}</div><div class="kpi-foot">{{ stats.crm.isps_7d }} nos últimos 7 dias</div></NuxtLink>
          <NuxtLink to="/crm/simulacoes" class="card kpi link"><div class="kpi-label">Simulações realizadas</div><div class="kpi-value">{{ stats.crm.simulations }}</div><div class="kpi-foot">{{ stats.crm.simulations_7d }} nos últimos 7 dias</div></NuxtLink>
          <NuxtLink to="/crm/provedores?status=interest_formalized" class="card kpi ok link"><div class="kpi-label">Interesses formalizados</div><div class="kpi-value">{{ stats.crm.formalizations }}</div><div class="kpi-foot">{{ stats.crm.queue }} na fila de atendimento</div></NuxtLink>
          <div class="card kpi navy"><div class="kpi-label">Pipeline estimado</div><div class="kpi-value sm">{{ fmtBRLShort(stats.crm.pipeline_min) }} – {{ fmtBRLShort(stats.crm.pipeline_max) }}</div><div class="kpi-foot">oportunidades formalizadas em aberto</div></div>
        </div>
        <div class="grid-4">
          <div class="card kpi"><div class="kpi-label">Usuários cadastrados</div><div class="kpi-value">{{ stats.total }}</div><div class="kpi-foot">{{ stats.last_7_days }} nos últimos 7 dias</div></div>
          <div class="card kpi warn"><div class="kpi-label">Aguardando aprovação</div><div class="kpi-value">{{ stats.pending_approval }}</div><div class="kpi-foot">parceiros e equipe</div></div>
          <div class="card kpi ok"><div class="kpi-label">E-mails confirmados</div><div class="kpi-value">{{ stats.verified_24h }}</div><div class="kpi-foot">nas últimas 24 horas</div></div>
          <div class="card kpi"><div class="kpi-label">Códigos enviados</div><div class="kpi-value">{{ stats.codes_sent_24h }}</div><div class="kpi-foot">nas últimas 24 horas</div></div>
        </div>

        <div class="dash-grid">
          <article class="card">
            <div class="card-head">
              <h2>Cadastros aguardando aprovação</h2>
              <NuxtLink to="/crm/usuarios?status=pending_approval" class="small">Ver todos</NuxtLink>
            </div>
            <div v-if="!pending.length" class="empty small">
              <BrandLogo symbol :height="56" />
              Nenhum cadastro pendente no momento.
            </div>
            <ul v-else class="pend">
              <li v-for="r in pending" :key="r.id">
                <span class="avatar">{{ initials(r.full_name) }}</span>
                <div class="grow">
                  <NuxtLink :to="`/crm/usuarios?id=${r.id}`" class="t-strong">{{ r.full_name }}</NuxtLink>
                  <div class="small muted">{{ r.role ? ROLE_LABEL[r.role] : '—' }} · {{ r.email }} · {{ fmtRelative(r.created_at) }}</div>
                </div>
                <button v-if="auth.isAdmin.value" class="btn btn-success btn-sm" :disabled="busy === r.id" @click="approve(r)">
                  <span v-if="busy === r.id" class="spinner" /><AppIcon v-else name="check" :size="16" /> Aprovar
                </button>
              </li>
            </ul>
          </article>

          <article class="card">
            <div class="card-head"><h2>Usuários por perfil</h2></div>
            <div class="card-body stack">
              <div v-for="r in roleRows" :key="r.role">
                <div class="row between small"><span>{{ ROLE_LABEL[r.role] }}</span><strong>{{ r.n }}</strong></div>
                <div class="bar"><span :style="{ width: `${r.pct}%` }" /></div>
              </div>
              <hr class="divider">
              <div class="row">
                <span v-for="s in statusRows" :key="s.k" class="badge" :class="STATUS_TONE[s.k]">{{ STATUS_LABEL[s.k] }}: {{ s.n }}</span>
              </div>
            </div>
          </article>
        </div>
      </template>
    </template>

    <div v-if="!auth.isManager.value" class="grid-2" style="align-items:start">
    <ReferralCard />
    <article class="card card-body stack">
      <h2>Seu acesso está ativo</h2>
      <p class="muted">Os provedores cadastrados com o seu código aparecem em <NuxtLink to="/crm/provedores">Provedores</NuxtLink>, com as avaliações internas de cada um.</p>
      <dl class="dl">
        <dt>Perfil</dt><dd>{{ auth.profile.value?.role ? ROLE_LABEL[auth.profile.value.role] : '—' }}</dd>
        <dt>E-mail</dt><dd>{{ auth.profile.value?.email }}</dd>
        <dt>Último acesso</dt><dd>{{ fmtDateTime(auth.profile.value?.last_login_at) }}</dd>
      </dl>
    </article>
    </div>
    <div v-if="auth.isManager.value && stats" class="ref-row"><ReferralCard /></div>
  </div>
</template>

<style scoped>
.crm-kpis { margin-bottom: 1rem; }
.meet-card { margin-bottom: 1rem; }
.meet-list { list-style: none; margin: 0; padding: 0; }
.meet-list a { display: flex; align-items: center; gap: .9rem; padding: .65rem 1.4rem; border-top: 1px solid var(--line); color: inherit; text-decoration: none; }
.meet-list li:first-child a { border-top: 0; }
.meet-list a:hover { background: var(--tint); }
.meet-list .when { display: flex; flex-direction: column; min-width: 58px; font-size: .8rem; color: var(--muted); }
.meet-list .when b { color: var(--navy); font-family: var(--font-head); }
.funnel-strip { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; padding: .7rem .9rem; margin-bottom: 1rem; border-left: 4px solid var(--navy); }
.fs-title { display: inline-flex; align-items: center; gap: .4rem; color: var(--navy); margin-right: .5rem; }
.fs { padding: .35rem .75rem; border-radius: 99px; background: var(--tint); border: 1px solid var(--line); font-size: .85rem; color: var(--ink-2); text-decoration: none; }
.fs b { color: var(--navy); }
.fs:hover { border-color: var(--blue); text-decoration: none; }
.fs.warn { background: var(--warning-bg); border-color: transparent; }
.fs.warn b { color: var(--warning); }
.fs.bad { background: var(--danger-bg); border-color: transparent; }
.fs.bad b { color: var(--danger); }
.kpi.link { color: inherit; text-decoration: none; transition: border-color .15s, box-shadow .15s; }
.kpi.link:hover { border-color: var(--blue); box-shadow: var(--shadow); text-decoration: none; }
.kpi.navy { background: var(--navy); border-color: var(--navy); }
.kpi.navy::before { background: #8FA2DE; }
.kpi.navy .kpi-label, .kpi.navy .kpi-foot { color: #9FB0E8; }
.kpi.navy .kpi-value { color: #fff; }
.kpi-value.sm { font-size: 1.12rem; padding-top: .45rem; white-space: nowrap; }
.ref-row { margin-top: 1.25rem; max-width: 560px; }
.dash-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.25rem; margin-top: 1.25rem; align-items: start; }
@media (max-width: 1000px) { .dash-grid { grid-template-columns: 1fr; } }
.pend { list-style: none; margin: 0; padding: 0; }
.pend li { display: flex; align-items: center; gap: .8rem; padding: .85rem 1.4rem; border-top: 1px solid var(--line); }
.pend li:first-child { border-top: 0; }
.pend li:nth-child(even) { background: var(--tint); }
</style>
