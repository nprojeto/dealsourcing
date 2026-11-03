<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue: string; length?: number; disabled?: boolean; invalid?: boolean }>(), { length: 6 })
const emit = defineEmits<{ 'update:modelValue': [string]; complete: [string] }>()
const inputs = ref<HTMLInputElement[]>([])
const digitsArr = computed(() => Array.from({ length: props.length }, (_, i) => props.modelValue[i] ?? ''))

function set(value: string) {
  const v = value.replace(/\D/g, '').slice(0, props.length)
  emit('update:modelValue', v)
  if (v.length === props.length) emit('complete', v)
  return v
}
function onInput(i: number, e: Event) {
  const el = e.target as HTMLInputElement
  const typed = el.value.replace(/\D/g, '')
  if (!typed) { el.value = ''; return }
  if (typed.length > 1) { // colagem ou preenchimento automático
    const v = set(typed)
    inputs.value[Math.min(v.length, props.length - 1)]?.focus()
    return
  }
  const arr = digitsArr.value.slice(); arr[i] = typed
  set(arr.join(''))
  inputs.value[i + 1]?.focus()
}
function onKey(i: number, e: KeyboardEvent) {
  if (e.key === 'Backspace') {
    e.preventDefault()
    const arr = digitsArr.value.slice()
    if (arr[i]) { arr[i] = ''; set(arr.join('')) }
    else if (i > 0) { arr[i - 1] = ''; set(arr.join('')); inputs.value[i - 1]?.focus() }
  } else if (e.key === 'ArrowLeft' && i > 0) inputs.value[i - 1]?.focus()
  else if (e.key === 'ArrowRight' && i < props.length - 1) inputs.value[i + 1]?.focus()
}
function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const v = set(e.clipboardData?.getData('text') ?? '')
  inputs.value[Math.min(v.length, props.length - 1)]?.focus()
}
onMounted(() => inputs.value[0]?.focus())
defineExpose({ focus: () => inputs.value[0]?.focus() })
</script>

<template>
  <div class="code" :class="{ invalid }" @paste="onPaste">
    <input v-for="(d, i) in digitsArr" :key="i" :ref="(el) => { if (el) inputs[i] = el as HTMLInputElement }"
      :value="d" inputmode="numeric" :autocomplete="i === 0 ? 'one-time-code' : 'off'" maxlength="6"
      :aria-label="`Dígito ${i + 1}`" :disabled="disabled"
      @input="onInput(i, $event)" @keydown="onKey(i, $event)" @focus="($event.target as HTMLInputElement).select()">
  </div>
</template>

<style scoped>
.code { display: flex; gap: .5rem; justify-content: center; }
.code input {
  width: 48px; height: 58px; text-align: center; font: 700 1.6rem var(--font-head); color: var(--navy);
  border: 1px solid var(--line-strong); border-radius: var(--radius); background: #fff; transition: border-color .15s, box-shadow .15s;
}
.code input:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px rgba(20,38,138,.15); }
.code.invalid input { border-color: var(--danger); }
@media (max-width: 380px) { .code { gap: .35rem; } .code input { width: 42px; height: 52px; font-size: 1.35rem; } }
</style>
