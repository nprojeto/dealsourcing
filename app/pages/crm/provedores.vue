<script setup lang="ts">
import type { IspStatus, SimStatus } from '~/utils/labels'
import type { SimResult } from '~/utils/simulator'
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial', 'colaborador'] })
useHead({ title: 'Provedores · DealSourcing' })

interface Row {
  id: string; trade_name: string; legal_name: string; cnpj: string; city: string; state: string; region: string; status: IspStatus;
  referral_code: string | null; referral_owner_type: string | null; created_at: string; simulations_count: number; formalized_count: number;
  owner: { full_name: string; email: string } | null; referrer: { full_name: string } | null;
  last_simulation: { id: string; created_at: string; status: SimStatus; value_min: number | null; value_max: number | null } | null
}
interface Sim {
  id: string; created_at: string; status: SimStatus; formalized_at: string | null; client_base: number; cities: string[]; region: string;
  regularized: string; poles_valid_pct: number; technicians_count: number; employees_count: number; employment_type: string; arpu: number;
  address: string; responsible_name: string; email: string; phone: string; result: SimResult | null; version: { version: number } | null
}
interface Detail {
  isp: Row & { email: string; phone: string; responsible_name: string; cep: string | null; street: string; number: string; complement: string | null; district: string; owner: { full_name: string; email: string; phone: string | null } | null; referrer: { full_name: string; email: string } | null };
  simulations: Sim[]; formalizations: { id: string; simulation_id: string; formalized_at: string }[];
  opportunity: { stage_key: string; stage: { name: string } | null; in_queue: boolean; formalizations_count: number; first_formalized_at: string; last_formalized_at: string } | null;
  attributions: { code: string | null; owner_type: string | null; is_current: boolean; reason: string | null; attributed_at: string; owner: { full_name: string } | null }[]
}

const api = useApi()
const toast = useToast()
const auth = useAuth()
const route = useRoute()
const router = useRouter()
const f = reactive({ q: '', state: '', region: '', status: String(route.query.status ?? ''), page: 1 })
const items = ref<Row[]>([])
const total = ref(0)
const loading = ref(false)
const pageSize = 20

