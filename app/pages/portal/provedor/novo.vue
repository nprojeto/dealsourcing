<script setup lang="ts">
definePageMeta({ layout: 'portal', roles: ['isp_owner'] })
useHead({ title: 'Cadastrar provedor · DealSourcing' })

const api = useApi()
const toast = useToast()
const route = useRoute()
const { profile } = useAuth()

const storedRef = (() => { try { return localStorage.getItem('ds_ref') ?? '' } catch { return '' } })()
const form = reactive({
  legal_name: '', trade_name: '', cnpj: '', email: profile.value?.email ?? '', phone: maskPhone(profile.value?.phone ?? ''),
  responsible_name: profile.value?.full_name ?? '', cep: '', street: '', number: '', complement: '', district: '',
  city: '', state: '', referral_code: String(route.query.ref ?? storedRef ?? '').toUpperCase(),
})
const errors = reactive<Record<string, string>>({})
const loading = ref(false)
const serverError = ref('')
const required = ref(true)
const refStatus = ref<{ state: 'idle' | 'checking' | 'ok' | 'bad'; owner?: string | null }>({ state: 'idle' })
for (const k of Object.keys(form) as (keyof typeof form)[]) watch(() => form[k], () => { delete errors[k] })

onMounted(async () => {
  try { required.value = (await api.get<{ referral_required: boolean }>('/isp/form-config')).referral_required } catch { /* usa padrão */ }
  if (form.referral_code) checkRef()
})

async function checkRef() {
  const code = form.referral_code.trim().toUpperCase()
  form.referral_code = code
  if (!code) { refStatus.value = { state: 'idle' }; return }
  refStatus.value = { state: 'checking' }
  try {
    const r = await api.get<{ valid: boolean; owner_first_name?: string | null }>('/referral/check', { code })
    refStatus.value = r.valid ? { state: 'ok', owner: r.owner_first_name } : { state: 'bad' }
  } catch { refStatus.value = { state: 'idle' } }
}

const cepLoading = ref(false)
async function lookupCep() {
  const cep = onlyDigits(form.cep)
  if (cep.length !== 8) return
  cepLoading.value = true
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    const d = await res.json()
    if (d.erro) { errors.cep = 'CEP não encontrado.'; return }
    form.street = form.street || d.logradouro || ''
    form.district = form.district || d.bairro || ''
    form.city = d.localidade || form.city
    form.state = d.uf || form.state
  } catch { /* preenchimento manual */ } finally { cepLoading.value = false }
}

function validate() {
  for (const k of Object.keys(errors)) delete errors[k]
  if (form.legal_name.trim().length < 2) errors.legal_name = 'Informe o nome empresarial.'
  if (form.trade_name.trim().length < 2) errors.trade_name = 'Informe o nome fantasia.'
  if (!isCNPJ(form.cnpj)) errors.cnpj = 'CNPJ inválido.'
  if (!isEmail(form.email)) errors.email = 'E-mail inválido.'
  if (!isPhone(form.phone)) errors.phone = 'Telefone com DDD inválido.'
  if (!isFullName(form.responsible_name)) errors.responsible_name = 'Informe nome e sobrenome.'
  if (form.cep && onlyDigits(form.cep).length !== 8) errors.cep = 'CEP inválido.'
  if (!form.street.trim()) errors.street = 'Informe o logradouro.'
  if (!form.number.trim()) errors.number = 'Informe o número (ou S/N).'
  if (!form.district.trim()) errors.district = 'Informe o bairro.'
  if (!form.city.trim()) errors.city = 'Informe a cidade.'
  if (!form.state) errors.state = 'Selecione o estado.'
  if (required.value && !form.referral_code.trim()) errors.referral_code = 'Informe o código de indicação.'
  if (refStatus.value.state === 'bad') errors.referral_code = 'Código de indicação não encontrado.'
  return !Object.keys(errors).length
}

