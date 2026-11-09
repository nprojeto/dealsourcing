<script setup lang="ts">
definePageMeta({ layout: 'crm', roles: ['admin'] })
useHead({ title: 'Configurações · DealSourcing' })

interface Setting { key: string; value: unknown; value_type: 'integer' | 'number' | 'boolean' | 'text'; category: string; label: string; description: string | null; min_value: number | null; max_value: number | null; is_public: boolean; updated_at: string }
interface LegalItem { id: string; kind: 'terms' | 'privacy'; version: string; title: string; content: string; is_current: boolean; published_at: string; acceptances: number }

const api = useApi()
const toast = useToast()
const pc = usePublicConfig()
const route = useRoute()
const tab = ref<'params' | 'legal' | 'funil'>(route.query.aba === 'funil' ? 'funil' : 'params')

const CATEGORY_LABEL: Record<string, { t: string; d: string }> = {
  limites: { t: 'Limite de simulações', d: 'Quantas simulações cada provedor (login) e cada domínio de e-mail podem fazer por mês. Em e-mails gratuitos, o limite do grupo é contado por CNPJ. Zera no dia 1º.' },
  simulador: { t: 'Simulador — o que o provedor vê', d: 'Controla se o proprietário do ISP enxerga a faixa de valor das próprias simulações.' },
  reunioes: { t: 'Reuniões', d: 'Lembretes, duração padrão e convites por e-mail aos provedores.' },
  funil: { t: 'Funil comercial', d: 'Prazos de atendimento, alertas de oportunidades paradas e regras de movimentação.' },
  verificacao: { t: 'Confirmação de e-mail', d: 'Regras dos códigos enviados pela Brevo.' },
  seguranca: { t: 'Segurança', d: 'Proteções contra abuso e política de senha.' },
  cadastro: { t: 'Cadastros públicos', d: 'Quais tipos de cadastro ficam abertos no portal.' },
  geral: { t: 'Informações gerais', d: 'Dados de contato exibidos no portal e nos e-mails.' },
}

const settings = ref<Setting[]>([])
const draft = reactive<Record<string, unknown>>({})
const fieldErrors = ref<Record<string, string>>({})
const loading = ref(true)
const saving = ref(false)

