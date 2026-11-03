<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue: string[]; id?: string; placeholder?: string; invalid?: boolean; max?: number }>(), { max: 300 })
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()
const text = ref('')

function add(raw: string) {
  const parts = raw.split(/[,;\n]/).map((s) => s.trim().replace(/\s+/g, ' ')).filter((s) => s.length >= 2)
  if (!parts.length) return
  const out = [...props.modelValue]
  for (const p of parts) {
    if (out.length >= props.max) break
    if (!out.some((x) => x.toLocaleLowerCase('pt-BR') === p.toLocaleLowerCase('pt-BR'))) out.push(p)
  }
  emit('update:modelValue', out)
  text.value = ''
}
function remove(i: number) { emit('update:modelValue', props.modelValue.filter((_, j) => j !== i)) }
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',' || e.key === ';') { e.preventDefault(); add(text.value) }
  else if (e.key === 'Backspace' && !text.value && props.modelValue.length) remove(props.modelValue.length - 1)
}
</script>

<template>
  <div class="tags input" :class="{ invalid }" @click="($el as HTMLElement).querySelector('input')?.focus()">
    <span v-for="(t, i) in modelValue" :key="t + i" class="tag">
      {{ t }}
      <button type="button" :aria-label="`Remover ${t}`" @click.stop="remove(i)"><AppIcon name="x" :size="12" :stroke="2.4" /></button>
    </span>
    <input :id="id" v-model="text" :placeholder="modelValue.length ? '' : placeholder" @keydown="onKey" @blur="add(text)"
      @paste.prevent="add(($event.clipboardData?.getData('text') ?? ''))">
  </div>
</template>

<style scoped>
.tags { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; cursor: text; height: auto; min-height: 44px; padding: .35rem .5rem; }
.tags.invalid { border-color: var(--danger); }
.tag { display: inline-flex; align-items: center; gap: .3rem; padding: .2rem .35rem .2rem .6rem; background: var(--blue-100); color: var(--navy); border-radius: 6px; font-size: .85rem; font-weight: 500; }
.tag button { display: grid; place-items: center; width: 18px; height: 18px; border: 0; border-radius: 4px; background: transparent; color: var(--blue); cursor: pointer; }
.tag button:hover { background: rgba(20,38,138,.12); }
.tags input { flex: 1; min-width: 140px; border: 0; outline: none; font: inherit; padding: .25rem; background: transparent; color: var(--ink); }
</style>
