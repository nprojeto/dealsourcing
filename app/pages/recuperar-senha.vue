<script setup lang="ts">
definePageMeta({ access: 'public', layout: 'auth' })
useHead({ title: 'Recuperar senha · DealSourcing' })

const route = useRoute()
const api = useApi()
const pc = usePublicConfig()
const toast = useToast()
onMounted(() => pc.load())

const invite = computed(() => route.query.convite === '1')
// Vai direto para o código só quando vem do link do e-mail (etapa=codigo ou convite).
// Pela tela de login, o e-mail apenas é preenchido e o código ainda precisa ser solicitado.
const fromEmailLink = !!route.query.email && (route.query.etapa === 'codigo' || route.query.convite === '1')
const step = ref<'request' | 'reset' | 'done'>(fromEmailLink ? 'reset' : 'request')
const email = ref(String(route.query.email ?? ''))
const code = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const minPw = computed(() => Number(pc.setting('security_password_min_length', 8)))

async function requestCode() {
  error.value = ''
  if (!isEmail(email.value)) { error.value = 'Informe um e-mail válido.'; return }
  loading.value = true
  try {
    await api.post('/auth/forgot-password', { email: email.value })
    step.value = 'reset'
    toast.info('Se o e-mail estiver cadastrado, você receberá um código em instantes.')
  } catch (e) { error.value = errorMessage(e) } finally { loading.value = false }
}

async function reset() {
  error.value = ''
  if (code.value.length !== 6) { error.value = 'Digite os 6 dígitos do código.'; return }
  const issues = passwordIssues(password.value, minPw.value)
  if (issues.length) { error.value = `A senha precisa de: ${issues.join(', ')}.`; return }
  if (password.value !== confirm.value) { error.value = 'As senhas não coincidem.'; return }
  loading.value = true
  try {
    await api.post('/auth/reset-password', { email: email.value, code: code.value, new_password: password.value })
    step.value = 'done'
  } catch (e) { error.value = errorMessage(e); code.value = '' } finally { loading.value = false }
}
</script>

<template>
  <div class="card card-body auth-card">
    <template v-if="step === 'request'">
      <div class="eyebrow">Recuperação de acesso</div>
      <h1>Esqueceu a senha?</h1>
      <p class="muted">Informe seu e-mail. Enviaremos um código para você criar uma nova senha.</p>
      <form class="stack" novalidate @submit.prevent="requestCode">
        <div class="field">
          <label for="em">E-mail</label>
          <input id="em" v-model="email" class="input" type="email" autocomplete="email">
        </div>
        <div v-if="error" class="alert danger"><AppIcon name="alert" :size="18" /> {{ error }}</div>
        <button class="btn btn-block btn-lg" :disabled="loading"><span v-if="loading" class="spinner" /> Enviar código</button>
      </form>
    </template>

    <template v-else-if="step === 'reset'">
      <div class="eyebrow">{{ invite ? 'Primeiro acesso' : 'Recuperação de acesso' }}</div>
      <h1>{{ invite ? 'Defina sua senha' : 'Crie uma nova senha' }}</h1>
      <p class="muted">Digite o código enviado para <strong class="em">{{ email }}</strong>.
        <button class="link-btn" @click="step = 'request'; code = ''">Alterar e-mail ou reenviar</button></p>
      <form class="stack" novalidate @submit.prevent="reset">
        <CodeInput v-model="code" :invalid="!!error && code.length === 0" />
        <div class="field">
          <label for="pw">Nova senha</label>
          <PasswordInput id="pw" v-model="password" autocomplete="new-password" />
          <span class="hint">Mínimo de {{ minPw }} caracteres, com letras e números.</span>
        </div>
        <div class="field">
          <label for="pw2">Confirmar nova senha</label>
          <PasswordInput id="pw2" v-model="confirm" autocomplete="new-password" />
        </div>
        <div v-if="error" class="alert danger"><AppIcon name="alert" :size="18" /> {{ error }}</div>
        <button class="btn btn-block btn-lg" :disabled="loading"><span v-if="loading" class="spinner" /> Salvar senha</button>
      </form>
    </template>

    <template v-else>
      <div class="ico ok"><AppIcon name="check" :size="28" :stroke="2.4" /></div>
      <h1>Senha definida</h1>
      <p class="muted">Agora é só entrar com o seu e-mail e a nova senha.</p>
      <NuxtLink class="btn btn-block btn-lg" :to="{ path: '/entrar', query: { email } }">Ir para o login</NuxtLink>
    </template>
    <hr class="divider">
    <p class="small muted center"><NuxtLink to="/entrar">Voltar para o login</NuxtLink></p>
  </div>
</template>

<style scoped>
.auth-card { padding: 2rem; border-top: 4px solid var(--navy); }
.em { color: var(--navy); word-break: break-all; }
.link-btn { background: none; border: 0; padding: 0; color: var(--blue); font: 500 inherit; cursor: pointer; text-decoration: underline; }
.ico { width: 56px; height: 56px; border-radius: 14px; display: grid; place-items: center; margin-bottom: 1rem; }
.ico.ok { background: var(--success-bg); color: var(--success); }
.center { text-align: center; margin: 0; }
</style>
