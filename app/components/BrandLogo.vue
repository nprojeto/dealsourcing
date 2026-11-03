<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'azul' | 'branca'
  tagline?: boolean
  symbol?: boolean
  height?: number
}>(), { variant: 'azul', tagline: false, symbol: false, height: 32 })

const src = computed(() => {
  if (props.symbol) return useAsset(`brand/simbolo-${props.variant === 'branca' ? 'branco' : 'azul'}.png`)
  return useAsset(`brand/logo${props.tagline ? '-tagline' : ''}-${props.variant}.png`)
})
</script>

<template>
  <img :src="src" :style="{ height: `${height}px`, width: 'auto' }"
    :alt="symbol ? '' : 'NOVALE — Transformando ideias em soluções inteligentes'" draggable="false">
</template>
