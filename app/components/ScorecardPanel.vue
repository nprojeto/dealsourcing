<script setup lang="ts">
/** Avaliação do indicador (parceiro externo): 6 critérios, duas fases, faixa de comissão. Só admin e gestão. */
interface Criterion { key: string; sort_order: number; title: string; weight: number; phase: number; help: string | null; level_low: string; level_mid: string; level_high: string }
interface Band { min_points: number; max_points: number; percent: number; label: string; description: string | null }
interface FeeAdj { max_fee: number; points: number; label: string; description: string | null }
interface Score { total: number; base_total?: number; fee_pct?: number | null; fee_points?: number; fee_label?: string | null; max_points?: number; phase1_filled: boolean; phase2_filled: boolean; phase1_done: boolean; complete: boolean; percent: number | null; band: string | null }
export interface Scorecard {
  criteria: Criterion[]; bands: Band[]; fee_adjustments?: FeeAdj[]; score: Score; phase1_stage: string; final_stage: string | null
  evaluation: { levels: Record<string, string>; notes: Record<string, string>; phase1_done_at: string | null; presented_at: string | null; phase2_done_at: string | null
    p1?: { full_name: string } | null; p2?: { full_name: string } | null; pr?: { full_name: string } | null } | null
}
const props = defineProps<{ oppId: string; data: Scorecard; stageKey: string; stagePos: Record<string, number>; locked: boolean; isAdmin: boolean }>()
const emit = defineEmits<{ updated: [Scorecard] }>()
const api = useApi(); const toast = useToast()

const levels = reactive<Record<string, string>>({ ...(props.data.evaluation?.levels ?? {}) })
const notes = reactive<Record<string, string>>({ ...(props.data.evaluation?.notes ?? {}) })
const open = ref<string | null>(null)
const busy = ref('')
const dirty = ref(false)
watch(() => props.data, (v) => { Object.assign(levels, v.evaluation?.levels ?? {}); Object.assign(notes, v.evaluation?.notes ?? {}); dirty.value = false })

const LV = [{ k: 'baixo', t: 'Baixo' }, { k: 'medio', t: 'Médio' }, { k: 'alto', t: 'Alto' }] as const
const pts = (c: Criterion, lv?: string) => lv === 'alto' ? Number(c.weight) : lv === 'medio' ? Number(c.weight) / 2 : 0
const base = computed(() => props.data.criteria.reduce((a, c) => a + pts(c, levels[c.key]), 0))
const fee = computed(() => props.data.score.fee_pct ?? null)
const adj = computed(() => fee.value === null ? null : ((props.data.fee_adjustments ?? []).find((a) => Number(fee.value) <= Number(a.max_fee)) ?? (props.data.fee_adjustments ?? []).at(-1) ?? null))
const maxPts = computed(() => props.data.bands.length ? Math.max(...props.data.bands.map((b) => Number(b.max_points))) : 100)
const total = computed(() => Math.max(0, Math.min(maxPts.value, base.value + Number(adj.value?.points ?? 0))))
const band = computed(() => [...props.data.bands].reverse().find((b) => (total.value > Number(b.min_points) || (Number(b.min_points) === 0 && total.value >= 0)) && total.value <= Number(b.max_points)) ?? null)
const fmtN = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const fmtP = (n: number) => `${n > 0 ? '+' : ''}${fmtN(n)}`
const ev = computed(() => props.data.evaluation)
const p1Missing = computed(() => props.data.criteria.filter((c) => c.phase === 1 && !levels[c.key]).length)
const p2Missing = computed(() => props.data.criteria.filter((c) => c.phase === 2 && !levels[c.key]).length)
const atPhase1 = computed(() => (props.stagePos[props.stageKey] ?? 0) >= (props.stagePos[props.data.phase1_stage] ?? 99))
const lvText = (c: Criterion, k: string) => k === 'alto' ? c.level_high : k === 'medio' ? c.level_mid : c.level_low

