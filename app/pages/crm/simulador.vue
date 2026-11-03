<script setup lang="ts">
import type { SimParams, SimCriterion, SimResult } from '~/utils/simulator'
definePageMeta({ layout: 'crm', roles: ['admin'] })
useHead({ title: 'Parâmetros do simulador · DealSourcing' })

interface Version { id: string; version: number; params: SimParams; notes: string | null; is_current: boolean; published_at: string; simulations: number; publisher: { full_name: string } | null }
interface DraftRange { min: number; max: number | null | ''; penalty: number | '' }
interface DraftOption { value: string; label: string; penalty: number | '' }
interface DraftCriterion { key: string; label: string; type: 'ranges' | 'options'; unit?: string; active: boolean; order: number; ranges: DraftRange[]; options: DraftOption[] }
interface DraftRegion { code: string; name: string; min_per_client: number | ''; max_per_client: number | ''; statesText: string }
interface Draft { formula: 'additive' | 'multiplicative'; cap: number | ''; regions: DraftRegion[]; criteria: DraftCriterion[] }

const api = useApi()
const toast = useToast()
const tab = ref<'editar' | 'historico'>('editar')
const versions = ref<Version[]>([])
const current = ref<Version | null>(null)
const loading = ref(true)
const draft = ref<Draft | null>(null)
const baseVersion = ref<number | null>(null)
const notes = ref('')
const errors = ref<string[]>([])
const publishing = ref(false)

const p100 = (n: number) => Math.round(n * 100 * 10000) / 10000
function toDraft(p: SimParams): Draft {
  return {
    formula: p.formula, cap: p100(p.max_total_penalty),
    regions: p.regions.map((r) => ({ code: r.code, name: r.name, min_per_client: r.min_per_client, max_per_client: r.max_per_client, statesText: r.states.join(', ') })),
    criteria: [...p.criteria].sort((a, b) => a.order - b.order).map((c: SimCriterion) => ({
      key: c.key, label: c.label, type: c.type, unit: c.unit, active: c.active, order: c.order,
      ranges: (c.ranges ?? []).map((r) => ({ min: r.min, max: r.max, penalty: p100(r.penalty) })),
      options: (c.options ?? []).map((o) => ({ value: o.value, label: o.label, penalty: p100(o.penalty) })),
    })),
  }
}
function fromDraft(d: Draft): SimParams {
  const num = (v: number | '' | null) => (v === '' || v === null ? NaN : Number(v))
  return {
    formula: d.formula, max_total_penalty: num(d.cap) / 100,
    regions: d.regions.map((r) => ({ code: r.code, name: r.name, min_per_client: num(r.min_per_client), max_per_client: num(r.max_per_client),
      states: r.statesText.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean) })),
    criteria: d.criteria.map((c, i) => ({
      key: c.key, label: c.label, type: c.type, unit: c.unit, active: c.active, order: i + 1,
      ...(c.type === 'ranges'
        ? { ranges: c.ranges.map((r) => ({ min: Number(r.min), max: r.max === '' || r.max === null ? null : Number(r.max), penalty: num(r.penalty) / 100 })) }
        : { options: c.options.map((o) => ({ value: o.value, label: o.label, penalty: num(o.penalty) / 100 })) }),
    })),
  }
}

