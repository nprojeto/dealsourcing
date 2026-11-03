<script setup lang="ts">
import type { AccountStatus } from '~/utils/labels'
defineProps<{ status: AccountStatus }>()
</script>

<template>
  <span class="badge" :class="STATUS_TONE[status]">{{ STATUS_LABEL[status] ?? status }}</span>
</template>
