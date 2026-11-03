<script setup lang="ts">
const props = defineProps<{ kind: 'terms' | 'privacy' | null }>()
const emit = defineEmits<{ close: [] }>()
const { legal } = usePublicConfig()
const doc = computed(() => (props.kind ? legal(props.kind) : undefined))
</script>

<template>
  <AppModal :open="!!kind" :title="doc?.title ?? 'Documento'" :width="680" @close="emit('close')">
    <p v-if="doc" class="muted small">Versão {{ doc.version }} · publicada em {{ fmtDate(doc.published_at) }}</p>
    <div v-if="doc" class="legal-text">{{ doc.content }}</div>
    <p v-else class="muted">Documento indisponível no momento.</p>
    <template #footer><button class="btn" @click="emit('close')">Entendi</button></template>
  </AppModal>
</template>

<style scoped>
.legal-text { white-space: pre-wrap; font-size: .92rem; color: var(--ink-2); line-height: 1.7; }
</style>