async function loadSettings() {
  loading.value = true
  try {
    const r = await api.get<{ items: Setting[] }>('/admin/settings')
    settings.value = r.items
    for (const s of r.items) draft[s.key] = s.value
  } catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
const grouped = computed(() => {
  const g: Record<string, Setting[]> = {}
  for (const s of settings.value) (g[s.category] ??= []).push(s)
  return Object.entries(g)
})
const dirty = computed(() => settings.value.filter((s) => JSON.stringify(s.value) !== JSON.stringify(draft[s.key])))

async function save() {
  fieldErrors.value = {}
  const values: Record<string, unknown> = {}
  for (const s of dirty.value) {
    let v = draft[s.key]
    if (s.value_type === 'integer' || s.value_type === 'number') {
      v = Number(v)
      if (!Number.isFinite(v as number)) { fieldErrors.value[s.key] = 'Informe um número.'; continue }
    }
    if (s.value_type === 'text') v = String(v ?? '')
    values[s.key] = v
  }
  if (Object.keys(fieldErrors.value).length) return
  saving.value = true
  try {
    const r = await api.put<{ changed: number }>('/admin/settings', { values })
    toast.success(`${r.changed} configuração(ões) salva(s). As alterações ficam registradas na auditoria.`)
    await loadSettings(); pc.load(true)
  } catch (e) {
    if (e instanceof ApiError && e.data.errors) fieldErrors.value = e.data.errors as Record<string, string>
    toast.error(errorMessage(e))
    await loadSettings().then(() => { for (const [k, v] of Object.entries(values)) draft[k] = v })
  } finally { saving.value = false }
}
function reset() { for (const s of settings.value) draft[s.key] = s.value; fieldErrors.value = {} }

// ---------- Documentos legais ----------
const legal = ref<LegalItem[]>([])
const legalLoading = ref(false)
const viewDoc = ref<LegalItem | null>(null)
const pubOpen = ref(false)
const pub = reactive({ kind: 'terms' as 'terms' | 'privacy', version: '', title: '', content: '' })
const pubErr = ref('')
async function loadLegal() {
  legalLoading.value = true
  try { legal.value = (await api.get<{ items: LegalItem[] }>('/admin/legal')).items }
  catch (e) { toast.error(errorMessage(e)) } finally { legalLoading.value = false }
}
function startPublish(kind: 'terms' | 'privacy') {
  const cur = legal.value.find((d) => d.kind === kind && d.is_current)
  const parts = (cur?.version ?? '1.0').split('.')
  const next = parts.length > 1 ? `${parts[0]}.${Number(parts[1]) + 1}` : `${Number(parts[0]) + 1}`
  Object.assign(pub, { kind, version: next, title: cur?.title ?? (kind === 'terms' ? 'Termos de Uso' : 'Aviso de Privacidade'), content: cur?.content ?? '' })
  pubErr.value = ''; pubOpen.value = true
}
async function publish() {
  pubErr.value = ''
  saving.value = true
  try {
    await api.post('/admin/legal', pub)
    toast.success('Nova versão publicada. Novos cadastros aceitarão esta versão.')
    pubOpen.value = false
    await loadLegal(); pc.load(true)
  } catch (e) { pubErr.value = errorMessage(e) } finally { saving.value = false }
}
watch(tab, (t) => { if (t === 'legal' && !legal.value.length) loadLegal() })
onMounted(loadSettings)
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <div class="eyebrow">Administração</div>
        <h1>Configurações</h1>
        <p>Parâmetros operacionais editáveis sem alteração de código. Toda mudança fica registrada na auditoria.</p>
      </div>
    </div>

    <div class="tabs" role="tablist">
      <button class="tab" :class="{ active: tab === 'params' }" role="tab" :aria-selected="tab === 'params'" @click="tab = 'params'">Parâmetros do sistema</button>
      <button class="tab" :class="{ active: tab === 'funil' }" role="tab" :aria-selected="tab === 'funil'" @click="tab = 'funil'">Etapas do funil</button>
      <button class="tab" :class="{ active: tab === 'legal' }" role="tab" :aria-selected="tab === 'legal'" @click="tab = 'legal'">Documentos legais (LGPD)</button>
    </div>

    <template v-if="tab === 'params'">
      <div v-if="loading" class="empty"><span class="spinner" /></div>
      <div v-else class="stack">
        <article v-for="[cat, list] in grouped" :key="cat" class="card">
          <div class="card-head">
            <div><h2>{{ CATEGORY_LABEL[cat]?.t ?? cat }}</h2><p class="small muted" style="margin:0">{{ CATEGORY_LABEL[cat]?.d }}</p></div>
          </div>
          <div class="card-body set-list">
            <div v-for="s in list" :key="s.key" class="set">
              <div class="set-txt">
                <label :for="s.key" class="t-strong">{{ s.label }}</label>
                <p class="small muted">{{ s.description }}
                  <template v-if="s.min_value !== null || s.max_value !== null"> Faixa: {{ s.min_value ?? '—' }} a {{ s.max_value ?? '—' }}.</template></p>
                <span v-if="fieldErrors[s.key]" class="error small">{{ fieldErrors[s.key] }}</span>
              </div>
              <div class="set-ctl">
                <label v-if="s.value_type === 'boolean'" class="switch">
                  <input :id="s.key" v-model="draft[s.key]" type="checkbox"><span class="track" />
                  <span class="small">{{ draft[s.key] ? 'Ativado' : 'Desativado' }}</span>
                </label>
                <input v-else-if="s.value_type === 'text'" :id="s.key" v-model="draft[s.key]" class="input" :aria-invalid="!!fieldErrors[s.key]">
                <input v-else :id="s.key" v-model.number="draft[s.key]" class="input num" type="number"
                  :min="s.min_value ?? undefined" :max="s.max_value ?? undefined" :step="s.value_type === 'integer' ? 1 : 'any'" :aria-invalid="!!fieldErrors[s.key]">
              </div>
            </div>
          </div>
        </article>
        <div class="savebar card" :class="{ show: dirty.length }">
          <span class="small"><strong>{{ dirty.length }}</strong> alteração(ões) não salva(s)</span>
          <div class="row">
            <button class="btn btn-ghost btn-sm" @click="reset">Descartar</button>
            <button class="btn btn-sm" :disabled="saving || !dirty.length" @click="save"><span v-if="saving" class="spinner" /> Salvar alterações</button>
          </div>
        </div>
      </div>
    </template>

    <StageEditor v-else-if="tab === 'funil'" />

    <template v-else>
      <div class="alert info" style="margin-bottom:1rem">
        <AppIcon name="info" :size="18" />
        <span>Publicar uma nova versão não altera os aceites anteriores: cada usuário mantém o registro da versão que aceitou, com data, hora e IP. Revise o texto com o jurídico antes de publicar.</span>
      </div>
      <div v-if="legalLoading" class="empty"><span class="spinner" /></div>
      <div v-else class="grid-2">
        <article v-for="kind in (['terms', 'privacy'] as const)" :key="kind" class="card">
          <div class="card-head">
            <h2>{{ kind === 'terms' ? 'Termos de Uso' : 'Aviso de Privacidade' }}</h2>
            <button class="btn btn-sm" @click="startPublish(kind)"><AppIcon name="plus" :size="16" /> Nova versão</button>
          </div>
          <div class="table-wrap" style="border:0;border-radius:0">
            <table class="table">
              <thead><tr><th>Versão</th><th>Publicação</th><th>Aceites</th><th /></tr></thead>
              <tbody>
                <tr v-for="d in legal.filter((x) => x.kind === kind)" :key="d.id">
                  <td><strong>v{{ d.version }}</strong> <span v-if="d.is_current" class="badge success">Vigente</span></td>
                  <td class="nowrap">{{ fmtDate(d.published_at) }}</td>
                  <td>{{ d.acceptances }}</td>
                  <td><button class="btn btn-ghost btn-sm" @click="viewDoc = d">Ver</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </template>

    <AppModal :open="!!viewDoc" :title="`${viewDoc?.title} · v${viewDoc?.version}`" :width="680" @close="viewDoc = null">
      <div class="legal-text">{{ viewDoc?.content }}</div>
    </AppModal>

    <AppModal :open="pubOpen" :title="`Publicar nova versão — ${pub.kind === 'terms' ? 'Termos de Uso' : 'Aviso de Privacidade'}`" :width="720" @close="pubOpen = false">
      <div class="form-grid">
        <div class="field"><label for="p-ver">Versão</label><input id="p-ver" v-model="pub.version" class="input" placeholder="1.1"></div>
        <div class="field"><label for="p-title">Título</label><input id="p-title" v-model="pub.title" class="input"></div>
        <div class="field full"><label for="p-content">Texto completo</label><textarea id="p-content" v-model="pub.content" class="textarea" rows="14" /></div>
        <div v-if="pubErr" class="alert danger full"><AppIcon name="alert" :size="18" /> {{ pubErr }}</div>
      </div>
      <template #footer>
        <button class="btn btn-ghost" @click="pubOpen = false">Cancelar</button>
        <button class="btn" :disabled="saving" @click="publish"><span v-if="saving" class="spinner" /> Publicar e tornar vigente</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.set-list { padding-top: .5rem; padding-bottom: .5rem; }
.set { display: grid; grid-template-columns: 1fr minmax(180px, 280px); gap: 1.25rem; align-items: center; padding: .9rem 0; border-top: 1px solid var(--line); }
.set:first-child { border-top: 0; }
.set-txt p { margin: .15rem 0 0; }
.set-ctl .num { max-width: 160px; margin-left: auto; display: block; }
.set-ctl .switch { justify-content: flex-end; width: 100%; }
.savebar { position: sticky; bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .75rem 1rem; box-shadow: var(--shadow-lg); border-left: 4px solid var(--blue); opacity: 0; transform: translateY(8px); pointer-events: none; transition: all .2s; flex-wrap: wrap; }
.savebar.show { opacity: 1; transform: none; pointer-events: auto; }
.legal-text { white-space: pre-wrap; font-size: .92rem; color: var(--ink-2); line-height: 1.7; }
@media (max-width: 640px) { .set { grid-template-columns: 1fr; gap: .5rem; } .set-ctl .num { margin-left: 0; } .set-ctl .switch { justify-content: flex-start; } }
</style>
