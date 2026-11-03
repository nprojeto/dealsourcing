<script setup lang="ts">
/** Resultado exibido ao proprietário do ISP (quando liberado em Configurações). */
import type { OwnerResultData } from '~/utils/simulator'
const props = defineProps<{ result: OwnerResultData; compact?: boolean }>()
const reducing = computed(() => (props.result.factors ?? []).filter((f) => f.penalty > 0))
const ok = computed(() => (props.result.factors ?? []).filter((f) => !f.penalty))
</script>

<template>
  <div class="owner-res" :class="{ compact }">
    <div class="range">
      <BrandLogo class="sph" variant="branca" symbol :height="180" />
      <span class="lbl">Valor estimado do provedor</span>
      <div class="vals">
        <strong>{{ fmtBRL(result.value_min) }}</strong>
        <span class="to">a</span>
        <strong>{{ fmtBRL(result.value_max) }}</strong>
      </div>
      <span class="note">Estimativa preliminar, sem caráter de proposta.</span>
    </div>
    <div v-if="result.factors" class="factors">
      <div v-if="reducing.length">
        <div class="eyebrow">O que reduziu a estimativa</div>
        <ul>
          <li v-for="f in reducing" :key="f.label" class="down">
            <span><b>{{ f.label }}</b><small>{{ f.band }}</small></span><em>−{{ fmtPct(f.penalty) }}</em>
          </li>
        </ul>
      </div>
      <div v-if="ok.length">
        <div class="eyebrow">Sem redução</div>
        <ul>
          <li v-for="f in ok" :key="f.label" class="up">
            <span><b>{{ f.label }}</b><small>{{ f.band }}</small></span><em><AppIcon name="check" :size="14" :stroke="2.4" /></em>
          </li>
        </ul>
      </div>
      <p v-if="reducing.length" class="small muted tip">Dica: ajustar esses pontos na operação pode aumentar o valor do seu provedor.</p>
    </div>
  </div>
</template>

<style scoped>
.range { position: relative; overflow: hidden; text-align: center; background: linear-gradient(140deg, var(--navy), var(--navy-900)); color: #fff; border-radius: var(--radius-lg); padding: 1.5rem 1.25rem; }
.sph { position: absolute; right: -50px; top: -40px; opacity: .1; pointer-events: none; }
.lbl { position: relative; display: block; font-size: .74rem; letter-spacing: .12em; text-transform: uppercase; color: #9FB0E8; font-weight: 700; }
.vals { position: relative; display: flex; align-items: baseline; justify-content: center; gap: .6rem; flex-wrap: wrap; margin: .5rem 0 .3rem; }
.vals strong { font: 800 clamp(1.4rem, 3.4vw, 2rem) var(--font-head); }
.to { color: #9FB0E8; font-weight: 600; }
.note { position: relative; font-size: .78rem; color: #C9D3F0; }
.factors { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-top: 1.25rem; text-align: left; }
.factors ul { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; }
.factors li { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .55rem .75rem; border-radius: var(--radius); border: 1px solid var(--line); background: #fff; }
.factors li span { display: flex; flex-direction: column; }
.factors li b { font-size: .86rem; color: var(--navy); }
.factors li small { font-size: .76rem; color: var(--muted); }
.factors li em { font-style: normal; font-weight: 700; white-space: nowrap; }
.down { border-left: 3px solid var(--danger) !important; }
.down em { color: var(--danger); }
.up { border-left: 3px solid var(--success) !important; }
.up em { color: var(--success); display: grid; place-items: center; }
.tip { grid-column: 1 / -1; margin: 0; }
.compact .range { padding: 1.1rem; }
@media (max-width: 640px) { .factors { grid-template-columns: 1fr; } }
</style>
