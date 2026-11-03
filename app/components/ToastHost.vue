<script setup lang="ts">
const { toasts, dismiss } = useToast()
const icon = (t: string) => (t === 'success' ? 'check-circle' : t === 'danger' || t === 'warning' ? 'alert' : 'info')
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.tone" role="status">
        <AppIcon :name="icon(t.tone)" :size="18" />
        <span class="grow">{{ t.text }}</span>
        <button class="close" aria-label="Fechar" @click="dismiss(t.id)"><AppIcon name="x" :size="16" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts { position: fixed; right: 16px; bottom: 16px; z-index: 300; display: flex; flex-direction: column; gap: 8px; max-width: min(420px, calc(100vw - 32px)); }
.toast { display: flex; gap: .65rem; align-items: flex-start; padding: .8rem .9rem; border-radius: var(--radius); background: var(--navy); color: #fff; box-shadow: var(--shadow-lg); font-size: .9rem; border-left: 4px solid #7F93D9; }
.toast.success { border-left-color: #3FBF7F; }
.toast.danger { border-left-color: #FF6B6F; }
.toast.warning { border-left-color: #F2B53A; }
.close { background: none; border: 0; color: rgba(255,255,255,.7); cursor: pointer; padding: 0; }
.close:hover { color: #fff; }
.toast-enter-active, .toast-leave-active { transition: all .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
</style>
