<script setup lang="ts">
import type { NuxtError } from '#app'
const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error?.statusCode === 404)
const auth = useAuth()
function back() { clearError({ redirect: auth.profile.value ? auth.nextRoute() : '/' }) }
</script>

<template>
  <div class="err">
    <div class="row"><BrandLogo variant="azul" :height="30" /><ProductName :size="19" /></div>
    <div class="card card-body box">
      <div class="code">{{ error?.statusCode ?? 500 }}</div>
      <h1>{{ notFound ? 'Página não encontrada' : 'Algo deu errado' }}</h1>
      <p class="muted">{{ notFound ? 'O endereço acessado não existe ou foi alterado.' : 'Ocorreu um erro inesperado. Tente novamente em instantes.' }}</p>
      <button class="btn" @click="back">Voltar ao início</button>
    </div>
    <BrandLogo class="sph" symbol :height="520" />
  </div>
</template>

<style scoped>
.err { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; padding: 1.5rem; background: var(--bg); position: relative; overflow: hidden; }
.box { max-width: 440px; width: 100%; text-align: center; border-top: 4px solid var(--navy); position: relative; z-index: 1; }
.code { font: 800 3.2rem var(--font-head); color: var(--blue); line-height: 1; margin-bottom: .5rem; }
.sph { position: absolute; right: -140px; bottom: -140px; opacity: .06; pointer-events: none; }
</style>
