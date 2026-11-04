<script setup lang="ts">
import type { Role } from '~/utils/labels'
definePageMeta({ access: 'guest', layout: 'auth' })
useHead({ title: 'Cadastro · DealSourcing' })

const route = useRoute()
const api = useApi()
const pc = usePublicConfig()
onMounted(() => pc.load())

type SignupRole = Extract<Role, 'isp_owner' | 'parceiro' | 'colaborador'>
const OPTIONS: { value: SignupRole; label: string; desc: string; icon: string; setting: string }[] = [
  { value: 'isp_owner', label: 'Proprietário de ISP', desc: 'Sou dono ou responsável por um provedor', icon: 'building', setting: 'signup_isp_enabled' },
  { value: 'parceiro', label: 'Parceiro indicador', desc: 'Quero indicar provedores', icon: 'handshake', setting: 'signup_partner_enabled' },
  { value: 'colaborador', label: 'Equipe NOVALE', desc: 'Sou colaborador interno', icon: 'briefcase', setting: 'signup_employee_enabled' },
]
const options = computed(() => OPTIONS.filter((o) => pc.setting(o.setting, true)))
const initial = String(route.query.perfil ?? 'isp_owner') as SignupRole
const form = reactive({
  role: (OPTIONS.some((o) => o.value === initial) ? initial : 'isp_owner') as SignupRole,
  full_name: '', email: '', phone: '', document: '', company_name: '', additional_info: '',
  password: '', confirm: '', accept_terms: false, accept_privacy: false,
})
watch(options, (opts) => {
  if (opts.length && !opts.some((o) => o.value === form.role)) form.role = opts[0]!.value
})
const errors = reactive<Record<string, string>>({})
const loading = ref(false)
const serverError = ref('')
const legalOpen = ref<'terms' | 'privacy' | null>(null)
const minPw = computed(() => Number(pc.setting('security_password_min_length', 8)))
const docLabel = computed(() => (form.role === 'isp_owner' ? 'CPF do responsável' : 'CPF ou CNPJ'))
const companyLabel = computed(() => (form.role === 'isp_owner' ? 'Nome do provedor' : form.role === 'parceiro' ? 'Empresa (se houver)' : 'Área / departamento'))

// Remove o aviso do campo assim que o usuário o corrige
const FIELD_KEYS = ['full_name', 'email', 'phone', 'document', 'password', 'confirm'] as const
for (const k of FIELD_KEYS) watch(() => form[k], () => { delete errors[k] })
watch(() => [form.accept_terms, form.accept_privacy], () => { delete errors.consent })

function validate(): boolean {
  for (const k of Object.keys(errors)) delete errors[k]
  if (!isFullName(form.full_name)) errors.full_name = 'Informe nome e sobrenome.'
  if (!isEmail(form.email)) errors.email = 'E-mail inválido.'
  if (!isPhone(form.phone)) errors.phone = 'Telefone com DDD inválido.'
  if (form.document && !(isCPF(form.document) || isCNPJ(form.document))) errors.document = 'CPF ou CNPJ inválido.'
  const pw = passwordIssues(form.password, minPw.value)
  if (pw.length) errors.password = `A senha precisa de: ${pw.join(', ')}.`
  if (form.confirm !== form.password) errors.confirm = 'As senhas não coincidem.'
  if (!form.accept_terms || !form.accept_privacy) errors.consent = 'Aceite os Termos de Uso e o Aviso de Privacidade.'
  return !Object.keys(errors).length
}

