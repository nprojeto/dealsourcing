<script setup lang="ts">
import type { AccountStatus, Role } from '~/utils/labels'
import type { Profile } from '~/composables/useAuth'
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial'] })
useHead({ title: 'Usuários · DealSourcing' })

interface Consent { kind: 'terms' | 'privacy'; version: string; accepted_at: string; ip: string | null }
interface HistoryItem { id: number; action: string; entity: string; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; reason: string | null; created_at: string; actor: { full_name: string } | null }

const api = useApi()
const auth = useAuth()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const filters = reactive({
  q: String(route.query.q ?? ''),
  status: String(route.query.status ?? ''),
  role: String(route.query.role ?? ''),
  page: 1,
})
const items = ref<Profile[]>([])
const total = ref(0)
const pageSize = 20
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const r = await api.get<{ items: Profile[]; total: number }>('/admin/users', {
      q: filters.q, status: filters.status, role: filters.role, page: filters.page, page_size: pageSize,
    })
    items.value = r.items; total.value = r.total
  } catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
let debounce: ReturnType<typeof setTimeout> | undefined
watch(() => filters.q, () => { clearTimeout(debounce); debounce = setTimeout(() => { filters.page = 1; load() }, 350) })
watch(() => [filters.status, filters.role], () => { filters.page = 1; load() })
function clearFilters() { filters.q = ''; filters.status = ''; filters.role = '' }
onMounted(() => { load(); if (route.query.id) openDetail(String(route.query.id)) })
watch(() => route.query.id, (id) => { if (id) openDetail(String(id)) })

// ---------- Detalhe ----------
const detail = ref<{ profile: Profile; consents: Consent[]; history: HistoryItem[]; referral_code: string | null } | null>(null)
const detailOpen = ref(false)
const detailLoading = ref(false)
async function openDetail(id: string) {
  detailOpen.value = true; detailLoading.value = true; detail.value = null
  try { detail.value = await api.get(`/admin/users/${id}`) }
  catch (e) { toast.error(errorMessage(e)); detailOpen.value = false }
  finally { detailLoading.value = false }
}
function closeDetail() {
  detailOpen.value = false
  if (route.query.id) router.replace({ query: { ...route.query, id: undefined } })
}

// ---------- Ações de status ----------
type Action = 'approve' | 'reject' | 'block' | 'deactivate' | 'reactivate'
const ACTIONS: Record<Action, { label: string; from: AccountStatus[]; tone: string; needsReason: boolean; icon: string; confirm: string }> = {
  approve: { label: 'Aprovar', from: ['pending_approval'], tone: 'btn-success', needsReason: false, icon: 'check', confirm: 'O usuário poderá acessar a plataforma e receberá um e-mail de aprovação.' },
  reject: { label: 'Rejeitar', from: ['pending_approval'], tone: 'btn-danger', needsReason: true, icon: 'x', confirm: 'O usuário será informado por e-mail com a justificativa.' },
  block: { label: 'Bloquear', from: ['active', 'pending_approval', 'inactive'], tone: 'btn-danger', needsReason: true, icon: 'ban', confirm: 'O acesso será bloqueado imediatamente.' },
  deactivate: { label: 'Desativar', from: ['active', 'pending_approval'], tone: 'btn-outline', needsReason: false, icon: 'ban', confirm: 'O usuário não poderá mais entrar até ser reativado.' },
  reactivate: { label: 'Reativar', from: ['blocked', 'inactive', 'rejected'], tone: 'btn-success', needsReason: false, icon: 'refresh', confirm: 'O acesso será liberado novamente.' },
}
const availableActions = computed(() => {
  const p = detail.value?.profile
  if (!p || !auth.isAdmin.value || p.id === auth.profile.value?.id) return []
  return (Object.keys(ACTIONS) as Action[]).filter((a) => ACTIONS[a].from.includes(p.status)
    && !(ACTIONS[a].label === 'Aprovar' && !p.email_verified_at))
})
const pendingAction = ref<Action | null>(null)
const reason = ref('')
const acting = ref(false)
async function runAction() {
  const a = pendingAction.value; const p = detail.value?.profile
  if (!a || !p) return
  if (ACTIONS[a].needsReason && !reason.value.trim()) { toast.warning('Informe a justificativa.'); return }
  acting.value = true
  try {
    await api.post(`/admin/users/${p.id}/status`, { action: a, reason: reason.value.trim() || undefined })
    toast.success(`Ação "${ACTIONS[a].label}" concluída.`)
    pendingAction.value = null; reason.value = ''
    await Promise.all([openDetail(p.id), load()])
  } catch (e) { toast.error(errorMessage(e)) } finally { acting.value = false }
}

