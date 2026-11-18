<script setup lang="ts">
/** Botão "Como funciona": abre o vídeo tutorial do módulo atual. O admin liga/desliga em Configurações. */
const route = useRoute()
const pc = usePublicConfig()
onMounted(() => pc.load())
const base = useRuntimeConfig().app.baseURL.replace(/\/?$/, '/')
const tut = computed(() => tutorialFor(route.path))
const enabled = computed(() => pc.setting('tutorials_enabled', true) !== false)
const open = ref(false)
const src = computed(() => (tut.value ? `${base}tutoriais/${tut.value.slug}.mp4` : ''))
watch(() => route.path, () => { open.value = false })
</script>

<template>
  <template v-if="tut && enabled">
    <button class="tut-btn" type="button" :title="`Vídeo: como funciona ${tut.title}`" @click="open = true">
      <AppIcon name="play" :size="18" /><span>Como funciona</span>
    </button>
    <AppModal :open="open" :title="`Como funciona · ${tut.title}`" :width="980" @close="open = false">
      <video v-if="open" class="tut-video" :src="src" controls autoplay playsinline preload="auto" />
      <p class="small muted" style="margin:.6rem 0 0">Vídeo de até 1 minuto, com dados fictícios de demonstração.</p>
    </AppModal>
  </template>
</template>

<style scoped>
.tut-btn { display: inline-flex; align-items: center; gap: .4rem; height: 36px; padding: 0 .85rem; border-radius: 999px; border: 1px solid var(--line); background: #fff; color: var(--navy); font-weight: 600; font-size: .86rem; cursor: pointer; white-space: nowrap; }
.tut-btn :deep(svg) { color: var(--blue); }
.tut-btn:hover { background: var(--tint); border-color: var(--blue-100); }
.tut-video { display: block; width: 100%; aspect-ratio: 16 / 9; background: #0D2B5E; border-radius: 12px; }
@media (max-width: 600px) { .tut-btn span { display: none; } .tut-btn { width: 36px; padding: 0; justify-content: center; } }
</style>
