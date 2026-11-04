<script setup lang="ts">
import type { Stage } from '~/utils/simulator'
const api = useApi()
const toast = useToast()
const stages = ref<Stage[]>([])
const loading = ref(true)
const busy = ref('')
const drafts = reactive<Record<string, { name: string; description: string; sla_days: number | ''; requires_assignee: boolean; requires_note: boolean }>>({})

async function load() {
  loading.value = true
  try {
    stages.value = (await api.get<{ items: Stage[] }>('/crm/stages')).items
    for (const s of stages.value) drafts[s.key] = { name: s.name, description: s.description ?? '', sla_days: s.sla_days ?? '', requires_assignee: s.requires_assignee, requires_note: s.requires_note }
  } catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
onMounted(load)

const middle = computed(() => stages.value.filter((s) => !s.is_won && !s.is_lost))
const terminal = computed(() => stages.value.filter((s) => s.is_won || s.is_lost))
const order = ref<string[]>([])
watch(middle, (m) => { order.value = m.map((s) => s.key) }, { immediate: true })
const ordered = computed(() => order.value.map((k) => stages.value.find((s) => s.key === k)!).filter(Boolean))
const orderDirty = computed(() => order.value.join() !== middle.value.map((s) => s.key).join())
function moveUp(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= order.value.length) return
  const arr = [...order.value]; [arr[i], arr[j]] = [arr[j]!, arr[i]!]; order.value = arr
}
async function saveOrder() {
  busy.value = 'order'
  try { await api.post('/admin/stages/reorder', { keys: order.value }); toast.success('Ordem das etapas salva.'); await load() }
  catch (e) { toast.error(errorMessage(e)) } finally { busy.value = '' }
}
function dirty(s: Stage) {
  const d = drafts[s.key]; if (!d) return false
  return d.name !== s.name || d.description !== (s.description ?? '') || String(d.sla_days) !== String(s.sla_days ?? '') || d.requires_assignee !== s.requires_assignee || d.requires_note !== s.requires_note
}
async function save(s: Stage) {
  busy.value = s.key
  try { await api.put(`/admin/stages/${s.key}`, drafts[s.key]); toast.success(`Etapa "${drafts[s.key]!.name}" salva.`); await load() }
  catch (e) { toast.error(errorMessage(e)) } finally { busy.value = '' }
}
async function toggle(s: Stage) {
  busy.value = s.key
  try { await api.put(`/admin/stages/${s.key}`, { active: !s.active }); toast.success(s.active ? 'Etapa desativada.' : 'Etapa reativada.'); await load() }
  catch (e) { toast.error(errorMessage(e)) } finally { busy.value = '' }
}
const nw = reactive({ name: '', sla_days: '' as number | '', requires_assignee: true })
async function create() {
  busy.value = 'new'
  try { await api.post('/admin/stages', nw); toast.success('Etapa criada no fim do funil. Ajuste a posição se precisar.'); Object.assign(nw, { name: '', sla_days: '', requires_assignee: true }); await load() }
  catch (e) { toast.error(errorMessage(e)) } finally { busy.value = '' }
}
</script>

