<script setup lang="ts">
/** Resultado exibido ao proprietário do ISP (quando liberado em Configurações). */
import type { OwnerResultData } from '~/utils/simulator'
defineProps<{ result: OwnerResultData; compact?: boolean }>()
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
.compact .range { padding: 1.1rem; }
</style>
