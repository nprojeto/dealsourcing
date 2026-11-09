<script setup lang="ts">
import type { OwnerResultData } from '~/utils/simulator'
definePageMeta({ layout: 'portal', roles: ['isp_owner'] })
useHead({ title: 'Simulador · DealSourcing' })

interface Isp { id: string; trade_name: string; legal_name: string; cnpj: string; email: string; phone: string; responsible_name: string; cep: string | null; street: string; number: string; complement: string | null; district: string; city: string; state: string; region: string }
interface FormCfg { regions: { code: string; name: string; states: string[] }[]; regularized_options: { value: string; label: string }[]; pj_shift_options: { value: string; label: string }[]; pj_invoice_options: { value: string; label: string }[] }

const route = useRoute()
const api = useApi()
const toast = useToast()
const id = String(route.params.id)
const isp = ref<Isp | null>(null)
const cfg = ref<FormCfg | null>(null)
const loading = ref(true)
const step = ref<'form' | 'done' | 'formalized'>('form')
const simId = ref('')
const result = ref<OwnerResultData | null>(null)
const busy = ref(false)
const confirmOpen = ref(false)

const f = reactive({
  cnpj: '', address: '', responsible_name: '', email: '', phone: '',
  client_base: '' as string | number, cities: [] as string[], region: '',
  regularized: '', poles_valid_pct: '' as string | number, technicians_count: '' as string | number,
  employees_count: '' as string | number, clt_pct: '' as string | number, arpu: '' as string | number,
  pj_avg_fee: '' as string | number, pj_weekly_hours: '' as string | number, pj_days_week: '' as string | number,
  pj_shift: '', pj_invoice: '', pj_contract_months: '' as string | number, pj_notes: '',
})
const decimal = (v: string | number) => Number(String(v).replace(',', '.'))
/** O bloco de contratos PJ só aparece quando a equipe não é 100% CLT. */
const hasPj = computed(() => f.clt_pct !== '' && Number.isFinite(decimal(f.clt_pct)) && decimal(f.clt_pct) < 100)
const errors = reactive<Record<string, string>>({})
for (const k of Object.keys(f) as (keyof typeof f)[]) watch(() => f[k], () => { delete errors[k] }, { deep: true })

onMounted(async () => {
  try {
    const [r, c] = await Promise.all([
      api.get<{ isp: Isp }>(`/isp/companies/${id}`),
      api.get<FormCfg>('/isp/form-config'),
    ])
    isp.value = r.isp; cfg.value = c
    const i = r.isp
    Object.assign(f, {
      cnpj: fmtDocument(i.cnpj),
      address: `${i.street}, ${i.number}${i.complement ? ` – ${i.complement}` : ''} – ${i.district} – ${i.city}/${i.state}${i.cep ? ` – CEP ${maskCep(i.cep)}` : ''}`,
      responsible_name: i.responsible_name, email: i.email, phone: maskPhone(i.phone),
      cities: [i.city], region: i.region,
    })
  } catch (e) { toast.error(errorMessage(e)); await navigateTo('/portal') } finally { loading.value = false }
})

const regionStates = computed(() => cfg.value?.regions.find((r) => r.code === f.region)?.states.join(', ') ?? '')
const outsideRegion = computed(() => isp.value && f.region && f.region !== isp.value.region)