function pick(c: Criterion, k: string) { if (props.locked) return; levels[c.key] = levels[c.key] === k ? '' : k; dirty.value = true }
async function send(action: string, extra: Record<string, unknown> = {}) {
  busy.value = action
  try {
    const r = await api.put<Scorecard>(`/crm/opportunities/${props.oppId}/scorecard`, { action, levels: { ...levels }, notes: { ...notes }, ...extra })
    emit('updated', r); dirty.value = false
    toast.success(action === 'phase1' ? '1ª avaliação concluída.' : action === 'phase2' ? 'Avaliação concluída. A venda já pode ser assinada.' : action === 'present' ? 'Apresentação ao indicador registrada.' : action === 'reopen' ? 'Avaliação reaberta.' : 'Avaliação salva.')
  } catch (e) { toast.error(errorMessage(e)) } finally { busy.value = '' }
}
</script>

<template>
  <section class="box sc">
    <div class="row between head">
      <div class="eyebrow">Avaliação do indicador <span class="lock"><AppIcon name="lock" :size="12" /> só admin e gestão</span></div>
      <div class="score">
        <b>{{ fmtN(total) }}</b><span class="muted">/{{ fmtN(maxPts) }}</span>
        <span v-if="band" class="badge info">{{ band.label }} · {{ Number(band.percent).toLocaleString('pt-BR') }}%</span>
      </div>
    </div>
    <div class="steps small">
      <span :class="{ ok: ev?.phase1_done_at }"><AppIcon :name="ev?.phase1_done_at ? 'check' : 'clock'" :size="14" /> 1ª fase (critérios 1–4 e 6)<template v-if="ev?.phase1_done_at"> · {{ fmtDay(ev.phase1_done_at) }}{{ ev.p1 ? ` · ${ev.p1.full_name}` : '' }}</template></span>
      <span :class="{ ok: ev?.presented_at }"><AppIcon :name="ev?.presented_at ? 'check' : 'clock'" :size="14" /> Apresentada ao indicador<template v-if="ev?.presented_at"> · {{ fmtDay(ev.presented_at) }}</template></span>
      <span :class="{ ok: ev?.phase2_done_at }"><AppIcon :name="ev?.phase2_done_at ? 'check' : 'clock'" :size="14" /> 2ª fase (critério 5)<template v-if="ev?.phase2_done_at"> · {{ fmtDay(ev.phase2_done_at) }}{{ ev.p2 ? ` · ${ev.p2.full_name}` : '' }}</template></span>
    </div>
    <div class="feeline small" :class="{ miss: fee === null }">
      <template v-if="fee !== null && adj">
        <span>Etapas: <b>{{ fmtN(base) }}</b> pts</span>
        <span>Taxa do mandato: <b>{{ fmtN(Number(fee)) }}%</b> · {{ adj.label }} · <b :class="Number(adj.points) > 0 ? 'up' : Number(adj.points) < 0 ? 'down' : ''">{{ fmtP(Number(adj.points)) }} pts</b></span>
        <span>Final: <b>{{ fmtN(total) }}</b> pts</span>
      </template>
      <span v-else><AppIcon name="alert" :size="14" /> Taxa do mandato ainda não informada: o ajuste de pontos (bônus ou penalidade) entra quando ela for registrada.</span>
    </div>
    <div v-if="atPhase1 && !ev?.phase1_done_at && !locked" class="alert warning small"><AppIcon name="alert" :size="16" /> A oportunidade já chegou na Oferta final: conclua a 1ª avaliação e apresente ao indicador.</div>

    <div v-for="c in data.criteria" :key="c.key" class="crit" :class="{ p2: c.phase === 2 }">
      <div class="row between ct">
        <button class="linklike" type="button" @click="open = open === c.key ? null : c.key">
          <b>{{ c.sort_order }}. {{ c.title }}</b> <span class="muted small">{{ fmtN(Number(c.weight)) }} pts{{ c.phase === 2 ? ' · 2ª fase' : '' }}</span>
          <AppIcon name="info" :size="14" />
        </button>
        <div class="lv" role="group" :aria-label="c.title">
          <button v-for="l in LV" :key="l.k" type="button" :class="['lvb', l.k, { on: levels[c.key] === l.k }]" :disabled="locked" :title="lvText(c, l.k)" @click="pick(c, l.k)">
            {{ l.t }}<small>{{ fmtN(pts(c, l.k)) }}</small>
          </button>
        </div>
      </div>
      <div v-if="levels[c.key]" class="chosen small">{{ lvText(c, levels[c.key]) }}</div>
      <div v-if="open === c.key" class="help small">
        <p v-if="c.help" style="margin:0 0 .4rem">{{ c.help }}</p>
        <div><b>Baixo:</b> {{ c.level_low }}</div><div><b>Médio:</b> {{ c.level_mid }}</div><div><b>Alto:</b> {{ c.level_high }}</div>
      </div>
      <input v-model="notes[c.key]" class="input note" :disabled="locked" maxlength="1000" placeholder="Justificativa (recomendado)" @input="dirty = true">
    </div>

    <div v-if="!locked" class="row end acts">
      <button v-if="isAdmin && (ev?.phase1_done_at || ev?.phase2_done_at)" class="btn btn-ghost btn-sm" :disabled="!!busy" @click="send('reopen')">Reabrir avaliação</button>
      <button class="btn btn-outline btn-sm" :disabled="!!busy || !dirty" @click="send('save')"><span v-if="busy === 'save'" class="spinner" /> Salvar</button>
      <button v-if="!ev?.phase1_done_at" class="btn btn-sm" :disabled="!!busy || p1Missing > 0" :title="p1Missing ? `Faltam ${p1Missing} critério(s) da 1ª fase` : ''" @click="send('phase1')">Concluir 1ª fase</button>
      <button v-else-if="!ev?.presented_at" class="btn btn-sm" :disabled="!!busy" @click="send('present')">Registrar apresentação ao indicador</button>
      <button v-if="ev?.phase1_done_at && !ev?.phase2_done_at" class="btn btn-sm btn-navy" :disabled="!!busy || p2Missing > 0" :title="p2Missing ? 'Avalie o critério 5' : ''" @click="send('phase2')">Concluir avaliação</button>
    </div>
    <p v-else class="small muted" style="margin:.5rem 0 0">Venda assinada: avaliação fechada. A comissão usou {{ fmtN(data.score.total) }} pontos · {{ data.score.band }}.</p>
  </section>