// ---------- Perfil de acesso ----------
const newRole = ref<Role | ''>('')
watch(detail, (d) => { newRole.value = d?.profile.role ?? '' })
async function saveRole() {
  const p = detail.value?.profile
  if (!p || !newRole.value || newRole.value === p.role) return
  acting.value = true
  try {
    await api.post(`/admin/users/${p.id}/role`, { role: newRole.value })
    toast.success('Perfil de acesso atualizado.')
    await Promise.all([openDetail(p.id), load()])
  } catch (e) { toast.error(errorMessage(e)); newRole.value = p.role ?? '' } finally { acting.value = false }
}
async function resendInvite() {
  const p = detail.value?.profile
  if (!p) return
  acting.value = true
  try { await api.post(`/admin/users/${p.id}/resend-invite`); toast.success('Novo código enviado por e-mail.') }
  catch (e) { toast.error(errorMessage(e)) } finally { acting.value = false }
}

// ---------- Novo usuário ----------
const createOpen = ref(false)
const createForm = reactive({ full_name: '', email: '', phone: '', role: 'colaborador' as Role, company_name: '' })
const createErr = ref('')
async function createUser() {
  createErr.value = ''
  if (!isFullName(createForm.full_name)) { createErr.value = 'Informe nome e sobrenome.'; return }
  if (!isEmail(createForm.email)) { createErr.value = 'E-mail inválido.'; return }
  if (!isPhone(createForm.phone)) { createErr.value = 'Telefone com DDD inválido.'; return }
  acting.value = true
  try {
    const r = await api.post<{ invite_sent: boolean; profile: Profile }>('/admin/users', { ...createForm, phone: onlyDigits(createForm.phone) })
    toast[r.invite_sent ? 'success' : 'warning'](r.invite_sent
      ? `Usuário criado. Convite enviado para ${createForm.email}.`
      : 'Usuário criado, mas o e-mail de convite não foi enviado. Use "Reenviar convite".')
    createOpen.value = false
    Object.assign(createForm, { full_name: '', email: '', phone: '', role: 'colaborador', company_name: '' })
    await load()
    openDetail(r.profile.id)
  } catch (e) { createErr.value = errorMessage(e) } finally { acting.value = false }
}

