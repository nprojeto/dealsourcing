<script setup lang="ts">
import type { IspStatus, SimStatus } from '~/utils/labels'
definePageMeta({ layout: 'portal', roles: ['isp_owner'] })
useHead({ title: 'Meu provedor · DealSourcing' })

interface Isp { id: string; legal_name: string; trade_name: string; cnpj: string; email: string; phone: string; responsible_name: string; cep: string | null; street: string; number: string; complement: string | null; district: string; city: string; state: string; region: string; referral_code: string | null; status: IspStatus; created_at: string }
interface Sim { id: string; client_base: number; cities: string[]; region: string; status: SimStatus; formalized_at: string | null; created_at: string }

const route = useRoute()
const api = useApi()
const toast = useToast()
const id = String(route.params.id)
const isp = ref<Isp | null>(null)
const sims = ref<Sim[]>([])
const loading = ref(true)
const confirming = ref<Sim | null>(null)
const busy = ref(false)

async function load() {
  try { const r = await api.get<{ isp: Isp; simulations: Sim[] }>(`/isp/companies/${id}`); isp.value = r.isp; sims.value = r.simulations }
  catch (e) { toast.error(errorMessage(e)); await navigateTo('/portal') } finally { loading.value = false }
}
onMounted(load)

async function formalize() {
  if (!confirming.value) return
  busy.value = true
  try {
    await api.post(`/isp/simulations/${confirming.value.id}/formalize`)
    toast.success('Interesse formalizado. Nossa equipe entrará em contato.')
    confirming.value = null
    await load()
  } catch (e) { toast.error(errorMessage(e)) } finally { busy.value = false }
}
</script>

<template>
  <div>
    <NuxtLink to="/portal" class="back"><AppIcon name="arrow-left" :size="16" /> Meus provedores</NuxtLink>
    <div v-if="loading" class="empty"><span class="spinner" /></div>
    <template v-else-if="isp">
      <div class="page-head">
        <div>
          <div class="eyebrow">Provedor</div>
          <h1>{{ isp.trade_name }}</h1>
          <p>{{ isp.legal_name }} · CNPJ {{ fmtDocument(isp.cnpj) }}</p>
        </div>
        <NuxtLink :to="`/portal/provedor/${isp.id}/simular`" class="btn btn-lg"><AppIcon name="chart" :size="18" /> Nova simulação</NuxtLink>
      </div>

      <div class="layout">
        <article class="card">
          <div class="card-head"><h2>Histórico de simulações</h2><span class="badge" :class="ISP_STATUS_TONE[isp.status]">{{ ISP_STATUS_LABEL[isp.status] }}</span></div>
          <div v-if="!sims.length" class="empty">
            <BrandLogo symbol :height="56" />
            <p>Nenhuma simulação ainda.</p>
            <NuxtLink :to="`/portal/provedor/${isp.id}/simular`" class="btn">Fazer a primeira simulação</NuxtLink>
          </div>
          <div v-else class="table-wrap" style="border:0;border-radius:0">
            <table class="table">
              <thead><tr><th>Data</th><th>Base de clientes</th><th>Cidades</th><th>Status</th><th /></tr></thead>
              <tbody>
                <tr v-for="s in sims" :key="s.id">
                  <td class="nowrap">{{ fmtDateTime(s.created_at) }}</td>
                  <td>{{ fmtInt(s.client_base) }}</td>
                  <td class="small">{{ s.cities.slice(0, 3).join(', ') }}<span v-if="s.cities.length > 3" class="muted"> +{{ s.cities.length - 3 }}</span></td>
                  <td><span class="badge" :class="SIM_STATUS_TONE[s.status]">{{ SIM_STATUS_LABEL[s.status] }}</span>
                    <div v-if="s.formalized_at" class="small muted">{{ fmtDateTime(s.formalized_at) }}</div></td>
                  <td class="nowrap">
                    <button v-if="s.status === 'simulated'" class="btn btn-sm btn-navy" @click="confirming = s">Formalizar interesse</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="small muted note">A avaliação preliminar é analisada internamente pela equipe NOVALE. Ao formalizar interesse, um especialista entra em contato para apresentar os próximos passos.</p>
        </article>

        <article class="card">
          <div class="card-head"><h2>Dados cadastrais</h2></div>
          <div class="card-body">
            <dl class="dl">
              <dt>Responsável</dt><dd>{{ isp.responsible_name }}</dd>
              <dt>E-mail</dt><dd>{{ isp.email }}</dd>
              <dt>Telefone</dt><dd>{{ fmtPhone(isp.phone) }}</dd>
              <dt>Endereço</dt><dd>{{ isp.street }}, {{ isp.number }}<template v-if="isp.complement"> · {{ isp.complement }}</template><br>{{ isp.district }} · {{ isp.city }}/{{ isp.state }}<template v-if="isp.cep"><br>CEP {{ maskCep(isp.cep) }}</template></dd>
              <dt>Região</dt><dd>{{ REGION_LABEL[isp.region] ?? isp.region }}</dd>
              <dt>Código de indicação</dt><dd><span class="mono">{{ isp.referral_code ?? '—' }}</span></dd>
              <dt>Cadastrado em</dt><dd>{{ fmtDate(isp.created_at) }}</dd>
            </dl>
          </div>
        </article>
      </div>
    </template>

    <AppModal :open="!!confirming" title="Formalizar interesse nesta simulação" @close="confirming = null">
      <p>Ao confirmar, você declara interesse em conversar com a NOVALE sobre uma possível venda do provedor <strong>{{ isp?.trade_name }}</strong>, com base na simulação de {{ fmtDateTime(confirming?.created_at) }}.</p>
      <p class="small muted">Esta manifestação não gera obrigação de venda. Ela apenas libera o contato da nossa equipe comercial.</p>
      <template #footer>
        <button class="btn btn-ghost" @click="confirming = null">Cancelar</button>
        <button class="btn btn-navy" :disabled="busy" @click="formalize"><span v-if="busy" class="spinner" /> Confirmar interesse</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.back { display: inline-flex; align-items: center; gap: .35rem; font-size: .88rem; margin-bottom: .75rem; }
.layout { display: grid; grid-template-columns: 1.6fr 1fr; gap: 1.25rem; align-items: start; }
.note { padding: 0 1.4rem 1.2rem; margin: .9rem 0 0; }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
</style>
