<script setup lang="ts">
definePageMeta({ layout: 'crm', roles: ['admin'] })
useHead({ title: 'Auditoria · DealSourcing' })

interface Log { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; reason: string | null; ip: string | null; created_at: string; actor: { full_name: string; email: string } | null }

const api = useApi()
const toast = useToast()
const f = reactive({ entity: '', action: '', from: '', to: '', page: 1 })
const items = ref<Log[]>([])
const total = ref(0)
const pageSize = 30
const loading = ref(false)
const expanded = ref<number | null>(null)

async function load() {
  loading.value = true
  try {
    const r = await api.get<{ items: Log[]; total: number }>('/admin/audit', { ...f, page_size: pageSize })
    items.value = r.items; total.value = r.total
  } catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
watch(() => [f.entity, f.action, f.from, f.to], () => { f.page = 1; load() })
onMounted(load)

const IGNORE = ['id', 'updated_at', 'last_login_at', 'updated_by', 'approved_by', 'status_changed_by', 'status_changed_at', 'granted_by', 'published_by']
function diff(l: Log): { k: string; from: unknown; to: unknown }[] {
  const o = l.old_data ?? {}; const n = l.new_data ?? {}
  const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)])).filter((k) => !IGNORE.includes(k))
  return keys.filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k])).map((k) => ({ k, from: o[k], to: n[k] }))
}
function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDateTime(v)
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}
function target(l: Log): string {
  if (l.action === 'login' || l.action === 'password_reset') return l.actor?.email ?? '—'
  const d = l.new_data ?? l.old_data ?? {}
  if (l.entity === 'profiles') return String(d.full_name ?? d.email ?? l.entity_id ?? '')
  if (l.entity === 'system_settings') return String(d.label ?? d.key ?? l.entity_id ?? '')
  if (l.entity === 'user_roles') return ROLE_LABEL[d.role as keyof typeof ROLE_LABEL] ?? String(d.role ?? '')
  if (l.entity === 'legal_documents') return `${d.title ?? ''} v${d.version ?? ''}`
  return l.entity_id ?? ''
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <div class="eyebrow">Administração</div>
        <h1>Auditoria</h1>
        <p>Registro de acessos e alterações, com autor, data, hora e valores anteriores e novos.</p>
      </div>
    </div>

    <div class="card filters">
      <select v-model="f.entity" class="select" aria-label="Área">
        <option value="">Todas as áreas</option>
        <option v-for="(l, k) in AUDIT_ENTITY_LABEL" :key="k" :value="k">{{ l }}</option>
      </select>
      <select v-model="f.action" class="select" aria-label="Ação">
        <option value="">Todas as ações</option>
        <option v-for="(l, k) in AUDIT_ACTION_LABEL" :key="k" :value="k">{{ l }}</option>
      </select>
      <label class="row small">De <input v-model="f.from" type="date" class="input date"></label>
      <label class="row small">Até <input v-model="f.to" type="date" class="input date"></label>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Data e hora</th><th>Autor</th><th>Ação</th><th>Área</th><th>Registro</th><th>IP</th></tr></thead>
        <tbody>
          <tr v-if="loading && !items.length"><td colspan="6" class="empty"><span class="spinner" /></td></tr>
          <tr v-else-if="!items.length"><td colspan="6" class="empty">Nenhum registro no período.</td></tr>
          <template v-for="l in items" :key="l.id">
            <tr class="clickable" @click="expanded = expanded === l.id ? null : l.id">
              <td class="nowrap">{{ fmtDateTime(l.created_at) }}</td>
              <td>{{ l.actor?.full_name ?? 'Sistema' }}</td>
              <td><span class="badge plain" :class="l.action === 'delete' ? 'danger' : l.action === 'insert' ? 'success' : 'info'">{{ AUDIT_ACTION_LABEL[l.action] ?? l.action }}</span></td>
              <td class="nowrap">{{ AUDIT_ENTITY_LABEL[l.entity] ?? l.entity }}</td>
              <td>{{ target(l) }}</td>
              <td class="mono muted">{{ l.ip && l.ip !== 'unknown' ? l.ip : '—' }}</td>
            </tr>
            <tr v-if="expanded === l.id" class="detail-row">
              <td colspan="6">
                <div v-if="l.reason" class="small" style="margin-bottom:.5rem"><strong>Justificativa:</strong> {{ l.reason }}</div>
                <table v-if="diff(l).length" class="diff">
                  <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
                  <tbody>
                    <tr v-for="d in diff(l)" :key="d.k">
                      <td>{{ FIELD_LABEL[d.k] ?? d.k }}</td><td class="old">{{ show(d.from) }}</td><td class="new">{{ show(d.to) }}</td>
                    </tr>
                  </tbody>
                </table>
                <p v-else class="small muted" style="margin:0">Sem alterações de campos a exibir.</p>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <AppPager :page="f.page" :page-size="pageSize" :total="total" @change="(p) => { f.page = p; load() }" />
  </div>
</template>

<style scoped>
.filters { display: flex; gap: .75rem; padding: .85rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
.filters .select { width: auto; min-width: 180px; }
.date { width: auto; min-height: 40px; }
.detail-row td { background: #fff !important; padding: 1rem 1.25rem; }
.diff { width: 100%; border-collapse: collapse; font-size: .84rem; }
.diff th { text-align: left; font-size: .74rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding: .35rem .5rem; border-bottom: 1px solid var(--line); }
.diff td { padding: .4rem .5rem; border-bottom: 1px solid var(--line); word-break: break-word; }
.diff .old { color: var(--danger); text-decoration: line-through; text-decoration-color: rgba(198,47,51,.4); }
.diff .new { color: var(--success); font-weight: 500; }
</style>
