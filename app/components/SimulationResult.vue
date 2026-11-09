<script setup lang="ts">
/** Resultado financeiro interno de uma simulação (somente equipe NOVALE). */
import type { SimPenalty as Penalty, SimResult } from '~/utils/simulator'
defineProps<{ result: SimResult; clientBase?: number }>()
function showInput(p: Penalty) {
  if (p.key === 'arpu') return fmtBRL(Number(p.input))
  if (p.key === 'poles_valid_pct') return `${Number(p.input).toLocaleString('pt-BR')}%`
  if (p.key === 'client_base') return `${fmtInt(Number(p.input))} clientes`
  if (p.input === null || p.input === undefined) return ''
  if (p.key === 'clt_pct') return `${Number(p.input).toLocaleString('pt-BR')}% em CLT`
  if (p.key === 'clt_avg_salary' || p.key === 'pj_avg_fee') return `${fmtBRL(Number(p.input))}/mês`
  return String(p.input)
}
/** Opções (Sim/Não…) já aparecem pelo nome da faixa; números mostram valor e faixa. */
function detail(p: Penalty) {
  if (!p.applied && p.input === null) return p.band
  if (p.key === 'regularized') return p.band
  return `${showInput(p)} · ${p.band}`
}
</script>

<template>
  <div class="res">
    <div class="range">
      <div><span class="lbl">Valor mínimo estimado</span><strong>{{ fmtBRL(result.value_min) }}</strong></div>
      <div class="sep" />
      <div><span class="lbl">Valor máximo estimado</span><strong>{{ fmtBRL(result.value_max) }}</strong></div>
    </div>
    <table class="calc">
      <tbody>
        <tr><td>Região</td><td>{{ REGION_LABEL[result.region_code] ?? result.region_code }} · {{ fmtBRL(result.base_min_per_client) }} a {{ fmtBRL(result.base_max_per_client) }} por cliente</td></tr>
        <tr><td>Valor-base</td><td>{{ fmtBRL(result.base_min_total) }} a {{ fmtBRL(result.base_max_total) }}<template v-if="clientBase"> ({{ fmtInt(clientBase) }} clientes)</template></td></tr>
        <tr v-for="p in result.penalties" :key="p.key" :class="{ off: !p.applied }">
          <td>{{ p.label }}</td>
          <td><span class="muted">{{ detail(p) }}</span>
            <b class="pen" :class="{ zero: !p.penalty }">{{ p.applied ? `−${fmtPct(p.penalty)}` : p.band.startsWith('Não se aplica') ? 'não se aplica' : 'desativado' }}</b></td>
        </tr>
        <tr class="tot"><td>Penalização total</td><td><b>{{ fmtPct(result.total_penalty) }}</b>
          <span class="muted small"> · {{ result.formula === 'multiplicative' ? 'composição multiplicativa' : 'soma aditiva' }} · parâmetros v{{ result.parameter_version }}</span></td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.range { display: flex; flex-wrap: wrap; align-items: stretch; gap: 1rem; background: var(--navy); color: #fff; border-radius: var(--radius); padding: .9rem 1.1rem; }
.range > div:not(.sep) { flex: 1 1 150px; min-width: 0; }
.range strong { display: block; overflow-wrap: anywhere; }
.range .sep { width: 1px; background: rgba(255,255,255,.2); }
.lbl { display: block; font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; color: #9FB0E8; font-weight: 600; }
.range strong { font: 800 1.25rem var(--font-head); }
.calc { width: 100%; border-collapse: collapse; margin-top: .6rem; font-size: .85rem; }
.calc td { padding: .45rem .3rem; border-bottom: 1px solid var(--line); vertical-align: top; }
.calc td:first-child { color: var(--muted); width: 38%; }
.calc td:last-child { display: flex; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
.pen { color: var(--danger); white-space: nowrap; }
.pen.zero { color: var(--success); }
.off { opacity: .55; }
.tot td { border-bottom: 0; }
.tot b { color: var(--navy); }
@media (max-width: 520px) { .range { flex-direction: column; } .range .sep { height: 1px; width: auto; } }
</style>
