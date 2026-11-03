<script setup lang="ts">
const props = withDefaults(defineProps<{ open: boolean; title: string; width?: number; side?: boolean }>(), { width: 520, side: false })
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)

function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && props.open) emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' })
watch(() => props.open, async (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
  if (v) { await nextTick(); panel.value?.focus() }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="overlay" :class="{ side }" @mousedown.self="emit('close')">
        <div ref="panel" class="panel" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1"
          :style="{ maxWidth: `${width}px` }">
          <header class="head">
            <h2>{{ title }}</h2>
            <button class="icon-btn" aria-label="Fechar" @click="emit('close')"><AppIcon name="x" /></button>
          </header>
          <div class="body"><slot /></div>
          <footer v-if="$slots.footer" class="foot"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 200; background: rgba(8, 29, 66, .55); display: grid; place-items: center; padding: 16px; }
.panel { width: 100%; max-height: calc(100vh - 32px); background: #fff; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; outline: none; overflow: hidden; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--line); border-top: 4px solid var(--navy); }
.head h2 { margin: 0; font-size: 1.1rem; }
.body { padding: 1.25rem; overflow-y: auto; }
.foot { padding: .9rem 1.25rem; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: .6rem; flex-wrap: wrap; background: var(--tint); }
.overlay.side { place-items: stretch end; padding: 0; }
.overlay.side .panel { height: 100vh; max-height: 100vh; border-radius: 0; }
@media (max-width: 600px) { .overlay { padding: 0; place-items: end stretch; } .panel { border-radius: var(--radius-lg) var(--radius-lg) 0 0; max-height: 92vh; } .overlay.side .panel { border-radius: 0; } }
</style>
