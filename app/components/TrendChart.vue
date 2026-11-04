<script setup lang="ts">
/** Barras agrupadas por período, com dica ao passar o mouse (SVG, sem bibliotecas). */
interface Serie { key: string; name: string; color: string; values: number[] }
const props = defineProps<{ labels: string[]; series: Serie[]; height?: number }>()
const box = ref<HTMLElement | null>(null)
const width = ref(720)
const H = computed(() => props.height ?? 260)
const pad = { l: 40, r: 16, t: 12, b: 28 }
let ro: ResizeObserver | null = null
onMounted(() => {
  if (!box.value) return
  width.value = box.value.clientWidth || 720
  ro = new ResizeObserver(([e]) => { width.value = Math.max(260, Math.floor(e!.contentRect.width)) })
  ro.observe(box.value)
})
onBeforeUnmount(() => ro?.disconnect())

const hidden = ref<Set<string>>(new Set())
function toggle(k: string) { const s = new Set(hidden.value); if (s.has(k)) s.delete(k); else if (s.size < props.series.length - 1) s.add(k); hidden.value = s }
const shown = computed(() => props.series.filter((s) => !hidden.value.has(s.key)))
const max = computed(() => {
  const m = Math.max(1, ...shown.value.flatMap((s) => s.values))
  const step = niceStep(m / 4)
  return Math.ceil(m / step) * step
})
function niceStep(x: number) { const p = 10 ** Math.floor(Math.log10(Math.max(1, x))); const n = x / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p }
const ticks = computed(() => { const st = niceStep(max.value / 4); const out = []; for (let v = 0; v <= max.value; v += st) out.push(v); return out })
const iw = computed(() => width.value - pad.l - pad.r)
const ih = computed(() => H.value - pad.t - pad.b)
const n = computed(() => props.labels.length)
const band = computed(() => iw.value / Math.max(1, n.value))
const x = (i: number) => pad.l + band.value * (i + .5)
const y = (v: number) => pad.t + ih.value - (v / max.value) * ih.value
const barW = computed(() => { const k = Math.max(1, shown.value.length); return Math.max(2, Math.min(18, (band.value * .78 - 2 * (k - 1)) / k)) })
function barX(i: number, j: number) { const k = shown.value.length; const total = k * barW.value + 2 * (k - 1); return x(i) - total / 2 + j * (barW.value + 2) }
/** Barra com o topo arredondado (4px) e a base reta, apoiada no eixo. */
function bar(i: number, j: number, v: number) {
  const x0 = barX(i, j); const w = barW.value; const y0 = y(0); const y1 = y(v); const r = Math.min(4, w / 2, y0 - y1)
  if (v <= 0) return ''
  return `M${x0},${y0}V${y1 + r}Q${x0},${y1} ${x0 + r},${y1}H${x0 + w - r}Q${x0 + w},${y1} ${x0 + w},${y1 + r}V${y0}Z`
}
const labelEvery = computed(() => Math.max(1, Math.ceil(n.value / Math.max(2, Math.floor(iw.value / 64)))))

const hover = ref<number | null>(null)
function onMove(e: PointerEvent) {
  const r = (e.currentTarget as SVGRectElement).getBoundingClientRect()
  const px = e.clientX - r.left
  hover.value = Math.max(0, Math.min(n.value - 1, Math.floor((px / r.width) * n.value)))
}
const tipLeft = computed(() => hover.value === null ? 0 : Math.min(Math.max(x(hover.value) + 12, 0), width.value - 190))
const totals = computed(() => Object.fromEntries(props.series.map((s) => [s.key, s.values.reduce((a, b) => a + b, 0)])))
</script>

<template>
  <div class="trend">
    <div class="legend" role="group" aria-label="Séries do gráfico">
      <button v-for="s in series" :key="s.key" type="button" class="lg" :class="{ off: hidden.has(s.key) }" :aria-pressed="!hidden.has(s.key)" @click="toggle(s.key)">
        <span class="sw" :style="{ background: s.color }" />{{ s.name }} <b>{{ totals[s.key]?.toLocaleString('pt-BR') }}</b>
      </button>
    </div>
    <div ref="box" class="plot">
      <svg :width="width" :height="H" role="img" :aria-label="`Evolução: ${series.map((s) => `${s.name} ${totals[s.key]}`).join(', ')}`">
        <g class="grid">
          <g v-for="t in ticks" :key="t"><line :x1="pad.l" :x2="width - pad.r" :y1="y(t)" :y2="y(t)" /><text :x="pad.l - 8" :y="y(t) + 4" text-anchor="end">{{ t.toLocaleString('pt-BR') }}</text></g>
          <template v-for="(l, i) in labels" :key="l"><text v-if="i % labelEvery === 0 || i === n - 1" :x="x(i)" :y="H - 8" text-anchor="middle">{{ l }}</text></template>
        </g>
        <rect v-if="hover !== null" class="hl" :x="pad.l + band * hover" :y="pad.t" :width="band" :height="ih" />
        <g v-for="(s, j) in shown" :key="s.key">
          <template v-for="(v, i) in s.values" :key="i"><path v-if="v > 0" :d="bar(i, j, v)" :fill="s.color" /></template>
        </g>
        <line class="axis" :x1="pad.l" :x2="width - pad.r" :y1="y(0)" :y2="y(0)" />
        <rect :x="pad.l" :y="pad.t" :width="iw" :height="ih" fill="transparent" @pointermove="onMove" @pointerleave="hover = null" />
      </svg>
      <div v-if="hover !== null" class="tip" :style="{ left: `${tipLeft}px` }">
        <strong>{{ labels[hover] }}</strong>
        <div v-for="s in shown" :key="s.key" class="row-t"><span class="sw" :style="{ background: s.color }" />{{ s.name }}<b>{{ (s.values[hover] ?? 0).toLocaleString('pt-BR') }}</b></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trend { display: grid; gap: .6rem; min-width: 0; grid-template-columns: minmax(0, 1fr); }
.legend { display: flex; flex-wrap: wrap; gap: .4rem; }
.lg { display: inline-flex; align-items: center; gap: .4rem; border: 1px solid var(--line); background: #fff; border-radius: 99px; padding: .3rem .7rem; font: 500 .82rem var(--font-body); color: var(--ink-2); cursor: pointer; }
.lg b { color: var(--navy); }
.lg.off { opacity: .45; }
.sw { width: 10px; height: 10px; border-radius: 3px; flex: none; }
.plot { position: relative; width: 100%; overflow: hidden; }
svg { display: block; max-width: 100%; }
.grid line { stroke: var(--line); stroke-width: 1; }
.grid text { fill: var(--muted); font: 11px var(--font-body); }
.hl { fill: var(--tint); }
.axis { stroke: var(--line-strong); stroke-width: 1; }
.tip { position: absolute; top: 8px; min-width: 170px; background: #fff; border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 6px 20px rgba(13, 43, 94, .12); padding: .55rem .7rem; font-size: .8rem; pointer-events: none; display: grid; gap: .2rem; }
.tip strong { color: var(--navy); }
.row-t { display: flex; align-items: center; gap: .4rem; color: var(--ink-2); }
.row-t b { margin-left: auto; color: var(--ink); padding-left: .8rem; }
</style>