async function submit() {
  serverError.value = ''
  if (!validate()) return
  if (!pc.config.value) await pc.load(true)
  loading.value = true
  try {
    const r = await api.post<{ email: string; email_failed?: boolean }>('/auth/register', {
      role: form.role, full_name: form.full_name, email: form.email, phone: onlyDigits(form.phone),
      document: onlyDigits(form.document) || undefined, company_name: form.company_name || undefined,
      additional_info: form.additional_info || undefined, password: form.password,
      accept_terms: form.accept_terms, accept_privacy: form.accept_privacy,
      terms_version: pc.legal('terms')?.version, privacy_version: pc.legal('privacy')?.version,
    })
    await navigateTo({ path: '/confirmar-email', query: { email: r.email, ...(r.email_failed ? { reenviar: '1' } : {}) } })
  } catch (e) {
    if (e instanceof ApiError && e.code === 'legal_outdated') await pc.load(true)
    serverError.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card card-body auth-card">
    <div class="eyebrow">Novo cadastro</div>
    <h1>Crie sua conta</h1>
    <p class="muted">Depois do cadastro, enviaremos um código para confirmar seu e-mail.</p>

    <div class="roles" role="radiogroup" aria-label="Tipo de cadastro">
      <button v-for="o in options" :key="o.value" type="button" role="radio" :aria-checked="form.role === o.value"
        class="role" :class="{ on: form.role === o.value }" @click="form.role = o.value">
        <AppIcon :name="o.icon" :size="20" />
        <span><strong>{{ o.label }}</strong><small>{{ o.desc }}</small></span>
      </button>
    </div>
    <div v-if="form.role !== 'isp_owner'" class="alert info small">
      <AppIcon name="info" :size="18" /> Este tipo de cadastro passa por aprovação do administrador após a confirmação do e-mail.
    </div>

    <form class="form-grid" novalidate @submit.prevent="submit">
      <div class="field full">
        <label for="name">Nome completo<span class="req">*</span></label>
        <input id="name" v-model="form.full_name" class="input" autocomplete="name" :aria-invalid="!!errors.full_name">
        <span v-if="errors.full_name" class="error">{{ errors.full_name }}</span>
      </div>
      <div class="field">
        <label for="email">E-mail<span class="req">*</span></label>
        <input id="email" v-model="form.email" class="input" type="email" autocomplete="email" :aria-invalid="!!errors.email">
        <span v-if="errors.email" class="error">{{ errors.email }}</span>
      </div>
      <div class="field">
        <label for="phone">Telefone / WhatsApp<span class="req">*</span></label>
        <input maxlength="15" id="phone" class="input" inputmode="tel" autocomplete="tel" :value="form.phone" :aria-invalid="!!errors.phone"
          placeholder="(12) 99999-9999" @input="form.phone = masked($event, maskPhone)">
        <span v-if="errors.phone" class="error">{{ errors.phone }}</span>
      </div>
      <div class="field">
        <label for="doc">{{ docLabel }}</label>
        <input maxlength="18" id="doc" class="input" inputmode="numeric" :value="form.document" :aria-invalid="!!errors.document"
          @input="form.document = masked($event, maskDocument)">
        <span v-if="errors.document" class="error">{{ errors.document }}</span>
      </div>
      <div class="field">
        <label for="company">{{ companyLabel }}</label>
        <input id="company" v-model="form.company_name" class="input" autocomplete="organization">
      </div>
      <div v-if="form.role !== 'isp_owner'" class="field full">
        <label for="info">Informações adicionais</label>
        <textarea id="info" v-model="form.additional_info" class="textarea" rows="3" maxlength="1000"
          :placeholder="form.role === 'parceiro' ? 'Conte como você atua no mercado de provedores' : 'Cargo, área e gestor responsável'" />
      </div>
      <div class="field">
        <label for="pw">Senha<span class="req">*</span></label>
        <PasswordInput id="pw" v-model="form.password" autocomplete="new-password" :invalid="!!errors.password" />
        <span v-if="errors.password" class="error">{{ errors.password }}</span>
        <span v-else class="hint">Mínimo de {{ minPw }} caracteres, com letras e números.</span>
      </div>
      <div class="field">
        <label for="pw2">Confirmar senha<span class="req">*</span></label>
        <PasswordInput id="pw2" v-model="form.confirm" autocomplete="new-password" :invalid="!!errors.confirm" />
        <span v-if="errors.confirm" class="error">{{ errors.confirm }}</span>
      </div>
      <div class="full stack consent">
        <label class="check"><input v-model="form.accept_terms" type="checkbox">
          <span>Li e aceito os <a href="#" @click.prevent="legalOpen = 'terms'">Termos de Uso</a><template v-if="pc.legal('terms')"> (versão {{ pc.legal('terms')?.version }})</template>.</span></label>
        <label class="check"><input v-model="form.accept_privacy" type="checkbox">
          <span>Li o <a href="#" @click.prevent="legalOpen = 'privacy'">Aviso de Privacidade</a> e concordo com o tratamento dos meus dados conforme a LGPD.</span></label>
        <span v-if="errors.consent" class="error">{{ errors.consent }}</span>
      </div>
      <div v-if="serverError" class="alert danger full" role="alert"><AppIcon name="alert" :size="18" /> {{ serverError }}</div>
      <div class="full">
        <button class="btn btn-block btn-lg" type="submit" :disabled="loading">
          <span v-if="loading" class="spinner" /> Cadastrar e receber código
        </button>
      </div>
    </form>
    <hr class="divider">
    <p class="small muted center">Já tem cadastro? <NuxtLink to="/entrar">Entrar</NuxtLink></p>
    <LegalModal :kind="legalOpen" @close="legalOpen = null" />
  </div>
</template>

<style scoped>
.auth-card { padding: 2rem; border-top: 4px solid var(--navy); }
.auth-card :deep(.form-grid) { margin-top: 1.25rem; }
.roles { display: grid; gap: .5rem; margin: 1.25rem 0 .75rem; }
.role { display: flex; gap: .8rem; align-items: center; text-align: left; padding: .75rem .9rem; border: 1px solid var(--line-strong); border-radius: var(--radius); background: #fff; cursor: pointer; color: var(--muted); transition: all .15s; }
.role strong { display: block; color: var(--navy); font-size: .92rem; }
.role small { font-size: .8rem; }
.role:hover { border-color: var(--blue); }
.role.on { border-color: var(--blue); background: var(--blue-100); color: var(--blue); box-shadow: inset 0 0 0 1px var(--blue); }
.consent { margin-top: .25rem; }
.center { text-align: center; margin: 0; }
</style>
