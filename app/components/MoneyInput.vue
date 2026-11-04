<script setup lang="ts">
/** Campo de valor em reais: digita só números, exibe "R$ 1.234,56". */
const model = defineModel<number | null>({ default: null })
defineProps<{ id?: string; disabled?: boolean; placeholder?: string }>()
const text = ref('')
function show(v: number | null) { return v === null || v === undefined ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
watch(model, (v) => { if (parse(text.value) !== v) text.value = show(v) }, { immediate: true })
function parse(t: string): number | null { const d = t.replace(/\D+/g, ''); return d ? Number(d) / 100 : null }
function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const v = parse(el.value)
  text.value = show(v); el.value = text.value
  model.value = v
}
</script>

<template>
  <input :id="id" class="input" inputmode="numeric" :value="text" :disabled="disabled" :placeholder="placeholder ?? 'R$ 0,00'" @input="onInput">
</template>