function validate() {
  for (const k of Object.keys(errors)) delete errors[k]
  if (f.address.trim().length < 8) errors.address = 'Informe o endereço completo.'
  if (!isFullName(f.responsible_name)) errors.responsible_name = 'Informe nome e sobrenome.'
  if (!isEmail(f.email)) errors.email = 'E-mail inválido.'
  if (!isPhone(f.phone)) errors.phone = 'Telefone com DDD inválido.'
  const base = Number(f.client_base)
  if (!Number.isInteger(base) || base < 1) errors.client_base = 'Informe a quantidade de clientes.'
  if (!f.cities.length) errors.cities = 'Informe ao menos uma cidade.'
  if (!f.region) errors.region = 'Selecione a região.'
  if (!f.regularized) errors.regularized = 'Selecione uma opção.'
  const poles = Number(f.poles_valid_pct)
  if (f.poles_valid_pct === '' || !Number.isFinite(poles) || poles < 0 || poles > 100) errors.poles_valid_pct = 'Percentual entre 0 e 100.'
  const tech = Number(f.technicians_count), emp = Number(f.employees_count)
  if (f.technicians_count === '' || !Number.isInteger(tech) || tech < 0) errors.technicians_count = 'Informe a quantidade de técnicos.'
  if (f.employees_count === '' || !Number.isInteger(emp) || emp < 0) errors.employees_count = 'Informe o total de funcionários.'
  else if (!errors.technicians_count && emp < tech) errors.employees_count = 'O total deve incluir os técnicos.'
  const clt = decimal(f.clt_pct)
  if (f.clt_pct === '' || !Number.isFinite(clt) || clt < 0 || clt > 100) errors.clt_pct = 'Percentual entre 0 e 100.'
  if (hasPj.value) {
    const fee = decimal(f.pj_avg_fee), hours = decimal(f.pj_weekly_hours), days = Number(f.pj_days_week), months = Number(f.pj_contract_months)
    if (!Number.isFinite(fee) || fee <= 0) errors.pj_avg_fee = 'Informe o honorário médio mensal.'
    if (!Number.isFinite(hours) || hours <= 0 || hours > 168) errors.pj_weekly_hours = 'Informe as horas semanais.'
    if (!Number.isInteger(days) || days < 1 || days > 7) errors.pj_days_week = 'De 1 a 7 dias.'
    if (!f.pj_shift) errors.pj_shift = 'Selecione uma opção.'
    if (!f.pj_invoice) errors.pj_invoice = 'Selecione uma opção.'
    if (f.pj_contract_months === '' || !Number.isInteger(months) || months < 0) errors.pj_contract_months = 'Informe o tempo médio em meses.'
  }
  const arpu = Number(String(f.arpu).replace(',', '.'))
  if (!Number.isFinite(arpu) || arpu <= 0) errors.arpu = 'Informe o valor médio mensal em reais.'
  return !Object.keys(errors).length
}

async function simulate() {
  if (!validate()) { toast.warning('Revise os campos destacados.'); document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return }
  busy.value = true
  try {
    const r = await api.post<{ simulation: { id: string }; result: OwnerResultData | null }>(`/isp/companies/${id}/simulations`, {
      cnpj: onlyDigits(f.cnpj), address: f.address, responsible_name: f.responsible_name, email: f.email,
      phone: onlyDigits(f.phone), client_base: Number(f.client_base), cities: f.cities, region: f.region,
      regularized: f.regularized, poles_valid_pct: Number(f.poles_valid_pct),
      technicians_count: Number(f.technicians_count), employees_count: Number(f.employees_count),
      clt_pct: decimal(f.clt_pct), arpu: decimal(f.arpu),
      ...(hasPj.value ? {
        pj_avg_fee: decimal(f.pj_avg_fee), pj_weekly_hours: decimal(f.pj_weekly_hours), pj_days_week: Number(f.pj_days_week),
        pj_shift: f.pj_shift, pj_invoice: f.pj_invoice, pj_contract_months: Number(f.pj_contract_months), pj_notes: f.pj_notes.trim(),
      } : {}),
    })
    simId.value = r.simulation.id
    result.value = r.result
    step.value = 'done'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    if (e instanceof ApiError && e.data.errors) Object.assign(errors, e.data.errors as Record<string, string>)
    toast.error(errorMessage(e))
  } finally { busy.value = false }
}

async function formalize() {
  busy.value = true
  try {
    await api.post(`/isp/simulations/${simId.value}/formalize`)
    confirmOpen.value = false
    step.value = 'formalized'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) { toast.error(errorMessage(e)) } finally { busy.value = false }
}

