<script setup lang="ts">
definePageMeta({ access: 'public', layout: 'auth' })
useHead({ title: 'Aguardando aprovação · DealSourcing' })
const auth = useAuth()
const checking = ref(false)
onMounted(() => auth.init())
async function check() {
  checking.value = true
  const p = await auth.refresh()
  checking.value = false
  if (p && p.status !== 'pending_approval') await navigateTo(auth.nextRoute(p))
}
</script>

<template>
  <div class="card card-body auth-card">
    <div class="ico"><AppIcon name="clock" :size="26" /></div>
    <div class="eyebrow">Cadastro em análise</div>
    <h1>Aguardando aprovação</h1>
    <p class="muted">Seu e-mail foi confirmado e o cadastro está com o administrador para análise.
      Você receberá um e-mail assim que o acesso for liberado.</p>
    <dl v-if="auth.profile.value" class="dl">
      <dt>Nome</dt><dd>{{ auth.profile.value.full_name }}</dd>
      <dt>E-mail</dt><dd>{{ auth.profile.value.email }}</dd>
      <dt>Perfil solicitado</dt><dd>{{ auth.profile.value.role ? ROLE_LABEL[auth.profile.value.role] : '—' }}</dd>
    </dl>
    <hr class="divider">
    <div class="row">
      <button v-if="auth.profile.value" class="btn btn-outline" :disabled="checking" @click="check">
        <span v-if="checking" class="spinner" /><AppIcon v-else name="refresh" :size="16" /> Verificar novamente
      </button>
      <button v-if="auth.profile.value" class="btn btn-ghost" @click="auth.signOut()">Sair</button>
      <NuxtLink v-else to="/entrar" class="btn">Ir para o login</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.auth-card { padding: 2rem; border-top: 4px solid var(--navy); }
.ico { width: 56px; height: 56px; border-radius: 14px; display: grid; place-items: center; background: var(--warning-bg); color: var(--warning); margin-bottom: 1rem; }
</style>