async function submit() {
  serverError.value = ''
  if (!validate()) { toast.warning('Revise os campos destacados.'); return }
  loading.value = true
  try {
    const r = await api.post<{ isp: { id: string } }>('/isp/companies', {
      ...form, cnpj: onlyDigits(form.cnpj), phone: onlyDigits(form.phone), cep: onlyDigits(form.cep),
    })
    try { localStorage.removeItem('ds_ref') } catch { /* ignora */ }
    toast.success('Provedor cadastrado. Agora você já pode simular.')
    await navigateTo(`/portal/provedor/${r.isp.id}/simular`)
  } catch (e) {
    if (e instanceof ApiError && e.data.errors) Object.assign(errors, e.data.errors as Record<string, string>)
    serverError.value = errorMessage(e)
  } finally { loading.value = false }
}
</script>

<template>
  <div class="narrow">
    <NuxtLink to="/portal" class="back"><AppIcon name="arrow-left" :size="16" /> Voltar</NuxtLink>
    <div class="page-head">
      <div><div class="eyebrow">Cadastro do provedor</div><h1>Dados do seu provedor</h1>
        <p>Essas informações identificam a empresa. O CNPJ e o código de indicação não poderão ser alterados depois.</p></div>
    </div>

    <form class="stack" novalidate @submit.prevent="submit">
      <article class="card">
        <div class="card-head"><h2>Empresa</h2></div>
        <div class="card-body form-grid">
          <div class="field full"><label for="legal">Nome empresarial (razão social)<span class="req">*</span></label>
            <input id="legal" v-model="form.legal_name" class="input" autocomplete="organization" :aria-invalid="!!errors.legal_name">
            <span v-if="errors.legal_name" class="error">{{ errors.legal_name }}</span></div>
          <div class="field"><label for="trade">Nome fantasia<span class="req">*</span></label>
            <input id="trade" v-model="form.trade_name" class="input" :aria-invalid="!!errors.trade_name">
            <span v-if="errors.trade_name" class="error">{{ errors.trade_name }}</span></div>
          <div class="field"><label for="cnpj">CNPJ<span class="req">*</span></label>
            <input maxlength="18" id="cnpj" class="input" inputmode="numeric" :value="form.cnpj" placeholder="00.000.000/0000-00" :aria-invalid="!!errors.cnpj"
              @input="form.cnpj = masked($event, maskDocument)">
            <span v-if="errors.cnpj" class="error">{{ errors.cnpj }}</span></div>
        </div>
      </article>

      <article class="card">
        <div class="card-head"><h2>Responsável e contato</h2></div>
        <div class="card-body form-grid">
          <div class="field full"><label for="resp">Nome completo do responsável<span class="req">*</span></label>
            <input id="resp" v-model="form.responsible_name" class="input" :aria-invalid="!!errors.responsible_name">
            <span v-if="errors.responsible_name" class="error">{{ errors.responsible_name }}</span></div>
          <div class="field"><label for="em">E-mail do provedor<span class="req">*</span></label>
            <input id="em" v-model="form.email" class="input" type="email" :aria-invalid="!!errors.email">
            <span v-if="errors.email" class="error">{{ errors.email }}</span></div>
          <div class="field"><label for="ph">Telefone / WhatsApp<span class="req">*</span></label>
            <input maxlength="15" id="ph" class="input" inputmode="tel" :value="form.phone" :aria-invalid="!!errors.phone"
              @input="form.phone = masked($event, maskPhone)">
            <span v-if="errors.phone" class="error">{{ errors.phone }}</span></div>
        </div>
      </article>

      <article class="card">
        <div class="card-head"><h2>Endereço</h2></div>
        <div class="card-body form-grid addr">
          <div class="field"><label for="cep">CEP</label>
            <div class="cep"><input maxlength="9" id="cep" class="input" inputmode="numeric" :value="form.cep" placeholder="00000-000" :aria-invalid="!!errors.cep"
              @input="form.cep = masked($event, maskCep)" @blur="lookupCep">
              <span v-if="cepLoading" class="spinner" /></div>
            <span v-if="errors.cep" class="error">{{ errors.cep }}</span><span v-else class="hint">Preenche o endereço automaticamente.</span></div>
          <div class="field span2"><label for="street">Logradouro<span class="req">*</span></label>
            <input id="street" v-model="form.street" class="input" :aria-invalid="!!errors.street">
            <span v-if="errors.street" class="error">{{ errors.street }}</span></div>
          <div class="field"><label for="num">Número<span class="req">*</span></label>
            <input id="num" v-model="form.number" class="input" :aria-invalid="!!errors.number">
            <span v-if="errors.number" class="error">{{ errors.number }}</span></div>
          <div class="field"><label for="comp">Complemento</label><input id="comp" v-model="form.complement" class="input"></div>
          <div class="field"><label for="dist">Bairro<span class="req">*</span></label>
            <input id="dist" v-model="form.district" class="input" :aria-invalid="!!errors.district">
            <span v-if="errors.district" class="error">{{ errors.district }}</span></div>
          <div class="field span2"><label for="city">Cidade<span class="req">*</span></label>
            <input id="city" v-model="form.city" class="input" :aria-invalid="!!errors.city">
            <span v-if="errors.city" class="error">{{ errors.city }}</span></div>
          <div class="field"><label for="uf">Estado<span class="req">*</span></label>
            <select id="uf" v-model="form.state" class="select" :aria-invalid="!!errors.state">
              <option value="" disabled>UF</option><option v-for="u in UFS" :key="u" :value="u">{{ u }}</option>
            </select>
            <span v-if="errors.state" class="error">{{ errors.state }}</span></div>
        </div>
      </article>

      <article class="card">
        <div class="card-head"><h2>Código de indicação</h2></div>
        <div class="card-body">
          <div class="field ref-field">
            <label for="ref">Código de quem indicou a NOVALE para você<span v-if="required" class="req">*</span></label>
            <input id="ref" v-model="form.referral_code" class="input code-input" maxlength="20" placeholder="Ex.: DS7K3Q9P"
              :aria-invalid="!!errors.referral_code" @blur="checkRef">
            <span v-if="errors.referral_code" class="error">{{ errors.referral_code }}</span>
            <span v-else-if="refStatus.state === 'checking'" class="hint">Verificando…</span>
            <span v-else-if="refStatus.state === 'ok'" class="ok"><AppIcon name="check" :size="14" :stroke="2.4" /> Código válido{{ refStatus.owner ? ` · indicação de ${refStatus.owner}` : '' }}</span>
            <span v-else-if="refStatus.state === 'bad'" class="error">Código não encontrado ou inativo.</span>
            <span v-else class="hint">Peça o código ao consultor ou parceiro que apresentou a NOVALE.</span>
          </div>
        </div>
      </article>

      <div v-if="serverError" class="alert danger"><AppIcon name="alert" :size="18" /> {{ serverError }}</div>
      <div class="row end">
        <NuxtLink to="/portal" class="btn btn-ghost">Cancelar</NuxtLink>
        <button class="btn btn-lg" :disabled="loading"><span v-if="loading" class="spinner" /> Cadastrar e ir para o simulador</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.narrow { max-width: 860px; margin: 0 auto; }
.back { display: inline-flex; align-items: center; gap: .35rem; font-size: .88rem; margin-bottom: .75rem; }
.addr { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.addr .span2 { grid-column: span 2; }
.cep { position: relative; }
.cep .spinner { position: absolute; right: 10px; top: 11px; }
.ref-field { max-width: 380px; }
.code-input { font: 700 1.1rem var(--font-head); letter-spacing: .1em; text-transform: uppercase; }
.ok { font-size: .8rem; color: var(--success); font-weight: 600; display: inline-flex; align-items: center; gap: .3rem; }
@media (max-width: 700px) { .addr { grid-template-columns: 1fr 1fr; } .addr .span2 { grid-column: 1 / -1; } }
</style>