async function load() {
  loading.value = true
  try {
    const r = await api.get<{ current: Version | null; versions: Version[] }>('/admin/simulator')
    versions.value = r.versions; current.value = r.current
    if (r.current) { draft.value = toDraft(r.current.params); baseVersion.value = r.current.version }
  } catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
onMounted(load)

const nextVersion = computed(() => (versions.value[0]?.version ?? 0) + 1)
const dirty = computed(() => !!draft.value && !!current.value && JSON.stringify(fromDraft(draft.value)) !== JSON.stringify(normalize(current.value.params)))
function normalize(p: SimParams): SimParams { return fromDraft(toDraft(p)) }

// ----- faixas contínuas -----
function onMaxChange(c: DraftCriterion, i: number) {
  const next = c.ranges[i + 1]
  if (next) next.min = Number(c.ranges[i]!.max) || 0
}
function addRange(c: DraftCriterion) {
  const last = c.ranges[c.ranges.length - 1]!
  const step = c.key === 'client_base' ? 1000 : c.key === 'arpu' ? 20 : 10
  const cut = Number(last.min) + step
  c.ranges.splice(c.ranges.length - 1, 0, { min: last.min, max: cut, penalty: last.penalty })
  last.min = cut
}
function removeRange(c: DraftCriterion, i: number) {
  if (c.ranges.length <= 1) return
  const removed = c.ranges[i]!
  c.ranges.splice(i, 1)
  if (i === c.ranges.length) c.ranges[i - 1]!.max = null
  else c.ranges[i]!.min = removed.min
}
function move(i: number, dir: -1 | 1) {
  const list = draft.value!.criteria
  const j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
}
function loadVersion(v: Version) {
  draft.value = toDraft(v.params); baseVersion.value = v.version; tab.value = 'editar'
  notes.value = v.is_current ? '' : `Retorno aos parâmetros da versão ${v.version}`
  toast.info(`Parâmetros da versão ${v.version} carregados no editor. Publique para torná-los vigentes.`)
}
function discard() { if (current.value) { draft.value = toDraft(current.value.params); baseVersion.value = current.value.version; errors.value = [] } }

async function publish() {
  errors.value = []
  if (notes.value.trim().length < 3) { errors.value = ['Descreva o motivo da alteração.']; return }
  publishing.value = true
  try {
    await api.post('/admin/simulator/versions', { params: fromDraft(draft.value!), notes: notes.value.trim() })
    toast.success(`Versão ${nextVersion.value} publicada. Novas simulações usarão estes parâmetros.`)
    notes.value = ''
    await load()
  } catch (e) {
    if (e instanceof ApiError && Array.isArray(e.data.errors)) errors.value = e.data.errors as string[]
    toast.error(errorMessage(e))
  } finally { publishing.value = false }
}

// ----- teste de cálculo -----
const test = reactive({ client_base: 4000, region: 'SE', regularized: 'SIM', poles_valid_pct: 85, employment_type: 'CLT', arpu: 99.9 })
const preview = ref<SimResult | null>(null)
const previewing = ref(false)
async function runPreview() {
  previewing.value = true; errors.value = []
  try { preview.value = (await api.post<{ result: SimResult }>('/admin/simulator/preview', { params: fromDraft(draft.value!), inputs: test })).result }
  catch (e) { if (e instanceof ApiError && Array.isArray(e.data.errors)) errors.value = e.data.errors as string[]; toast.error(errorMessage(e)) }
  finally { previewing.value = false }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <div class="eyebrow">Administração</div>
        <h1>Parâmetros do simulador</h1>
        <p>Valores por região, penalizações e fórmula. Cada publicação gera uma nova versão; simulações anteriores mantêm a versão usada.</p>
      </div>
      <span v-if="current" class="badge navy plain">Vigente: versão {{ current.version }}</span>
    </div>

    <div class="tabs" role="tablist">
      <button class="tab" :class="{ active: tab === 'editar' }" @click="tab = 'editar'">Editar parâmetros</button>
      <button class="tab" :class="{ active: tab === 'historico' }" @click="tab = 'historico'">Histórico de versões ({{ versions.length }})</button>
    </div>

    <div v-if="loading" class="empty"><span class="spinner" /></div>

    <div v-else-if="tab === 'editar' && draft" class="ed">
      <div class="stack">
        <div v-if="baseVersion && current && baseVersion !== current.version" class="alert warning small">
          <AppIcon name="info" :size="18" /> Editando a partir da versão {{ baseVersion }}. A versão vigente é a {{ current.version }}.
        </div>

        <article class="card">
          <div class="card-head"><div><h2>Fórmula de composição</h2><p class="small muted" style="margin:0">Como as penalizações se combinam.</p></div></div>
          <div class="card-body form-grid">
            <div class="field"><label for="formula">Fórmula</label>
              <select id="formula" v-model="draft.formula" class="select">
                <option value="additive">Soma aditiva (20% + 10% + 7,5% = 37,5%)</option>
                <option value="multiplicative">Composição multiplicativa (1 − Π(1 − p))</option>
              </select></div>
            <div class="field"><label for="cap">Penalização total máxima</label>
              <div class="suffix"><input id="cap" v-model.number="draft.cap" class="input" type="number" min="1" max="100" step="0.5"><span>%</span></div>
              <span class="hint">O resultado nunca fica negativo, mesmo que a soma ultrapasse 100%.</span></div>
          </div>
        </article>

        <article class="card">
          <div class="card-head"><div><h2>Valores por região</h2><p class="small muted" style="margin:0">Valor por cliente multiplicado pela base informada.</p></div></div>
          <div class="table-wrap" style="border:0;border-radius:0">
            <table class="table edit">
              <thead><tr><th>Região</th><th>Mínimo / cliente</th><th>Máximo / cliente</th><th>Estados (UF)</th></tr></thead>
              <tbody>
                <tr v-for="r in draft.regions" :key="r.code">
                  <td><input v-model="r.name" class="input sm" :aria-label="`Nome da região ${r.code}`"><span class="small muted">{{ r.code }}</span></td>
                  <td><div class="prefix"><span>R$</span><input v-model.number="r.min_per_client" class="input sm" type="number" min="0" step="50"></div></td>
                  <td><div class="prefix"><span>R$</span><input v-model.number="r.max_per_client" class="input sm" type="number" min="0" step="50"></div></td>
                  <td><input v-model="r.statesText" class="input sm" :aria-label="`Estados de ${r.name}`"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article v-for="(c, i) in draft.criteria" :key="c.key" class="card crit" :class="{ off: !c.active }">
          <div class="card-head">
            <div class="row grow" style="flex-wrap:nowrap">
              <span class="ord">{{ i + 1 }}</span>
              <input v-model="c.label" class="input title-in" :aria-label="`Nome do critério ${i + 1}`">
            </div>
            <div class="row" style="flex-wrap:nowrap">
              <button class="icon-btn" :disabled="i === 0" aria-label="Subir" @click="move(i, -1)"><AppIcon name="chevron-left" :size="18" style="transform:rotate(90deg)" /></button>
              <button class="icon-btn" :disabled="i === draft.criteria.length - 1" aria-label="Descer" @click="move(i, 1)"><AppIcon name="chevron-right" :size="18" style="transform:rotate(90deg)" /></button>
              <label class="switch"><input v-model="c.active" type="checkbox"><span class="track" /><span class="small">{{ c.active ? 'Ativo' : 'Inativo' }}</span></label>
            </div>
          </div>
          <div class="card-body">
            <p class="small muted" style="margin-top:0">Campo do formulário: <strong>{{ CRITERION_FIELD_LABEL[c.key] }}</strong><template v-if="c.unit"> ({{ c.unit }})</template></p>
            <table v-if="c.type === 'ranges'" class="bands">
              <thead><tr><th>De</th><th>Até (menor que)</th><th>Penalização</th><th /></tr></thead>
              <tbody>
                <tr v-for="(r, j) in c.ranges" :key="j">
                  <td><span class="mono">{{ fmtInt(r.min) }}</span></td>
                  <td>
                    <span v-if="j === c.ranges.length - 1" class="muted small">ou mais</span>
                    <input v-else v-model.number="r.max" class="input sm" type="number" :min="r.min" step="any" @change="onMaxChange(c, j)">
                  </td>
                  <td><div class="suffix"><input v-model.number="r.penalty" class="input sm" type="number" min="0" max="100" step="0.5"><span>%</span></div></td>
                  <td><button class="icon-btn" :disabled="c.ranges.length <= 1" aria-label="Remover faixa" @click="removeRange(c, j)"><AppIcon name="x" :size="16" /></button></td>
                </tr>
              </tbody>
            </table>
            <button v-if="c.type === 'ranges'" class="btn btn-ghost btn-sm" @click="addRange(c)"><AppIcon name="plus" :size="16" /> Adicionar faixa</button>
            <table v-else class="bands">
              <thead><tr><th>Resposta</th><th>Rótulo exibido</th><th>Penalização</th></tr></thead>
              <tbody>
                <tr v-for="o in c.options" :key="o.value">
                  <td><span class="mono">{{ o.value }}</span></td>
                  <td><input v-model="o.label" class="input sm"></td>
                  <td><div class="suffix"><input v-model.number="o.penalty" class="input sm" type="number" min="0" max="100" step="0.5"><span>%</span></div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <aside class="side stack">
        <article class="card">
          <div class="card-head"><h2>Testar cálculo</h2></div>
          <div class="card-body stack">
            <div class="grid-2 mini">
              <div class="field"><label for="t-base">Clientes</label><input id="t-base" v-model.number="test.client_base" class="input sm" type="number" min="1"></div>
              <div class="field"><label for="t-reg">Região</label><select id="t-reg" v-model="test.region" class="select sm"><option v-for="r in draft.regions" :key="r.code" :value="r.code">{{ r.name }}</option></select></div>
              <div class="field"><label for="t-soc">Regularizado</label><select id="t-soc" v-model="test.regularized" class="select sm"><option value="SIM">Sim</option><option value="NAO">Não</option></select></div>
              <div class="field"><label for="t-pol">Postes válidos (%)</label><input id="t-pol" v-model.number="test.poles_valid_pct" class="input sm" type="number" min="0" max="100"></div>
              <div class="field"><label for="t-emp">Vínculo</label><select id="t-emp" v-model="test.employment_type" class="select sm"><option value="CLT">CLT</option><option value="PJ">PJ</option></select></div>
              <div class="field"><label for="t-arpu">ARPU (R$)</label><input id="t-arpu" v-model.number="test.arpu" class="input sm" type="number" min="0" step="0.01"></div>
            </div>
            <button class="btn btn-outline btn-block" :disabled="previewing" @click="runPreview"><span v-if="previewing" class="spinner" /> Calcular com os parâmetros do editor</button>
            <SimulationResult v-if="preview" :result="preview" :client-base="test.client_base" />
          </div>
        </article>

        <article class="card pub">
          <div class="card-head"><h2>Publicar versão {{ nextVersion }}</h2></div>
          <div class="card-body stack">
            <div class="field"><label for="notes">Motivo da alteração<span class="req">*</span></label>
              <textarea id="notes" v-model="notes" class="textarea" rows="3" maxlength="500" style="min-height:80px" placeholder="Ex.: reajuste dos valores da região Sul" /></div>
            <div v-if="errors.length" class="alert danger small"><AppIcon name="alert" :size="18" />
              <ul class="errs"><li v-for="e in errors" :key="e">{{ e }}</li></ul></div>
            <div class="row">
              <button class="btn btn-ghost btn-sm" :disabled="!dirty" @click="discard">Descartar</button>
              <button class="btn grow" :disabled="publishing || !dirty" @click="publish"><span v-if="publishing" class="spinner" /> Publicar e tornar vigente</button>
            </div>
            <p v-if="!dirty" class="small muted" style="margin:0">Nenhuma alteração em relação à versão vigente.</p>
          </div>
        </article>
      </aside>
    </div>

    <div v-else-if="tab === 'historico'" class="table-wrap">
      <table class="table">
        <thead><tr><th>Versão</th><th>Publicação</th><th>Responsável</th><th>Motivo</th><th>Simulações</th><th /></tr></thead>
        <tbody>
          <tr v-for="v in versions" :key="v.id">
            <td><strong>v{{ v.version }}</strong> <span v-if="v.is_current" class="badge success">Vigente</span></td>
            <td class="nowrap">{{ fmtDateTime(v.published_at) }}</td>
            <td>{{ v.publisher?.full_name ?? 'Sistema' }}</td>
            <td class="small">{{ v.notes }}</td>
            <td>{{ v.simulations }}</td>
            <td><button class="btn btn-ghost btn-sm" @click="loadVersion(v)">Carregar no editor</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.ed { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 1.25rem; align-items: start; }
.side { position: sticky; top: calc(var(--topbar-h) + 1rem); }
@media (max-width: 1100px) { .ed { grid-template-columns: 1fr; } .side { position: static; } }
.input.sm, .select.sm { min-height: 38px; padding: .45rem .65rem; font-size: .9rem; }
.suffix, .prefix { position: relative; }
.suffix span, .prefix span { position: absolute; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: .82rem; font-weight: 600; pointer-events: none; }
.suffix span { right: .7rem; }
.suffix .input { padding-right: 1.8rem; }
.prefix span { left: .65rem; }
.prefix .input { padding-left: 2.1rem; }
.table.edit td { padding: .5rem .6rem; }
.table.edit td:first-child { min-width: 150px; }
.table.edit td:first-child .small { display: block; margin-top: 2px; }
.crit.off .card-body { opacity: .5; }
.ord { flex: none; width: 26px; height: 26px; border-radius: 6px; background: var(--navy); color: #fff; display: grid; place-items: center; font: 700 .8rem var(--font-head); }
.title-in { font: 700 1rem var(--font-head); color: var(--navy); border-color: transparent; min-height: 38px; }
.title-in:hover { border-color: var(--line-strong); }
.bands { width: 100%; border-collapse: collapse; margin-bottom: .5rem; }
.bands th { text-align: left; font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding: .3rem .4rem; border-bottom: 1px solid var(--line); }
.bands td { padding: .35rem .4rem; border-bottom: 1px solid var(--line); }
.bands td:last-child { width: 44px; }
.mini { gap: .6rem; }
.pub { border-left: 4px solid var(--blue); }
.errs { margin: 0; padding-left: 1rem; }
</style>
