<script setup lang="ts">
defineProps<{ modelValue: string; options: { value: string; label: string }[]; name: string; invalid?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <div class="seg" :class="{ invalid }" role="radiogroup">
    <label v-for="o in options" :key="o.value" class="opt" :class="{ on: modelValue === o.value }">
      <input type="radio" :name="name" :value="o.value" :checked="modelValue === o.value" @change="emit('update:modelValue', o.value)">
      {{ o.label }}
    </label>
  </div>
</template>

<style scoped>
.seg { display: inline-flex; border: 1px solid var(--line-strong); border-radius: var(--radius); overflow: hidden; background: #fff; width: 100%; }
.seg.invalid { border-color: var(--danger); }
.opt { flex: 1; position: relative; display: grid; place-items: center; min-height: 44px; padding: 0 1rem; font-weight: 600; font-size: .92rem; color: var(--ink-2); cursor: pointer; border-left: 1px solid var(--line-strong); transition: background .15s, color .15s; }
.opt:first-child { border-left: 0; }
.opt input { position: absolute; opacity: 0; pointer-events: none; }
.opt:hover { background: var(--tint); }
.opt.on { background: var(--blue); color: #fff; }
.opt:has(input:focus-visible) { outline: 3px solid rgba(20,38,138,.35); outline-offset: -3px; }
</style>