</template>

<style scoped>
.sc { display: grid; gap: .6rem; }
.head { flex-wrap: wrap; gap: .4rem; }
.lock { display: inline-flex; align-items: center; gap: .2rem; margin-left: .4rem; color: var(--muted); font-weight: 500; text-transform: none; letter-spacing: 0; }
.score { display: flex; align-items: baseline; gap: .35rem; }
.score b { font: 800 1.5rem var(--font-head); color: var(--navy); }
.steps { display: flex; flex-wrap: wrap; gap: .3rem 1rem; color: var(--muted); }
.steps span { display: inline-flex; align-items: center; gap: .3rem; }
.steps .ok { color: #1e6b33; }
.crit { border-top: 1px solid var(--line); padding-top: .6rem; display: grid; gap: .35rem; }
.crit.p2 { background: linear-gradient(90deg, rgba(45,91,215,.05), transparent); }
.ct { gap: .5rem; flex-wrap: wrap; }
.linklike { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: .35rem; color: var(--ink); }
.linklike :deep(svg) { color: var(--blue); }
.lv { display: inline-flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.lvb { border: 0; background: #fff; padding: .3rem .7rem; font-size: .8rem; font-weight: 600; cursor: pointer; display: grid; line-height: 1.1; color: var(--ink-2); border-left: 1px solid var(--line); }
.lvb:first-child { border-left: 0; }
.lvb small { font-weight: 500; font-size: .68rem; color: var(--muted); }
.lvb.on.baixo { background: #fdecec; color: #a61b1b; }
.lvb.on.medio { background: #fff4db; color: #8a5a00; }
.lvb.on.alto { background: #e6f4ea; color: #1e6b33; }
.lvb:disabled { cursor: default; }
.feeline { display: flex; flex-wrap: wrap; gap: .3rem 1.1rem; background: var(--tint); border-radius: 8px; padding: .45rem .7rem; color: var(--ink-2); }
.feeline.miss { background: #fff8e6; color: #8a5a00; }
.feeline span { display: inline-flex; align-items: center; gap: .3rem; }
.feeline .up { color: #1e6b33; } .feeline .down { color: #a61b1b; }
.chosen { color: var(--ink-2); }
.help { background: var(--tint); border-radius: 8px; padding: .6rem .8rem; display: grid; gap: .2rem; color: var(--ink-2); }
.note { font-size: .85rem; padding: .35rem .6rem; }
.acts { gap: .4rem; flex-wrap: wrap; margin-top: .3rem; }
</style>
