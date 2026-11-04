<script setup lang="ts">
/** Barras horizontais com rótulo, valor e observação (ex.: taxa de conversão). */
interface Row { key: string; label: string; value: number; display?: string; note?: string; noteTone?: string; title?: string }
const props = defineProps<{ rows: Row[]; color?: string; empty?: string }>()
const max = computed(() => Math.max(1, ...props.rows.map((r) => r.value)))
</script>

<template>
  <p v-if="!rows.length" class="small muted" style="margin:0">{{ empty ?? 'Sem dados no período.' }}</p>
  <ul v-else class="bars">
    <li v-for="r in rows" :key="r.key" :title="r.title ?? `${r.label}: ${r.display ?? r.value}`">
      <div class="top"><span class="lbl">{{ r.label }}</span><span class="val">{{ r.display ?? r.value.toLocaleString('pt-BR') }}</span>
        <span v-if="r.note" class="note" :class="r.noteTone">{{ r.note }}</span></div>
      <div class="track"><div class="fill" :style="{ width: `${Math.max(r.value > 0 ? 1.5 : 0, (r.value / max) * 100)}%`, background: color ?? 'var(--blue)' }" /></div>
    </li>
  </ul>
</template>

<style scoped>
.bars { list-style: none; margin: 0; padding: 0; display: grid; gap: .55rem; }
.top { display: flex; align-items: baseline; gap: .5rem; font-size: .84rem; margin-bottom: .2rem; }
.lbl { color: var(--ink-2); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.val { margin-left: auto; font-weight: 700; color: var(--navy); }
.note { font-size: .74rem; color: var(--muted); min-width: 52px; text-align: right; }
.note.low { color: var(--danger); font-weight: 600; }
.track { height: 8px; background: var(--tint); border-radius: 4px; overflow: hidden; }
.fill { height: 100%; border-radius: 4px; }
</style>
