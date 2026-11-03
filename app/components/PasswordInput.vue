<script setup lang="ts">
defineProps<{ modelValue: string; id?: string; autocomplete?: string; invalid?: boolean; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
const show = ref(false)
</script>

<template>
  <div class="pw">
    <input :id="id" class="input" :type="show ? 'text' : 'password'" :value="modelValue"
      :autocomplete="autocomplete ?? 'current-password'" :aria-invalid="invalid ? 'true' : undefined" :placeholder="placeholder"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)">
    <button type="button" class="toggle" :aria-label="show ? 'Ocultar senha' : 'Mostrar senha'" @click="show = !show">
      <AppIcon :name="show ? 'eye-off' : 'eye'" :size="18" />
    </button>
  </div>
</template>

<style scoped>
.pw { position: relative; }
.pw .input { padding-right: 2.8rem; }
.toggle { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border: 0; background: none; color: var(--muted); cursor: pointer; display: grid; place-items: center; border-radius: 6px; }
.toggle:hover { color: var(--navy); background: var(--tint); }
</style>
