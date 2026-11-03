<script setup lang="ts">
definePageMeta({ access: 'public', layout: 'auth' })
useHead({ title: 'Confirmar e-mail · DealSourcing' })

const route = useRoute()
const api = useApi()
const auth = useAuth()
const toast = useToast()
const email = ref(String(route.query.email ?? auth.profile.value?.email ?? ''))
const code = ref('')
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const done = ref<'' | 'active' | 'pending_approval'>('')
const cooldown = ref(Number(route.query.reenviar ? 0 : 60))
let timer: ReturnType<typeof setInterval> | undefined

function startCooldown(s: number) {
  cooldown.value = s
  clearInterval(timer)
  timer = setInterval(() => { if (cooldown.value > 0) cooldown.value--; else clearInterval(timer) }, 1000)
}
onMounted(() => { if (cooldown.value) startCooldown(cooldown.value) })
onBeforeUnmount(() => clearInterval(timer))

async function verify() {
  error.value = ''
  if (!isEmail(email.value)) { error.value = 'Informe o e-mail cadastrado.'; return }
  if (code.value.length !== 6) { error.value = 'Digite os 6 dígitos do código.'; return }
  loading.value = true
  try {
    const r = await api.post<{ status: 'active' | 'pending_approval' }>('/auth/verify-email', { email: email.value, code: code.value })
    done.value = r.status === 'pending_approval' ? 'pending_approval' : 'active'
    if (auth.profile.value) await auth.refresh()
  } catch (e) {
    error.value = errorMessage(e)
    code.value = ''
  } finally {
    loading.value = false
  }
}

async function resend() {
  error.value = ''
  if (!isEmail(email.value)) { error.value = 'Informe o e-mail cadastrado.'; return }
  sending.value = true
  try {
    const r = await api.post<{ resend_interval?: number; already_verified?: boolean }>('/auth/resend-code', { email: email.value, purpose: 'signup' })
    if (r.already_verified) { toast.info('Este e-mail já foi confirmado. Faça login.'); await navigateTo({ path: '/entrar', query: { email: email.value } }); return }
    toast.success('Enviamos um novo código. O código anterior deixou de valer.')
    startCooldown(r.resend_interval ?? 60)
    code.value = ''
  } catch (e) {
    if (e instanceof ApiError && typeof e.data.retry_after === 'number') startCooldown(e.data.retry_after)
    error.value = errorMessage(e)
  } finally {
    sending.value = false
  }
}

async function goOn() {
  if (auth.profile.value) { await auth.refresh(); await navigateTo(auth.nextRoute()) }
  else await navigateTo({ path: '/entrar', query: { email: email.value } })
}
</script>

<template>
  <div class="card card-body auth-card">
    <template v-if="!done">
      <div class="ico"><AppIcon name="mail" :size="26" /></div>
      <div class="eyebrow">Confirmação de e-mail</div>
      <h1>Digite o código</h1>
      <p class="muted">Enviamos um código de 6 dígitos para <strong class="em">{{ email || 'seu e-mail' }}</strong>. Verifique também a caixa de spam.</p>
      <div v-if="!route.query.email && !auth.profile.value" class="field" style="margin-bottom:1rem">
        <label for="em">E-mail cadastrado</label>
        <input id="em" v-model="email" class="input" type="email" autocomplete="email">
      </div>
      <form class="stack" @submit.prevent="verify">
        <CodeInput v-model="code" :invalid="!!error" :disabled="loading" @complete="verify" />
        <div v-if="error" class="alert danger" role="alert"><AppIcon name="alert" :size="18" /> {{ error }}</div>
        <button class="btn btn-block btn-lg" type="submit" :disabled="loading || code.length !== 6">
          <span v-if="loading" class="spinner" /> Confirmar e-mail
        </button>
      </form>
      <div class="resend">
        <span class="muted small">Não recebeu?</span>
        <button class="btn btn-ghost btn-sm" :disabled="cooldown > 0 || sending" @click="resend">
          <span v-if="sending" class="spinner" />
          <AppIcon v-else name="refresh" :size="16" />
          {{ cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código' }}
        </button>
      </div>
    </template>

    <template v-else>
      <div class="ico ok"><AppIcon name="check" :size="28" :stroke="2.4" /></div>
      <h1>E-mail confirmado</h1>
      <p v-if="done === 'active'" class="muted">Sua conta está ativa. Você já pode acessar a plataforma.</p>
      <p v-else class="muted">Seu cadastro foi enviado para aprovação. Avisaremos por e-mail assim que o acesso for liberado.</p>
      <button class="btn btn-block btn-lg" @click="goOn">{{ done === 'active' ? 'Acessar a plataforma' : 'Ir para o login' }}</button>
    </template>
  </div>
</template>

<style scoped>
.auth-card { padding: 2rem; border-top: 4px solid var(--navy); }
.ico { width: 56px; height: 56px; border-radius: 14px; display: grid; place-items: center; background: var(--blue-100); color: var(--blue); margin-bottom: 1rem; }
.ico.ok { background: var(--success-bg); color: var(--success); }
.em { color: var(--navy); word-break: break-all; }
.resend { display: flex; justify-content: center; align-items: center; gap: .5rem; margin-top: 1rem; }
</style>