<template>
  <div class="stack">
    <div class="alert info small"><AppIcon name="info" :size="18" />
      <span>As etapas marcadas como <b>sistema</b> são usadas automaticamente (cadastro, simulação, formalização, conclusão e perda): podem ser renomeadas, mas não desativadas. As regras gerais (voltar ou pular etapas, prazos) ficam na aba <b>Parâmetros do sistema</b>, em "Funil comercial".</span></div>
    <div v-if="loading" class="empty"><span class="spinner" /></div>
    <template v-else>
      <div class="table-wrap">
        <table class="table st">
          <thead><tr><th>Ordem</th><th>Etapa</th><th title="Em branco usa o padrão geral">Alerta de parada</th><th>Exige responsável</th><th>Exige observação</th><th>Oport.</th><th /></tr></thead>
          <tbody>
            <tr v-for="(s, i) in ordered" :key="s.key" :class="{ off: !s.active }">
              <td class="nowrap"><span class="pos">{{ i + 1 }}</span>
                <button class="icon-btn sm" :disabled="i === 0" aria-label="Subir" @click="moveUp(i, -1)"><AppIcon name="chevron-left" :size="16" style="transform:rotate(90deg)" /></button>
                <button class="icon-btn sm" :disabled="i === ordered.length - 1" aria-label="Descer" @click="moveUp(i, 1)"><AppIcon name="chevron-right" :size="16" style="transform:rotate(90deg)" /></button></td>
              <td><input v-model="drafts[s.key]!.name" class="input sm" :aria-label="`Nome da etapa ${i + 1}`">
                <div class="small muted">{{ s.is_system ? 'Sistema' : 'Personalizada' }}<template v-if="!s.active"> · desativada</template></div></td>
              <td><div class="suffix"><input v-model.number="drafts[s.key]!.sla_days" class="input sm num" type="number" min="1" max="365" placeholder="—" title="Em branco usa o padrão geral"><span>dias</span></div></td>
              <td><label class="switch"><input v-model="drafts[s.key]!.requires_assignee" type="checkbox"><span class="track" /></label></td>
              <td><label class="switch"><input v-model="drafts[s.key]!.requires_note" type="checkbox"><span class="track" /></label></td>
              <td>{{ s.count ?? 0 }}</td>
              <td class="nowrap">
                <button class="btn btn-sm" :disabled="!dirty(s) || busy === s.key" @click="save(s)">Salvar</button>
                <button v-if="!s.is_system" class="btn btn-ghost btn-sm" :disabled="busy === s.key" @click="toggle(s)">{{ s.active ? 'Desativar' : 'Reativar' }}</button>
              </td>
            </tr>
            <tr v-for="s in terminal" :key="s.key" class="term">
              <td><span class="pos">{{ s.position }}</span></td>
              <td><input v-model="drafts[s.key]!.name" class="input sm"><div class="small muted">Sistema · {{ s.is_won ? 'encerra como ganha' : 'encerra como perdida (exige motivo)' }}</div></td>
              <td class="muted small">—</td>
              <td><label class="switch"><input v-model="drafts[s.key]!.requires_assignee" type="checkbox"><span class="track" /></label></td>
              <td><label class="switch"><input v-model="drafts[s.key]!.requires_note" type="checkbox" :disabled="s.is_lost"><span class="track" /></label></td>
              <td>{{ s.count ?? 0 }}</td>
              <td><button class="btn btn-sm" :disabled="!dirty(s) || busy === s.key" @click="save(s)">Salvar</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="orderDirty" class="row end"><button class="btn btn-ghost btn-sm" @click="order = middle.map((s) => s.key)">Desfazer</button>
        <button class="btn" :disabled="busy === 'order'" @click="saveOrder">Salvar nova ordem</button></div>

      <article class="card">
        <div class="card-head"><h2>Nova etapa</h2></div>
        <div class="card-body form-grid">
          <div class="field"><label for="ns-name">Nome</label><input id="ns-name" v-model="nw.name" class="input" placeholder="Ex.: Validação técnica"></div>
          <div class="field"><label for="ns-sla">Alerta de parada (dias)</label><input id="ns-sla" v-model.number="nw.sla_days" class="input" type="number" min="1" max="365" placeholder="Usar o padrão"></div>
          <label class="check full"><input v-model="nw.requires_assignee" type="checkbox"> Exigir responsável para entrar nesta etapa</label>
          <div class="full row end"><button class="btn" :disabled="busy === 'new' || nw.name.trim().length < 2" @click="create"><AppIcon name="plus" :size="16" /> Criar etapa</button></div>
        </div>
      </article>
    </template>
  </div>
</template>

<style scoped>
.st td { padding: .5rem .7rem; }
.pos { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; background: var(--navy); color: #fff; font: 700 .72rem var(--font-head); margin-right: .25rem; }
.icon-btn.sm { width: 28px; height: 28px; }
.input.sm { min-height: 36px; padding: .4rem .6rem; font-size: .9rem; }
.num { width: 110px; }
.suffix { position: relative; width: 110px; }
.suffix span { position: absolute; right: .6rem; top: 50%; transform: translateY(-50%); font-size: .75rem; color: var(--muted); pointer-events: none; }
.suffix .input { padding-right: 2.6rem; }
tr.off td { opacity: .55; }
tr.term td { background: #F4F6FB !important; }
</style>
