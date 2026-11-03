<script setup lang="ts">
definePageMeta({ access: 'public', layout: 'auth' })
useHead({ title: 'Conta indisponível · DealSourcing' })
const auth = useAuth()
const pc = usePublicConfig()
onMounted(() => { auth.init(); pc.load() })
const p = computed(() => auth.profile.value)
const contact = computed(() => String(pc.setting('contact_email', '')))
</script>

<template>
  <div class="card card-body auth-card">
    <div class="ico"><AppIcon name="ban" :size="26" /></div>
    <div class="eyebrow">Acesso indisponível</div>
    <h1>{{ p?.status === 'rejected' ? 'Cadastro não aprovado' : p?.status === 'blocked' ? 'Conta bloqueada' : 'Conta desativada' }}</h1>
    <p class="muted">No momento sua conta não pode acessar a plataforma.</p>
    <div v-if="p?.status_reason" class="alert warning"><AppIcon name="info" :size="18" /> {{ p.status_reason }}</div>
    <p v-if="contact" class="small">Dúvidas? Fale com <a :href="`mailto:${contact}`">{{ contact }}</a>.</p>
    <button class="btn btn-outline" @click="auth.signOut()">Sair</button>
  </div>
</template>

<style scoped>
.auth-card { padding: 2rem; border-top: 4px solid var(--navy); }
.auth-card .alert { margin-bottom: 1rem; }
.ico { width: 56px; height: 56px; border-radius: 14px; display: grid; place-items: center; background: var(--danger-bg); color: var(--danger); margin-bottom: 1rem; }
</style>
