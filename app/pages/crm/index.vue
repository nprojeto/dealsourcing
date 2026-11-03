<script setup lang="ts">
import type { AccountStatus, Role } from '~/utils/labels'
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial', 'colaborador'] })
useHead({ title: 'Painel · DealSourcing' })

interface Stats { total: number; by_status: Record<string, number>; by_role: Record<string, number>; pending_approval: number; last_7_days: number; codes_sent_24h: number; verified_24h: number }
interface Row { id: string; full_name: string; email: string; role: Role | null; status: AccountStatus; created_at: string; additional_info: string | null; company_name: string | null }

const auth = useAuth()
const api = useApi()
const toast = useToast()
const stats = ref<Stats | null>(null)
const pending = ref<Row[]>([])
const loading = ref(true)
const busy = ref('')

async function load() {
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

    <template v-if="auth.isManager.value">
      <div v-if="loading && !stats" class="empty"><span class="spinner" /></div>
      <template v-else-if="stats">
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

    <article v-else class="card card-body stack">
      <h2>Seu acesso está ativo</h2>
      <p class="muted">Seu código de indicação, as oportunidades distribuídas para você e seu painel de desempenho serão exibidos aqui à medida que os módulos comerciais forem liberados.</p>
      <dl class="dl">
        <dt>Perfil</dt><dd>{{ auth.profile.value?.role ? ROLE_LABEL[auth.profile.value.role] : '—' }}</dd>
        <dt>E-mail</dt><dd>{{ auth.profile.value?.email }}</dd>
        <dt>Último acesso</dt><dd>{{ fmtDateTime(auth.profile.value?.last_login_at) }}</dd>
      </dl>
    </article>
  </div>
</template>

<style scoped>
.dash-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.25rem; margin-top: 1.25rem; align-items: start; }
@media (max-width: 1000px) { .dash-grid { grid-template-columns: 1fr; } }
.pend { list-style: none; margin: 0; padding: 0; }
.pend li { display: flex; align-items: center; gap: .8rem; padding: .85rem 1.4rem; border-top: 1px solid var(--line); }
.pend li:first-child { border-top: 0; }
.pend li:nth-child(even) { background: var(--tint); }
</style>