function describeChange(h: HistoryItem): string {
  if (h.action === 'login') return 'Acesso à plataforma'
  if (h.action === 'password_reset') return 'Senha redefinida'
  if (h.action === 'resend_invite') return 'Convite reenviado'
  if (h.entity === 'user_roles') {
    const r = (h.new_data?.role ?? h.old_data?.role) as Role | undefined
    return `${h.action === 'delete' ? 'Perfil removido' : 'Perfil atribuído'}: ${r ? ROLE_LABEL[r] : '—'}`
  }
  if (h.action === 'insert') return 'Cadastro criado'
  if (h.action === 'update' && h.old_data && h.new_data) {
    const changed = Object.keys(h.new_data).filter((k) => !['updated_at', 'last_login_at', 'status_changed_at', 'status_changed_by'].includes(k)
      && JSON.stringify(h.new_data?.[k]) !== JSON.stringify(h.old_data?.[k]))
    if (changed.includes('status')) return `Status: ${STATUS_LABEL[h.old_data.status as AccountStatus] ?? h.old_data.status} → ${STATUS_LABEL[h.new_data.status as AccountStatus] ?? h.new_data.status}`
    return `Alterado: ${changed.map((k) => FIELD_LABEL[k] ?? k).join(', ') || '—'}`
  }
  return AUDIT_ACTION_LABEL[h.action] ?? h.action
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <div class="eyebrow">Administração</div>
        <h1>Usuários e acessos</h1>
        <p>Aprove cadastros, gerencie perfis de acesso e acompanhe o histórico de cada usuário.</p>
      </div>
      <button v-if="auth.isAdmin.value" class="btn" @click="createOpen = true"><AppIcon name="plus" :size="18" /> Novo usuário</button>
    </div>

    <div class="card filters">
      <div class="f-search">
        <AppIcon name="search" :size="18" />
        <input v-model="filters.q" class="input" placeholder="Buscar por nome, e-mail, empresa, telefone ou documento" aria-label="Buscar">
      </div>
      <select v-model="filters.status" class="select" aria-label="Status">
        <option value="">Todos os status</option>
        <option v-for="(l, k) in STATUS_LABEL" :key="k" :value="k">{{ l }}</option>
      </select>
      <select v-model="filters.role" class="select" aria-label="Perfil">
        <option value="">Todos os perfis</option>
        <option v-for="r in ALL_ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
      </select>
      <button v-if="filters.q || filters.status || filters.role" class="btn btn-ghost btn-sm" @click="clearFilters">Limpar</button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Telefone</th><th>Cadastro</th><th>Último acesso</th></tr>
        </thead>
        <tbody>
          <tr v-if="loading && !items.length"><td colspan="6" class="empty"><span class="spinner" /></td></tr>
          <tr v-else-if="!items.length"><td colspan="6" class="empty">Nenhum usuário encontrado com os filtros atuais.</td></tr>
          <tr v-for="u in items" :key="u.id" class="clickable" tabindex="0" @click="openDetail(u.id)" @keydown.enter="openDetail(u.id)">
            <td>
              <div class="row" style="flex-wrap:nowrap">
                <span class="avatar">{{ initials(u.full_name) }}</span>
                <div><div class="t-strong">{{ u.full_name }}</div><div class="small muted">{{ u.email }}</div></div>
              </div>
            </td>
            <td class="nowrap">{{ u.role ? ROLE_LABEL[u.role] : '—' }}</td>
            <td><StatusBadge :status="u.status" /></td>
            <td class="nowrap">{{ fmtPhone(u.phone) }}</td>
            <td class="nowrap">{{ fmtDate(u.created_at) }}</td>
            <td class="nowrap muted">{{ u.last_login_at ? fmtRelative(u.last_login_at) : 'Nunca' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPager :page="filters.page" :page-size="pageSize" :total="total" @change="(p) => { filters.page = p; load() }" />

    <!-- Detalhe -->
    <AppModal :open="detailOpen" side :width="560" :title="detail?.profile.full_name ?? 'Usuário'" @close="closeDetail">
      <div v-if="detailLoading" class="empty"><span class="spinner" /></div>
      <div v-else-if="detail" class="stack">
        <div class="row">
          <StatusBadge :status="detail.profile.status" />
          <span class="badge navy plain">{{ detail.profile.role ? ROLE_LABEL[detail.profile.role] : '—' }}</span>
        </div>
        <div v-if="detail.profile.status_reason" class="alert warning small"><AppIcon name="info" :size="18" /> Justificativa: {{ detail.profile.status_reason }}</div>

        <section>
          <div class="eyebrow">Dados cadastrais</div>
          <dl class="dl">
            <dt>E-mail</dt><dd>{{ detail.profile.email }}</dd>
            <dt>Telefone</dt><dd>{{ fmtPhone(detail.profile.phone) }}</dd>
            <dt>CPF/CNPJ</dt><dd>{{ fmtDocument(detail.profile.document) }}</dd>
            <dt>Empresa</dt><dd>{{ detail.profile.company_name || '—' }}</dd>
            <dt>Informações</dt><dd>{{ detail.profile.additional_info || '—' }}</dd>
            <dt>Cadastro</dt><dd>{{ fmtDateTime(detail.profile.created_at) }}</dd>
            <dt>E-mail confirmado</dt><dd>{{ fmtDateTime(detail.profile.email_verified_at) }}</dd>
            <dt>Aprovado em</dt><dd>{{ fmtDateTime(detail.profile.approved_at) }}</dd>
            <dt>Último acesso</dt><dd>{{ fmtDateTime(detail.profile.last_login_at) }}</dd>
            <template v-if="detail.profile.role && detail.profile.role !== 'isp_owner'">
              <dt>Código de indicação</dt>
              <dd><span v-if="detail.referral_code" class="mono">{{ detail.referral_code }}</span><span v-else class="muted">Gerado quando a conta estiver ativa</span>
                · <NuxtLink :to="`/crm/equipe?id=${detail.profile.id}${detail.profile.role === 'parceiro' ? '&tipo=parceiros' : ''}`">ver desempenho</NuxtLink></dd>
            </template>
          </dl>
        </section>

        <section v-if="auth.isAdmin.value && detail.profile.id !== auth.profile.value?.id" class="box">
          <div class="eyebrow">Ações</div>
          <div v-if="availableActions.length" class="row">
            <button v-for="a in availableActions" :key="a" class="btn btn-sm" :class="ACTIONS[a].tone"
              @click="pendingAction = a; reason = ''">
              <AppIcon :name="ACTIONS[a].icon" :size="16" /> {{ ACTIONS[a].label }}
            </button>
          </div>
          <p v-if="!detail.profile.email_verified_at" class="small muted" style="margin:.6rem 0 0">
            O usuário ainda não confirmou o e-mail.
            <button class="btn btn-outline btn-sm" style="margin-left:.4rem" :disabled="acting" @click="resendInvite"><AppIcon name="send" :size="14" /> Reenviar código</button>
          </p>
          <div v-if="pendingAction" class="confirm stack">
            <p class="small" style="margin:0"><strong>{{ ACTIONS[pendingAction].label }}:</strong> {{ ACTIONS[pendingAction].confirm }}</p>
            <div class="field">
              <label for="reason">Justificativa<span v-if="ACTIONS[pendingAction].needsReason" class="req">*</span></label>
              <textarea id="reason" v-model="reason" class="textarea" rows="2" maxlength="500" style="min-height:70px" />
            </div>
            <div class="row end">
              <button class="btn btn-ghost btn-sm" @click="pendingAction = null">Cancelar</button>
              <button class="btn btn-sm" :class="ACTIONS[pendingAction].tone" :disabled="acting" @click="runAction">
                <span v-if="acting" class="spinner" /> Confirmar
              </button>
            </div>
          </div>
          <hr class="divider">
          <div class="field">
            <label for="role">Perfil de acesso</label>
            <div class="row" style="flex-wrap:nowrap">
              <select id="role" v-model="newRole" class="select">
                <option v-for="r in ALL_ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
              </select>
              <button class="btn btn-sm" :disabled="acting || newRole === detail.profile.role" @click="saveRole">Salvar</button>
            </div>
          </div>
        </section>

        <section>
          <div class="eyebrow">Consentimentos (LGPD)</div>
          <p v-if="!detail.consents.length" class="small muted">Nenhum aceite registrado.</p>
          <ul v-else class="mini">
            <li v-for="c in detail.consents" :key="c.kind + c.version">
              <strong>{{ c.kind === 'terms' ? 'Termos de Uso' : 'Aviso de Privacidade' }}</strong> v{{ c.version }}
              <span class="muted">· {{ fmtDateTime(c.accepted_at) }}<template v-if="c.ip && c.ip !== 'unknown'"> · IP {{ c.ip }}</template></span>
            </li>
          </ul>
        </section>

        <section v-if="auth.isAdmin.value">
          <div class="eyebrow">Histórico</div>
          <p v-if="!detail.history.length" class="small muted">Sem registros.</p>
          <ol v-else class="timeline">
            <li v-for="h in detail.history" :key="h.id">
              <div class="small"><strong>{{ describeChange(h) }}</strong></div>
              <div class="small muted">{{ fmtDateTime(h.created_at) }} · {{ h.actor?.full_name ?? 'Sistema' }}</div>
              <div v-if="h.reason || (h.new_data as any)?.status_reason" class="small muted">“{{ h.reason ?? (h.new_data as any)?.status_reason }}”</div>
            </li>
          </ol>
        </section>
      </div>
    </AppModal>

    <!-- Novo usuário -->
    <AppModal :open="createOpen" title="Novo usuário" @close="createOpen = false">
      <p class="small muted">O usuário receberá um código por e-mail para definir a própria senha. Contas criadas aqui já entram aprovadas.</p>
      <form class="form-grid" novalidate @submit.prevent="createUser">
        <div class="field full"><label for="c-name">Nome completo<span class="req">*</span></label><input id="c-name" v-model="createForm.full_name" class="input"></div>
        <div class="field"><label for="c-email">E-mail<span class="req">*</span></label><input id="c-email" v-model="createForm.email" class="input" type="email"></div>
        <div class="field"><label for="c-phone">Telefone<span class="req">*</span></label>
          <input maxlength="15" id="c-phone" class="input" :value="createForm.phone" inputmode="tel" @input="createForm.phone = masked($event, maskPhone)"></div>
        <div class="field"><label for="c-role">Perfil<span class="req">*</span></label>
          <select id="c-role" v-model="createForm.role" class="select"><option v-for="r in ALL_ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option></select></div>
        <div class="field"><label for="c-company">Empresa / área</label><input id="c-company" v-model="createForm.company_name" class="input"></div>
        <div v-if="createErr" class="alert danger full"><AppIcon name="alert" :size="18" /> {{ createErr }}</div>
        <button type="submit" class="sr-only">Criar</button>
      </form>
      <template #footer>
        <button class="btn btn-ghost" @click="createOpen = false">Cancelar</button>
        <button class="btn" :disabled="acting" @click="createUser"><span v-if="acting" class="spinner" /> Criar e enviar convite</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.filters { display: flex; gap: .75rem; padding: .85rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
.filters .select { width: auto; min-width: 190px; }
.f-search { position: relative; flex: 1; min-width: 240px; }
.f-search :deep(svg) { position: absolute; left: .8rem; top: 50%; transform: translateY(-50%); color: var(--muted); }
.f-search .input { padding-left: 2.4rem; }
.box { border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; background: var(--tint); }
.confirm { margin-top: .9rem; padding: .9rem; background: #fff; border: 1px solid var(--line-strong); border-radius: var(--radius); }
.mini { list-style: none; margin: 0; padding: 0; display: grid; gap: .35rem; font-size: .86rem; }
.timeline { list-style: none; margin: 0; padding: 0 0 0 1rem; border-left: 2px solid var(--line); display: grid; gap: .8rem; }
.timeline li { position: relative; }
.timeline li::before { content: ''; position: absolute; left: calc(-1rem - 6px); top: 5px; width: 10px; height: 10px; border-radius: 50%; background: #fff; border: 2px solid var(--blue); }
@media (max-width: 600px) { .filters .select { flex: 1; min-width: 140px; } }
</style>
