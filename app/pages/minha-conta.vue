<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Minha conta · DealSourcing' })

const auth = useAuth()
const api = useApi()
const toast = useToast()
const pc = usePublicConfig()
onMounted(() => pc.load())
const layout = computed(() => (auth.isInternal.value ? 'crm' : 'portal'))
const p = computed(() => auth.profile.value)

const form = reactive({ full_name: '', phone: '', company_name: '' })
watch(p, (v) => { if (v) Object.assign(form, { full_name: v.full_name, phone: maskPhone(v.phone ?? ''), company_name: v.company_name ?? '' }) }, { immediate: true })
const saving = ref(false)
const err = ref('')
async function save() {
  err.value = ''
  if (!isFullName(form.full_name)) { err.value = 'Informe nome e sobrenome.'; return }
  if (!isPhone(form.phone)) { err.value = 'Telefone com DDD inválido.'; return }
  saving.value = true
  try {
    await api.patch('/me', { full_name: form.full_name, phone: onlyDigits(form.phone), company_name: form.company_name })
    await auth.refresh()
    toast.success('Dados atualizados.')
  } catch (e) { err.value = errorMessage(e) } finally { saving.value = false }
}

const pw = reactive({ next: '', confirm: '' })
const pwErr = ref('')
const pwSaving = ref(false)
const minPw = computed(() => Number(pc.setting('security_password_min_length', 8)))
async function changePassword() {
  pwErr.value = ''
  const issues = passwordIssues(pw.next, minPw.value)
  if (issues.length) { pwErr.value = `A senha precisa de: ${issues.join(', ')}.`; return }
  if (pw.next !== pw.confirm) { pwErr.value = 'As senhas não coincidem.'; return }
  pwSaving.value = true
  try {
    const { error } = await useSupabase().auth.updateUser({ password: pw.next })
    if (error) throw new Error(error.message.includes('different') ? 'A nova senha deve ser diferente da atual.' : 'Não foi possível alterar a senha. Entre novamente e tente outra vez.')
    pw.next = ''; pw.confirm = ''
    toast.success('Senha alterada com sucesso.')
  } catch (e) { pwErr.value = errorMessage(e) } finally { pwSaving.value = false }
}
</script>

<template>
  <NuxtLayout :name="layout">
    <div class="page-head">
      <div><div class="eyebrow">Conta</div><h1>Minha conta</h1><p>Seus dados cadastrais e segurança de acesso.</p></div>
    </div>
    <div v-if="p" class="grid-2 cols">
      <article class="card">
        <div class="card-head"><h2>Dados cadastrais</h2></div>
        <form class="card-body form-grid" novalidate @submit.prevent="save">
          <div class="field full"><label for="n">Nome completo</label><input id="n" v-model="form.full_name" class="input" autocomplete="name"></div>
          <div class="field"><label for="e">E-mail</label><input id="e" :value="p.email" class="input" disabled><span class="hint">Para alterar o e-mail, contate o administrador.</span></div>
          <div class="field"><label for="t">Telefone / WhatsApp</label>
            <input id="t" class="input" inputmode="tel" :value="form.phone" @input="form.phone = maskPhone(($event.target as HTMLInputElement).value)"></div>
          <div class="field full"><label for="c">{{ p.role === 'isp_owner' ? 'Nome do provedor' : 'Empresa / área' }}</label><input id="c" v-model="form.company_name" class="input"></div>
          <div v-if="err" class="alert danger full"><AppIcon name="alert" :size="18" /> {{ err }}</div>
          <div class="full row end"><button class="btn" :disabled="saving"><span v-if="saving" class="spinner" /> Salvar dados</button></div>
        </form>
      </article>

      <div class="stack">
        <article class="card">
          <div class="card-head"><h2>Alterar senha</h2></div>
          <form class="card-body stack" novalidate @submit.prevent="changePassword">
            <div class="field"><label for="p1">Nova senha</label><PasswordInput id="p1" v-model="pw.next" autocomplete="new-password" />
              <span class="hint">Mínimo de {{ minPw }} caracteres, com letras e números.</span></div>
            <div class="field"><label for="p2">Confirmar nova senha</label><PasswordInput id="p2" v-model="pw.confirm" autocomplete="new-password" /></div>
            <div v-if="pwErr" class="alert danger"><AppIcon name="alert" :size="18" /> {{ pwErr }}</div>
            <div class="row end"><button class="btn btn-navy" :disabled="pwSaving"><span v-if="pwSaving" class="spinner" /> Alterar senha</button></div>
          </form>
        </article>
        <article class="card card-body">
          <div class="eyebrow">Informações da conta</div>
          <dl class="dl">
            <dt>Perfil</dt><dd>{{ p.role ? ROLE_LABEL[p.role] : '—' }}</dd>
            <dt>Status</dt><dd><StatusBadge :status="p.status" /></dd>
            <dt>CPF/CNPJ</dt><dd>{{ fmtDocument(p.document) }}</dd>
            <dt>E-mail confirmado</dt><dd>{{ fmtDateTime(p.email_verified_at) }}</dd>
            <dt>Cadastro</dt><dd>{{ fmtDateTime(p.created_at) }}</dd>
            <dt>Último acesso</dt><dd>{{ fmtDateTime(p.last_login_at) }}</dd>
          </dl>
        </article>
      </div>
    </div>
  </NuxtLayout>
</template>

<style scoped>
.cols { gap: 1.25rem; align-items: start; }
</style>
