<script setup lang="ts">
const configured = useSupabaseConfigured()
</script>

<template>
  <div>
    <div v-if="!configured" class="config-warn" role="alert">
      <AppIcon name="alert" :size="18" />
      Sistema ainda não conectado ao Supabase: falta a chave pública (anon key) no arquivo <b>nuxt.config.ts</b>.
    </div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ToastHost />
  </div>
</template>

<style>
.config-warn { display: flex; gap: .6rem; align-items: center; justify-content: center; flex-wrap: wrap; padding: .6rem 1rem; background: var(--warning-bg); color: #6E4500; font-size: .85rem; border-bottom: 1px solid #F1D49B; text-align: center; }
</style>
