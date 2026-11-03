<script setup lang="ts">
const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ change: [number] }>()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const from = computed(() => (props.total ? (props.page - 1) * props.pageSize + 1 : 0))
const to = computed(() => Math.min(props.total, props.page * props.pageSize))
</script>

<template>
  <div class="pager">
    <span>{{ from }}–{{ to }} de {{ total }}</span>
    <div class="row">
      <button class="btn btn-outline btn-sm" :disabled="page <= 1" @click="emit('change', page - 1)">
        <AppIcon name="chevron-left" :size="16" /> Anterior
      </button>
      <span>Página {{ page }} de {{ pages }}</span>
      <button class="btn btn-outline btn-sm" :disabled="page >= pages" @click="emit('change', page + 1)">
        Próxima <AppIcon name="chevron-right" :size="16" />
      </button>
    </div>
  </div>
</template>
