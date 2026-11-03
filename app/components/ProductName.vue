<script setup lang="ts">
/** Nome do sistema: DealSourcing (produto NOVALE). */
withDefaults(defineProps<{ dark?: boolean; size?: number; byline?: boolean }>(), { dark: false, size: 18, byline: false })
</script>

<template>
  <span class="product" :class="{ dark }" :style="{ fontSize: `${size}px` }">
    <span class="word"><b>Deal</b><span>Sourcing</span></span>
    <small v-if="byline" class="by">by NOVALE</small>
  </span>
</template>

<style scoped>
.product { display: inline-flex; flex-direction: column; line-height: 1; font-family: var(--font-head); }
.word { letter-spacing: -.01em; white-space: nowrap; }
.word b { font-weight: 800; color: var(--navy); }
.word span { font-weight: 600; color: var(--blue); }
.by { font: 600 .5em var(--font-body); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-top: .35em; }
.dark .word b { color: #fff; }
.dark .word span { color: #9FB0E8; }
.dark .by { color: #8FA2DE; }
</style>
