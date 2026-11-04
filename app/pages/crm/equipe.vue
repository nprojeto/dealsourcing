<script setup lang="ts">
import type { AccountStatus, Role } from '~/utils/labels'
import type { PerformancePayload } from '~/utils/simulator'
import type { Profile } from '~/composables/useAuth'
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial'] })
useHead({ title: 'Equipe e parceiros · DealSourcing' })

interface Member { id: string; full_name: string; email: string; phone: string | null; status: AccountStatus; role: Role; created_at: string; last_login_at: string | null; code: string | null; isps: number; simulations: number; formalizations: number; opportunities_open: number; acquisitions: number }
interface MemberDetail extends PerformancePayload { profile: Profile; code_history: { code: string; active: boolean; created_at: string; deactivated_at: string | null; change_reason: string | null }[] }

const api = useApi()
const toast = useToast()
const auth = useAuth()
const route = useRoute()
const router = useRouter()
const type = ref<'internal' | 'external'>(route.query.tipo === 'parceiros' ? 'external' : 'internal')
const q = ref('')
const status = ref('active')
const items = ref<Member[]>([])
const totals = ref<Record<string, number>>({})
const loading = ref(false)
const sort = ref<keyof Member>('isps')

async function load() {
  loading.value = true
  try {
    const r = await api.get<{ items: Member[]; totals: Record<string, number> }>('/admin/team', { type: type.value, q: q.value, status: status.value })
    items.value = r.items; totals.value = r.totals
  } catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
let deb: ReturnType<typeof setTimeout> | undefined
watch(q, () => { clearTimeout(deb); deb = setTimeout(load, 300) })
watch([type, status], load)
onMounted(() => { load(); if (route.query.id) open(String(route.query.id)) })
const sorted = computed(() => [...items.value].sort((a, b) => Number(b[sort.value] ?? 0) - Number(a[sort.value] ?? 0) || a.full_name.localeCompare(b.full_name)))

const detail = ref<MemberDetail | null>(null)
const detailOpen = ref(false)
const detailLoading = ref(false)
async function open(id: string) {
  detailOpen.value = true; detailLoading.value = true; detail.value = null; codeForm.open = false
  try { detail.value = await api.get<MemberDetail>(`/admin/team/${id}`) }
  catch (e) { toast.error(errorMessage(e)); detailOpen.value = false } finally { detailLoading.value = false }
}
function close() { detailOpen.value = false; if (route.query.id) router.replace({ query: { ...route.query, id: undefined } }) }

const codeForm = reactive({ open: false, code: '', reason: '', busy: false, error: '' })
async function changeCode() {
  codeForm.error = ''
  if (codeForm.reason.trim().length < 5) { codeForm.error = 'Informe a justificativa (mínimo de 5 caracteres).'; return }
  codeForm.busy = true
  try {
    const r = await api.post<{ code: string }>(`/admin/users/${detail.value!.profile.id}/referral-code`, { code: codeForm.code.trim(), reason: codeForm.reason.trim() })
    toast.success(`Novo código: ${r.code}. O membro foi avisado.`)
    Object.assign(codeForm, { open: false, code: '', reason: '' })
    await Promise.all([open(detail.value!.profile.id), load()])
  } catch (e) { codeForm.error = errorMessage(e) } finally { codeForm.busy = false }
}
const cols: { key: keyof Member; label: string }[] = [
  { key: 'isps', label: 'Provedores' }, { key: 'simulations', label: 'Simulações' }, { key: 'formalizations', label: 'Formalizações' },
  { key: 'opportunities_open', label: 'Em andamento' }, { key: 'acquisitions', label: 'Aquisições' },
]
</script>

<template>
  <div>
    <div class="page-head">
      <div><div class="eyebrow">Comercial</div><h1>Equipe e parceiros</h1>
        <p>Códigos de indicação e desempenho de cada colaborador e parceiro.</p></div>
      <NuxtLink v-if="auth.isAdmin.value" to="/crm/usuarios?status=pending_approval" class="btn btn-outline btn-sm"><AppIcon name="users" :size="16" /> Aprovar cadastros</NuxtLink>
    </div>

    <div class="tabs" role="tablist">
      <button class="tab" :class="{ active: type === 'internal' }" @click="type = 'internal'">Equipe interna</button>
      <button class="tab" :class="{ active: type === 'external' }" @click="type = 'external'">Parceiros indicadores</button>
    </div>

    <div class="grid-4 sum">
      <div class="card kpi"><div class="kpi-label">Membros listados</div><div class="kpi-value">{{ items.length }}</div></div>
      <div class="card kpi"><div class="kpi-label">Provedores indicados</div><div class="kpi-value">{{ totals.isps ?? 0 }}</div></div>
      <div class="card kpi ok"><div class="kpi-label">Formalizações</div><div class="kpi-value">{{ totals.formalizations ?? 0 }}</div></div>
      <div class="card kpi"><div class="kpi-label">Aquisições</div><div class="kpi-value">{{ totals.acquisitions ?? 0 }}</div></div>
    </div>

    <div class="card filters">
      <div class="f-search"><AppIcon name="search" :size="18" />
        <input v-model="q" class="input" placeholder="Buscar por nome, e-mail ou código" aria-label="Buscar"></div>
      <select v-model="status" class="select" aria-label="Status">
        <option value="">Todos os status</option>
        <option v-for="(l, k) in STATUS_LABEL" :key="k" :value="k">{{ l }}</option>
      </select>
      <select v-model="sort" class="select" aria-label="Ordenar por">
        <option v-for="c in cols" :key="c.key" :value="c.key">Ordenar: {{ c.label }}</option>
      </select>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Membro</th><th>Código</th><th v-for="c in cols" :key="c.key" class="num">{{ c.label }}</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-if="loading && !items.length"><td colspan="8" class="empty"><span class="spinner" /></td></tr>
          <tr v-else-if="!items.length"><td colspan="8" class="empty">Nenhum membro encontrado.</td></tr>
          <tr v-for="m in sorted" :key="m.id" class="clickable" tabindex="0" @click="open(m.id)" @keydown.enter="open(m.id)">
            <td><div class="row" style="flex-wrap:nowrap"><span class="avatar">{{ initials(m.full_name) }}</span>
              <div><div class="t-strong">{{ m.full_name }}</div><div class="small muted">{{ ROLE_LABEL[m.role] }} · {{ m.email }}</div></div></div></td>
            <td><span v-if="m.code" class="mono code">{{ m.code }}</span><span v-else class="small muted">Sem código</span></td>
            <td v-for="c in cols" :key="c.key" class="num" :class="{ hi: c.key === sort }">{{ m[c.key] }}</td>
            <td><StatusBadge :status="m.status" /></td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppModal :open="detailOpen" side :width="960" :title="detail?.profile.full_name ?? 'Membro'" @close="close">
      <div v-if="detailLoading" class="empty"><span class="spinner" /></div>
      <div v-else-if="detail" class="stack">
        <div class="head-info">
          <div class="row">
            <StatusBadge :status="detail.profile.status" />
            <span class="badge navy plain">{{ detail.profile.role ? ROLE_LABEL[detail.profile.role] : '—' }}</span>
            <span class="small muted">{{ detail.profile.email }} · {{ fmtPhone(detail.profile.phone) }}</span>
          </div>
          <NuxtLink :to="`/crm/usuarios?id=${detail.profile.id}`" class="small">Ver cadastro e acessos</NuxtLink>
        </div>

        <section class="box">
          <div class="row between">
            <div>
              <div class="eyebrow">Código de indicação</div>
              <span v-if="detail.code" class="big-code">{{ detail.code }}</span>
              <span v-else class="muted small">O código é gerado quando a conta está ativa.</span>
            </div>
            <button v-if="auth.isAdmin.value && detail.code && !codeForm.open" class="btn btn-outline btn-sm" @click="codeForm.open = true"><AppIcon name="refresh" :size="16" /> Alterar código</button>
          </div>
          <div v-if="codeForm.open" class="code-form stack">
            <div class="form-grid">
              <div class="field"><label for="nc">Novo código</label>
                <input id="nc" v-model="codeForm.code" class="input mono-in" maxlength="20" placeholder="Em branco = gerar automaticamente" @input="codeForm.code = codeForm.code.toUpperCase()">
                <span class="hint">4 a 20 letras, números ou hífen.</span></div>
              <div class="field"><label for="nr">Justificativa<span class="req">*</span></label>
                <input id="nr" v-model="codeForm.reason" class="input" maxlength="500" placeholder="Ex.: pedido do parceiro"></div>
            </div>
            <div class="alert info small"><AppIcon name="info" :size="18" /> O código atual deixa de funcionar para novos cadastros. Provedores já indicados continuam vinculados a este membro.</div>
            <div v-if="codeForm.error" class="alert danger small"><AppIcon name="alert" :size="18" /> {{ codeForm.error }}</div>
            <div class="row end">
              <button class="btn btn-ghost btn-sm" @click="codeForm.open = false">Cancelar</button>
              <button class="btn btn-sm" :disabled="codeForm.busy" @click="changeCode"><span v-if="codeForm.busy" class="spinner" /> Salvar novo código</button>
            </div>
          </div>
          <details v-if="detail.code_history.length > 1" class="hist">
            <summary class="small">Histórico de códigos ({{ detail.code_history.length }})</summary>
            <ul class="small">
              <li v-for="h in detail.code_history" :key="h.code"><span class="mono">{{ h.code }}</span>
                <span class="muted"> · {{ fmtDate(h.created_at) }}{{ h.active ? ' · atual' : ` a ${fmtDate(h.deactivated_at)}` }}</span>
                <span v-if="!h.active && h.change_reason" class="muted"> · “{{ h.change_reason }}”</span></li>
            </ul>
          </details>
        </section>

        <PerformancePanel :data="detail" internal :show-assigned="detail.profile.role !== 'parceiro'" />
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.sum { margin-bottom: 1rem; }
.filters { display: flex; gap: .75rem; padding: .85rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
.filters .select { width: auto; min-width: 180px; }
.f-search { position: relative; flex: 1; min-width: 240px; }
.f-search :deep(svg) { position: absolute; left: .8rem; top: 50%; transform: translateY(-50%); color: var(--muted); }
.f-search .input { padding-left: 2.4rem; }
.num { text-align: right; }
th.num { text-align: right; }
td.hi { font-weight: 700; color: var(--navy); }
.code { background: var(--tint); border: 1px solid var(--line); border-radius: 6px; padding: .1rem .4rem; }
.head-info { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.box { border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; background: var(--tint); }
.big-code { font: 800 1.4rem var(--font-head); letter-spacing: .1em; color: var(--navy); }
.code-form { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--line); }
.mono-in { font-family: ui-monospace, Menlo, monospace; letter-spacing: .06em; }
.hist { margin-top: .75rem; }
.hist ul { margin: .5rem 0 0; padding-left: 1rem; display: grid; gap: .25rem; }
</style>
