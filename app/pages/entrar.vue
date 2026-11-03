<script setup lang="ts">
definePageMeta({ access: 'guest', layout: 'auth' })
useHead({ title: 'Entrar · DealSourcing' })

const auth = useAuth()
const route = useRoute()
const email = ref(String(route.query.email ?? ''))
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  if (!isEmail(email.value)) { error.value = 'Informe um e-mail válido.'; return }
  if (!password.value) { error.value = 'Informe sua senha.'; return }
  loading.value = true
  try {
    const p = await auth.signIn(email.value, password.value)
    if (!p) { error.value = 'Não foi possível carregar seu cadastro. Contate o administrador.'; return }
    const redirect = String(route.query.r ?? '')
    const next = auth.nextRoute(p)
    const okRedirect = redirect.startsWith('/') && !redirect.startsWith('//') && p.status === 'active'
    await navigateTo(okRedirect ? redirect : next)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card card-body auth-card">
    <div class="eyebrow">Acesso à plataforma</div>
    <h1>Entrar</h1>
    <p class="muted">Use o e-mail e a senha cadastrados.</p>

    <form class="stack" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="email">E-mail</label>
        <input id="email" v-model="email" class="input" type="email" autocomplete="email" placeholder="voce@empresa.com.br">
      </div>
      <div class="field">
        <div class="row between"><label for="pw">Senha</label>
          <NuxtLink :to="{ path: '/recuperar-senha', query: email ? { email } : {} }" class="small">Esqueci minha senha</NuxtLink></div>
        <PasswordInput id="pw" v-model="password" />
      </div>
      <div v-if="error" class="alert danger" role="alert"><AppIcon name="alert" :size="18" /> {{ error }}</div>
      <button class="btn btn-block btn-lg" type="submit" :disabled="loading">
        <span v-if="loading" class="spinner" /> Entrar
      </button>
    </form>
    <hr class="divider">
    <p class="small muted center">Ainda não tem cadastro?
      <NuxtLink to="/cadastro?perfil=isp_owner">Cadastre seu provedor</NuxtLink> ·
      <NuxtLink to="/cadastro?perfil=parceiro">Seja parceiro</NuxtLink>
    </p>
  </div>
</template>

<style scoped>
.auth-card { padding: 2rem; border-top: 4px solid var(--navy); }
.center { text-align: center; margin: 0; }
</style>