async function load() {
  loading.value = true
  try {
    const r = await api.get<{ items: Row[]; total: number }>('/crm/isps', { ...f, page_size: pageSize })
    items.value = r.items; total.value = r.total
  } catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
let deb: ReturnType<typeof setTimeout> | undefined
watch(() => f.q, () => { clearTimeout(deb); deb = setTimeout(() => { f.page = 1; load() }, 350) })
watch(() => [f.state, f.region, f.status], () => { f.page = 1; load() })
onMounted(() => { load(); if (route.query.id) open(String(route.query.id)) })
watch(() => route.query.id, (id) => { if (id) open(String(id)) })

const detail = ref<Detail | null>(null)
const detailOpen = ref(false)
const detailLoading = ref(false)
const expanded = ref<string | null>(null)
async function open(id: string) {
  detailOpen.value = true; detailLoading.value = true; detail.value = null
  try { detail.value = await api.get<Detail>(`/crm/isps/${id}`); expanded.value = detail.value.simulations[0]?.id ?? null }
  catch (e) { toast.error(errorMessage(e)); detailOpen.value = false } finally { detailLoading.value = false }
}
function close() { detailOpen.value = false; if (route.query.id) router.replace({ query: { ...route.query, id: undefined } }) }
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <div class="eyebrow">Comercial</div>
        <h1>Provedores</h1>
        <p>{{ auth.isManager.value ? 'Todos os ISPs cadastrados, com simulações e avaliações internas.' : 'Provedores cadastrados com o seu código de indicação.' }}</p>
      </div>
    </div>

    <div class="card filters">
      <div class="f-search"><AppIcon name="search" :size="18" />
        <input v-model="f.q" class="input" placeholder="Buscar por nome, CNPJ, cidade, e-mail ou código" aria-label="Buscar"></div>
      <select v-model="f.status" class="select" aria-label="Status">
        <option value="">Todos os status</option>
        <option v-for="(l, k) in ISP_STATUS_LABEL" :key="k" :value="k">{{ l }}</option>
      </select>
      <select v-model="f.region" class="select small-sel" aria-label="Região">
        <option value="">Todas as regiões</option>
        <option v-for="(l, k) in REGION_LABEL" :key="k" :value="k">{{ l }}</option>
      </select>
      <select v-model="f.state" class="select small-sel" aria-label="Estado">
        <option value="">UF</option><option v-for="u in UFS" :key="u" :value="u">{{ u }}</option>
      </select>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Provedor</th><th>Local</th><th>Indicação</th><th>Simulações</th><th>Última avaliação</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-if="loading && !items.length"><td colspan="6" class="empty"><span class="spinner" /></td></tr>
          <tr v-else-if="!items.length"><td colspan="6" class="empty">Nenhum provedor encontrado.</td></tr>
          <tr v-for="r in items" :key="r.id" class="clickable" tabindex="0" @click="open(r.id)" @keydown.enter="open(r.id)">
            <td><div class="t-strong">{{ r.trade_name }}</div><div class="small muted">{{ fmtDocument(r.cnpj) }}</div></td>
            <td class="nowrap">{{ r.city }}/{{ r.state }}<div class="small muted">{{ REGION_LABEL[r.region] }}</div></td>
            <td><span v-if="r.referral_code" class="mono">{{ r.referral_code }}</span><span v-else class="muted">Direto</span>
              <div v-if="r.referrer" class="small muted">{{ r.referrer.full_name }} · {{ r.referral_owner_type === 'external' ? 'parceiro' : 'interno' }}</div></td>
            <td>{{ r.simulations_count }}<span v-if="r.formalized_count" class="small muted"> · {{ r.formalized_count }} formal.</span></td>
            <td class="nowrap">
              <template v-if="r.last_simulation?.value_min !== null && r.last_simulation">
                <strong class="money">{{ fmtBRLShort(r.last_simulation.value_min) }} – {{ fmtBRLShort(r.last_simulation.value_max) }}</strong>
                <div class="small muted">{{ fmtDate(r.last_simulation.created_at) }}</div>
              </template>
              <span v-else class="muted">—</span>
            </td>
            <td><span class="badge" :class="ISP_STATUS_TONE[r.status]">{{ ISP_STATUS_LABEL[r.status] }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPager :page="f.page" :page-size="pageSize" :total="total" @change="(p) => { f.page = p; load() }" />

    <AppModal :open="detailOpen" side :width="680" :title="detail?.isp.trade_name ?? 'Provedor'" @close="close">
      <div v-if="detailLoading" class="empty"><span class="spinner" /></div>
      <div v-else-if="detail" class="stack">
        <div class="row">
          <span class="badge" :class="ISP_STATUS_TONE[detail.isp.status]">{{ ISP_STATUS_LABEL[detail.isp.status] }}</span>
          <span v-if="detail.opportunity" class="badge navy plain">Funil: {{ detail.opportunity.stage?.name }}</span>
          <span v-if="detail.opportunity?.in_queue" class="badge warning">Na fila de atendimento</span>
        </div>

        <section>
          <div class="eyebrow">Dados cadastrais</div>
          <dl class="dl">
            <dt>Nome empresarial</dt><dd>{{ detail.isp.legal_name }}</dd>
            <dt>CNPJ</dt><dd>{{ fmtDocument(detail.isp.cnpj) }}</dd>
            <dt>Endereço</dt><dd>{{ detail.isp.street }}, {{ detail.isp.number }}<template v-if="detail.isp.complement"> · {{ detail.isp.complement }}</template> · {{ detail.isp.district }} · {{ detail.isp.city }}/{{ detail.isp.state }}<template v-if="detail.isp.cep"> · CEP {{ maskCep(detail.isp.cep) }}</template></dd>
            <dt>Responsável</dt><dd>{{ detail.isp.responsible_name }}</dd>
            <dt>Contato</dt><dd>{{ detail.isp.email }} · {{ fmtPhone(detail.isp.phone) }}</dd>
            <dt>Conta do portal</dt><dd>{{ detail.isp.owner?.full_name }} · {{ detail.isp.owner?.email }}</dd>
            <dt>Cadastro</dt><dd>{{ fmtDateTime(detail.isp.created_at) }}</dd>
          </dl>
        </section>

        <section class="box">
          <div class="eyebrow">Origem comercial</div>
          <dl class="dl">
            <dt>Código</dt><dd><span class="mono">{{ detail.isp.referral_code ?? 'Sem código (direto)' }}</span></dd>
            <dt>Responsável</dt><dd>{{ detail.isp.referrer?.full_name ?? '—' }}<template v-if="detail.isp.referral_owner_type"> · {{ detail.isp.referral_owner_type === 'external' ? 'Parceiro externo' : 'Equipe interna' }}</template></dd>
            <template v-if="detail.opportunity">
              <dt>1ª formalização</dt><dd>{{ fmtDateTime(detail.opportunity.first_formalized_at) }}</dd>
              <dt>Formalizações</dt><dd>{{ detail.opportunity.formalizations_count }}</dd>
            </template>
          </dl>
        </section>

        <section>
          <div class="eyebrow">Simulações ({{ detail.simulations.length }})</div>
          <p v-if="!detail.simulations.length" class="small muted">Nenhuma simulação realizada.</p>
          <div v-for="s in detail.simulations" :key="s.id" class="sim" :class="{ open: expanded === s.id }">
            <button class="sim-head" @click="expanded = expanded === s.id ? null : s.id">
              <span class="grow">
                <strong>{{ fmtDateTime(s.created_at) }}</strong>
                <span class="small muted"> · {{ fmtInt(s.client_base) }} clientes · v{{ s.version?.version }}</span>
              </span>
              <span v-if="s.result" class="money small">{{ fmtBRLShort(s.result.value_min) }} – {{ fmtBRLShort(s.result.value_max) }}</span>
              <span class="badge" :class="SIM_STATUS_TONE[s.status]">{{ s.status === 'interest_formalized' ? 'Formalizada' : 'Simulada' }}</span>
              <AppIcon :name="expanded === s.id ? 'chevron-down' : 'chevron-right'" :size="16" />
            </button>
            <div v-if="expanded === s.id" class="sim-body stack">
              <SimulationResult v-if="s.result" :result="s.result" :client-base="s.client_base" />
              <dl class="dl small">
                <dt>Cidades atendidas</dt><dd>{{ s.cities.join(', ') }}</dd>
                <dt>Região</dt><dd>{{ REGION_LABEL[s.region] }}</dd>
                <dt>Regularização</dt><dd>{{ s.regularized === 'SIM' ? 'Sim' : 'Não' }}</dd>
                <dt>Postes válidos</dt><dd>{{ Number(s.poles_valid_pct).toLocaleString('pt-BR') }}%</dd>
                <dt>Equipe</dt><dd>{{ s.technicians_count }} técnicos · {{ s.employees_count }} funcionários · {{ s.employment_type }}</dd>
                <dt>ARPU</dt><dd>{{ fmtBRL(s.arpu) }}</dd>
                <dt>Informado por</dt><dd>{{ s.responsible_name }} · {{ s.email }} · {{ fmtPhone(s.phone) }}</dd>
                <dt>Endereço</dt><dd>{{ s.address }}</dd>
                <template v-if="s.formalized_at"><dt>Interesse formalizado</dt><dd>{{ fmtDateTime(s.formalized_at) }}</dd></template>
              </dl>
            </div>
          </div>
        </section>

        <section v-if="detail.attributions.length">
          <div class="eyebrow">Histórico de atribuição</div>
          <ul class="mini">
            <li v-for="a in detail.attributions" :key="a.attributed_at">
              <strong class="mono">{{ a.code ?? 'Direto' }}</strong> · {{ a.owner?.full_name ?? '—' }}
              <span class="muted">· {{ fmtDateTime(a.attributed_at) }} · {{ a.reason }}</span>
            </li>
          </ul>
        </section>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.filters { display: flex; gap: .75rem; padding: .85rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
.filters .select { width: auto; min-width: 180px; }
.filters .small-sel { min-width: 120px; }
.f-search { position: relative; flex: 1; min-width: 240px; }
.f-search :deep(svg) { position: absolute; left: .8rem; top: 50%; transform: translateY(-50%); color: var(--muted); }
.f-search .input { padding-left: 2.4rem; }
.money { color: var(--navy); font-weight: 700; }
.box { border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; background: var(--tint); }
.sim { border: 1px solid var(--line); border-radius: var(--radius); margin-top: .5rem; overflow: hidden; }
.sim.open { border-color: var(--line-strong); box-shadow: var(--shadow-sm); }
.sim-head { width: 100%; display: flex; align-items: center; gap: .6rem; padding: .7rem .85rem; background: #fff; border: 0; cursor: pointer; text-align: left; font: inherit; color: inherit; flex-wrap: wrap; }
.sim-head:hover { background: var(--tint); }
.sim-body { padding: .85rem; border-top: 1px solid var(--line); background: #FCFDFF; }
.mini { list-style: none; margin: 0; padding: 0; display: grid; gap: .35rem; font-size: .85rem; }
</style>