function again() {
  // Mantém os dados preenchidos para o provedor ajustar o que quiser
  step.value = 'form'; simId.value = ''; result.value = null
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="narrow">
    <NuxtLink :to="`/portal/provedor/${id}`" class="back"><AppIcon name="arrow-left" :size="16" /> {{ isp?.trade_name ?? 'Provedor' }}</NuxtLink>
    <div v-if="loading" class="empty"><span class="spinner" /></div>

    <template v-else-if="step === 'form' && isp && cfg">
      <div class="page-head">
        <div><div class="eyebrow">Simulador DealSourcing</div><h1>Avaliação preliminar do provedor</h1>
          <p>Preencha as informações da operação. Os dados são confidenciais e usados apenas pela equipe NOVALE.</p></div>
      </div>

      <form class="stack" novalidate @submit.prevent="simulate">
        <article class="card">
          <div class="card-head"><h2><span class="n">1–5</span> Identificação</h2></div>
          <div class="card-body form-grid">
            <div class="field"><label for="cnpj">CNPJ</label><input id="cnpj" class="input" :value="f.cnpj" disabled>
              <span class="hint">CNPJ do provedor cadastrado.</span></div>
            <div class="field"><label for="resp">Nome do responsável<span class="req">*</span></label>
              <input id="resp" v-model="f.responsible_name" class="input" :aria-invalid="!!errors.responsible_name">
              <span v-if="errors.responsible_name" class="error">{{ errors.responsible_name }}</span></div>
            <div class="field full"><label for="addr">Endereço completo<span class="req">*</span></label>
              <input id="addr" v-model="f.address" class="input" :aria-invalid="!!errors.address">
              <span v-if="errors.address" class="error">{{ errors.address }}</span></div>
            <div class="field"><label for="em">E-mail<span class="req">*</span></label>
              <input id="em" v-model="f.email" class="input" type="email" :aria-invalid="!!errors.email">
              <span v-if="errors.email" class="error">{{ errors.email }}</span></div>
            <div class="field"><label for="ph">Telefone<span class="req">*</span></label>
              <input maxlength="15" id="ph" class="input" inputmode="tel" :value="f.phone" :aria-invalid="!!errors.phone"
                @input="f.phone = masked($event, maskPhone)">
              <span v-if="errors.phone" class="error">{{ errors.phone }}</span></div>
          </div>
        </article>

        <article class="card">
          <div class="card-head"><h2><span class="n">6–8</span> Base e área de atuação</h2></div>
          <div class="card-body form-grid">
            <div class="field"><label for="base">Tamanho da base de clientes<span class="req">*</span></label>
              <input id="base" v-model="f.client_base" class="input" type="number" min="1" step="1" inputmode="numeric" placeholder="Ex.: 4500" :aria-invalid="!!errors.client_base">
              <span v-if="errors.client_base" class="error">{{ errors.client_base }}</span><span v-else class="hint">Clientes ativos (pagantes) hoje.</span></div>
            <div class="field"><label for="reg">Região de atuação<span class="req">*</span></label>
              <select id="reg" v-model="f.region" class="select" :aria-invalid="!!errors.region">
                <option v-for="r in cfg.regions" :key="r.code" :value="r.code">{{ r.name }}</option>
              </select>
              <span v-if="errors.region" class="error">{{ errors.region }}</span>
              <span v-else-if="outsideRegion" class="hint warn">Diferente da região do endereço do provedor ({{ REGION_LABEL[isp.region] }}). Confirme se a maior parte da base está nesta região.</span>
              <span v-else class="hint">Estados: {{ regionStates }}</span></div>
            <div class="field full"><label for="cities">Cidades atendidas<span class="req">*</span></label>
              <TagInput id="cities" v-model="f.cities" placeholder="Digite a cidade e pressione Enter" :invalid="!!errors.cities" />
              <span v-if="errors.cities" class="error">{{ errors.cities }}</span><span v-else class="hint">Pressione Enter ou vírgula após cada cidade.</span></div>
          </div>
        </article>

        <article class="card">
          <div class="card-head"><h2><span class="n">9–13</span> Operação</h2></div>
          <div class="card-body form-grid">
            <div class="field"><span class="label">Regularização societária<span class="req">*</span></span>
              <SegmentedControl v-model="f.regularized" name="regularized" :options="cfg.regularized_options" :invalid="!!errors.regularized" />
              <span v-if="errors.regularized" class="error">{{ errors.regularized }}</span><span v-else class="hint">Contrato social e registros em dia.</span></div>
            <div class="field"><label for="poles">Postes com contrato válido<span class="req">*</span></label>
              <div class="suffix"><input id="poles" v-model="f.poles_valid_pct" class="input" type="number" min="0" max="100" step="0.1" inputmode="decimal" placeholder="Ex.: 85" :aria-invalid="!!errors.poles_valid_pct"><span>%</span></div>
              <span v-if="errors.poles_valid_pct" class="error">{{ errors.poles_valid_pct }}</span><span v-else class="hint">Percentual dos postes utilizados com contrato vigente.</span></div>
            <div class="field"><label for="tech">Técnicos<span class="req">*</span></label>
              <input id="tech" v-model="f.technicians_count" class="input" type="number" min="0" step="1" inputmode="numeric" :aria-invalid="!!errors.technicians_count">
              <span v-if="errors.technicians_count" class="error">{{ errors.technicians_count }}</span><span v-else class="hint">Equipe técnica de campo e suporte.</span></div>
            <div class="field"><label for="emp">Total de funcionários<span class="req">*</span></label>
              <input id="emp" v-model="f.employees_count" class="input" type="number" min="0" step="1" inputmode="numeric" :aria-invalid="!!errors.employees_count">
              <span v-if="errors.employees_count" class="error">{{ errors.employees_count }}</span><span v-else class="hint">Incluindo os técnicos.</span></div>
            <div class="field"><label for="clt">Equipe contratada em CLT<span class="req">*</span></label>
              <div class="suffix"><input id="clt" v-model="f.clt_pct" class="input" type="number" min="0" max="100" step="1" inputmode="decimal" placeholder="Ex.: 80" :aria-invalid="!!errors.clt_pct"><span>%</span></div>
              <span v-if="errors.clt_pct" class="error">{{ errors.clt_pct }}</span><span v-else class="hint">Percentual dos funcionários em CLT. O restante é considerado PJ.</span></div>
            <div class="field"><label for="arpu">ARPU<span class="req">*</span></label>
              <div class="prefix"><span>R$</span><input id="arpu" v-model="f.arpu" class="input" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Ex.: 99,90" :aria-invalid="!!errors.arpu"></div>
              <span v-if="errors.arpu" class="error">{{ errors.arpu }}</span><span v-else class="hint">Valor médio mensal pago por cliente.</span></div>
          </div>
        </article>

        <Transition name="pj">
          <article v-if="hasPj" class="card">
            <div class="card-head"><h2><span class="n">PJ</span> Contratos PJ</h2></div>
            <div class="card-body form-grid">
              <p class="small muted full" style="margin:0">Como {{ (100 - decimal(f.clt_pct)).toLocaleString('pt-BR') }}% da equipe é PJ, conte como são esses contratos (valores médios).</p>
              <div class="field"><label for="pjfee">Honorário médio mensal por PJ<span class="req">*</span></label>
                <div class="prefix"><span>R$</span><input id="pjfee" v-model="f.pj_avg_fee" class="input" type="number" min="1" step="0.01" inputmode="decimal" placeholder="Ex.: 3500" :aria-invalid="!!errors.pj_avg_fee"></div>
                <span v-if="errors.pj_avg_fee" class="error">{{ errors.pj_avg_fee }}</span><span v-else class="hint">Valor médio pago a cada prestador por mês.</span></div>
              <div class="field"><label for="pjh">Carga horária semanal média<span class="req">*</span></label>
                <div class="suffix"><input id="pjh" v-model="f.pj_weekly_hours" class="input" type="number" min="1" max="168" step="1" inputmode="decimal" placeholder="Ex.: 44" :aria-invalid="!!errors.pj_weekly_hours"><span>h</span></div>
                <span v-if="errors.pj_weekly_hours" class="error">{{ errors.pj_weekly_hours }}</span></div>
              <div class="field"><label for="pjd">Dias trabalhados por semana<span class="req">*</span></label>
                <input id="pjd" v-model="f.pj_days_week" class="input" type="number" min="1" max="7" step="1" inputmode="numeric" placeholder="Ex.: 5" :aria-invalid="!!errors.pj_days_week">
                <span v-if="errors.pj_days_week" class="error">{{ errors.pj_days_week }}</span></div>
              <div class="field"><label for="pjm">Tempo médio de contrato<span class="req">*</span></label>
                <div class="suffix"><input id="pjm" v-model="f.pj_contract_months" class="input" type="number" min="0" step="1" inputmode="numeric" placeholder="Ex.: 18" :aria-invalid="!!errors.pj_contract_months"><span>meses</span></div>
                <span v-if="errors.pj_contract_months" class="error">{{ errors.pj_contract_months }}</span><span v-else class="hint">Há quanto tempo, em média, prestam serviço.</span></div>
              <div class="field"><span class="label">Trabalham em escala?<span class="req">*</span></span>
                <SegmentedControl v-model="f.pj_shift" name="pjshift" :options="cfg.pj_shift_options" :invalid="!!errors.pj_shift" />
                <span v-if="errors.pj_shift" class="error">{{ errors.pj_shift }}</span><span v-else class="hint">Ex.: 12×36, plantões, revezamento.</span></div>
              <div class="field"><span class="label">Emitem nota fiscal?<span class="req">*</span></span>
                <SegmentedControl v-model="f.pj_invoice" name="pjinvoice" :options="cfg.pj_invoice_options" :invalid="!!errors.pj_invoice" />
                <span v-if="errors.pj_invoice" class="error">{{ errors.pj_invoice }}</span></div>
              <div class="field full"><label for="pjn">Outras características dos contratos</label>
                <textarea id="pjn" v-model="f.pj_notes" class="textarea" rows="2" maxlength="1000" placeholder="Ex.: exclusividade, uso de veículo próprio, benefícios, multa rescisória…" />
                <span class="hint">Opcional.</span></div>
            </div>
          </article>
        </Transition>

        <div class="submit card">
          <p class="small muted">Ao simular, os dados ficam registrados no histórico do provedor. O resultado é analisado internamente e não gera compromisso.</p>
          <button class="btn btn-lg btn-navy" :disabled="busy"><span v-if="busy" class="spinner" /> SIMULAR AGORA</button>
        </div>
      </form>
    </template>

    <article v-else-if="step === 'done' && result" class="card result with-value">
      <div class="eyebrow">Resultado da simulação</div>
      <h1>Quanto vale o {{ isp?.trade_name }}</h1>
      <OwnerResult :result="result" />
      <p class="small muted center-txt">Valores calculados com base nas informações desta simulação. A avaliação definitiva depende da análise da equipe NOVALE.</p>
      <div class="decide">
        <div class="opt-card">
          <AppIcon name="handshake" :size="22" />
          <div><strong>Gostou do resultado?</strong><p class="small muted">Formalize o interesse nesta simulação e nossa equipe entra em contato.</p></div>
          <button class="btn btn-navy" @click="confirmOpen = true">FORMALIZAR INTERESSE NESTA SIMULAÇÃO</button>
        </div>
        <div class="opt-card">
          <AppIcon name="refresh" :size="22" />
          <div><strong>Quer ajustar alguma informação?</strong><p class="small muted">Faça uma nova simulação. Os dados atuais ficam preenchidos para você alterar.</p></div>
          <button class="btn btn-outline" @click="again">Fazer nova simulação</button>
        </div>
      </div>
      <NuxtLink :to="`/portal/provedor/${id}`" class="small">Ver histórico de simulações</NuxtLink>
    </article>

    <article v-else-if="step === 'done'" class="card result">
      <div class="ico"><AppIcon name="check" :size="30" :stroke="2.4" /></div>
      <div class="eyebrow">Simulação registrada</div>
      <h1>Recebemos as informações do {{ isp?.trade_name }}</h1>
      <p class="muted">A avaliação preliminar foi gerada e ficará disponível para análise da equipe NOVALE.
        Se você deseja conversar sobre uma possível venda, formalize seu interesse abaixo.</p>
      <button class="btn btn-lg btn-navy formal" @click="confirmOpen = true">FORMALIZAR INTERESSE NESTA SIMULAÇÃO</button>
      <div class="row center">
        <NuxtLink :to="`/portal/provedor/${id}`" class="btn btn-ghost">Ver histórico</NuxtLink>
        <button class="btn btn-ghost" @click="again">Fazer outra simulação</button>
      </div>
    </article>

    <article v-else-if="step === 'formalized'" class="card result">
      <div class="ico ok"><AppIcon name="handshake" :size="30" /></div>
      <div class="eyebrow">Interesse formalizado</div>
      <h1>Obrigado! Nossa equipe vai falar com você.</h1>
      <p class="muted">Seu interesse foi registrado em {{ fmtDateTime(new Date().toISOString()) }} e encaminhado para a equipe comercial da NOVALE.
        Você receberá o contato pelo e-mail ou telefone informados.</p>
      <div class="row center">
        <NuxtLink :to="`/portal/provedor/${id}`" class="btn">Ver histórico do provedor</NuxtLink>
        <NuxtLink to="/portal" class="btn btn-ghost">Início</NuxtLink>
      </div>
    </article>

    <AppModal :open="confirmOpen" title="Formalizar interesse nesta simulação" @close="confirmOpen = false">
      <p>Ao confirmar, você declara interesse em conversar com a NOVALE sobre uma possível venda do provedor <strong>{{ isp?.trade_name }}</strong><template v-if="result">, com base na estimativa de <strong>{{ fmtBRL(result.value_min) }} a {{ fmtBRL(result.value_max) }}</strong></template>.</p>
      <p class="small muted">Esta manifestação não gera obrigação de venda. Ela apenas libera o contato da nossa equipe comercial.</p>
      <template #footer>
        <button class="btn btn-ghost" @click="confirmOpen = false">Cancelar</button>
        <button class="btn btn-navy" :disabled="busy" @click="formalize"><span v-if="busy" class="spinner" /> Confirmar interesse</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.narrow { max-width: 900px; margin: 0 auto; }
.back { display: inline-flex; align-items: center; gap: .35rem; font-size: .88rem; margin-bottom: .75rem; }
.n { display: inline-grid; place-items: center; min-width: 38px; height: 24px; padding: 0 .4rem; margin-right: .5rem; border-radius: 6px; background: var(--navy); color: #fff; font-size: .72rem; vertical-align: 2px; }
.suffix, .prefix { position: relative; }
.suffix span, .prefix span { position: absolute; top: 50%; transform: translateY(-50%); color: var(--muted); font-weight: 600; font-size: .9rem; pointer-events: none; }
.suffix span { right: .9rem; }
.suffix .input { padding-right: 2.2rem; }
.prefix span { left: .85rem; }
.prefix .input { padding-left: 2.5rem; }
.hint.warn { color: var(--warning); }
.submit { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.1rem 1.4rem; flex-wrap: wrap; border-left: 4px solid var(--navy); }
.submit p { margin: 0; max-width: 520px; }
.result { text-align: center; padding: 2.5rem 1.5rem; border-top: 4px solid var(--navy); }
.result h1 { max-width: 560px; margin-left: auto; margin-right: auto; }
.result p { max-width: 560px; margin-left: auto; margin-right: auto; }
.ico { width: 64px; height: 64px; border-radius: 16px; display: grid; place-items: center; margin: 0 auto 1rem; background: var(--blue-100); color: var(--blue); }
.ico.ok { background: var(--success-bg); color: var(--success); }
.formal { margin: .75rem 0 1rem; white-space: normal; text-align: center; }
.row.center { justify-content: center; }
.result.with-value { text-align: left; }
.result.with-value > .eyebrow, .result.with-value > h1 { text-align: center; }
.center-txt { text-align: center; margin: .9rem 0 0; }
.decide { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1.5rem 0 1rem; }
.opt-card { display: flex; flex-direction: column; gap: .6rem; padding: 1.1rem; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--tint); }
.opt-card > :deep(svg) { color: var(--blue); }
.opt-card p { margin: .2rem 0 0; }
.opt-card .btn { margin-top: auto; white-space: normal; text-align: center; }
.result.with-value > a { display: block; text-align: center; }
@media (max-width: 700px) { .decide { grid-template-columns: 1fr; } }
.pj-enter-active, .pj-leave-active { transition: opacity .25s, transform .25s; }
.pj-enter-from, .pj-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
