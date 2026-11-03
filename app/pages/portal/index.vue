<script setup lang="ts">
import type { IspStatus } from '~/utils/labels'
definePageMeta({ layout: 'portal', roles: ['isp_owner', 'parceiro'] })
useHead({ title: 'Início · DealSourcing' })

interface MyIsp { id: string; trade_name: string; legal_name: string; cnpj: string; city: string; state: string; status: IspStatus; simulations_count: number; formalized_count: number; last_simulation_at: string | null; created_at: string }
const { profile } = useAuth()
const api = useApi()
const toast = useToast()
const pc = usePublicConfig()
const isIsp = computed(() => profile.value?.role === 'isp_owner')
const isps = ref<MyIsp[]>([])
const loading = ref(true)
onMounted(async () => {
  pc.load()
  if (!isIsp.value) { loading.value = false; return }
  try { isps.value = (await api.get<{ items: MyIsp[] }>('/isp/companies')).items }
  catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
})
const contactEmail = computed(() => String(pc.setting('contact_email', '')))
const contactPhone = computed(() => String(pc.setting('contact_phone', '')))
</script>

<template>
  <div v-if="profile">
    <section class="welcome">
      <BrandLogo class="w-sphere" variant="branca" symbol :height="300" />
      <div class="w-in">
        <div class="eyebrow light">DealSourcing · {{ isIsp ? 'Portal do provedor' : 'Portal do parceiro' }}</div>
        <h1>Olá, {{ firstName(profile.full_name) }}.</h1>
        <p>{{ isIsp
          ? 'Cadastre seu provedor, faça simulações e formalize seu interesse quando quiser conversar com nossa equipe.'
          : 'Compartilhe seu código de indicação com provedores e acompanhe o andamento de cada indicação.' }}</p>
        <NuxtLink v-if="isIsp && isps.length" to="/portal/provedor/novo" class="btn btn-white" style="margin-top:1.1rem">
          <AppIcon name="plus" :size="18" /> Cadastrar outro provedor
        </NuxtLink>
      </div>
    </section>

    <template v-if="isIsp">
      <div v-if="loading" class="empty"><span class="spinner" /></div>
      <article v-else-if="!isps.length" class="card start">
        <div class="start-ico"><AppIcon name="building" :size="30" /></div>
        <div>
          <div class="eyebrow">Primeiro passo</div>
          <h2>Cadastre o seu provedor</h2>
          <p class="muted">Informe os dados da empresa e o código de indicação. Depois disso, o simulador fica disponível para você.</p>
          <NuxtLink to="/portal/provedor/novo" class="btn btn-lg">Cadastrar provedor <AppIcon name="arrow-right" :size="18" /></NuxtLink>
        </div>
      </article>
      <div v-else class="isp-grid">
        <NuxtLink v-for="i in isps" :key="i.id" :to="`/portal/provedor/${i.id}`" class="card isp">
          <div class="row between">
            <span class="badge" :class="ISP_STATUS_TONE[i.status]">{{ ISP_STATUS_LABEL[i.status] }}</span>
            <AppIcon name="chevron-right" :size="18" />
          </div>
          <h3>{{ i.trade_name }}</h3>
          <p class="small muted">{{ i.legal_name }} · CNPJ {{ fmtDocument(i.cnpj) }}</p>
          <p class="small muted">{{ i.city }}/{{ i.state }}</p>
          <div class="isp-foot">
            <span><strong>{{ i.simulations_count }}</strong> simulação(ões)</span>
            <span><strong>{{ i.formalized_count }}</strong> formalizada(s)</span>
            <span class="go">Simular <AppIcon name="arrow-right" :size="14" /></span>
          </div>
        </NuxtLink>
      </div>
    </template>

    <div class="grid-2 cols">
      <ReferralCard v-if="!isIsp" />
      <article class="card">
        <div class="card-head"><h2>Meus dados</h2><NuxtLink to="/minha-conta" class="btn btn-outline btn-sm">Editar</NuxtLink></div>
        <div class="card-body">
          <dl class="dl">
            <dt>Nome</dt><dd>{{ profile.full_name }}</dd>
            <dt>E-mail</dt><dd>{{ profile.email }}</dd>
            <dt>Telefone</dt><dd>{{ fmtPhone(profile.phone) }}</dd>
            <dt>Status</dt><dd><StatusBadge :status="profile.status" /></dd>
          </dl>
          <template v-if="contactEmail || contactPhone">
            <hr class="divider">
            <div class="eyebrow">Fale com a NOVALE</div>
            <p class="contact">
              <a v-if="contactEmail" :href="`mailto:${contactEmail}`"><AppIcon name="mail" :size="16" /> {{ contactEmail }}</a>
              <span v-if="contactPhone"><AppIcon name="phone" :size="16" /> {{ fmtPhone(contactPhone) }}</span>
            </p>
          </template>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.welcome { position: relative; overflow: hidden; border-radius: var(--radius-lg); background: linear-gradient(140deg, var(--navy), var(--navy-900)); color: #D7DEF3; padding: 2rem; margin-bottom: 1.5rem; }
.w-in { position: relative; z-index: 1; max-width: 680px; }
.welcome h1 { color: #fff; margin-bottom: .4rem; }
.welcome p { margin: 0; }
.eyebrow.light { color: #9FB0E8; }
.w-sphere { position: absolute; right: -60px; top: -60px; opacity: .1; }
.start { display: flex; gap: 1.25rem; padding: 1.75rem; margin-bottom: 1.5rem; border-left: 4px solid var(--blue); }
.start-ico { flex: none; width: 60px; height: 60px; border-radius: 14px; display: grid; place-items: center; background: var(--blue-100); color: var(--blue); }
.isp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.isp { display: block; padding: 1.25rem; color: inherit; text-decoration: none; transition: border-color .15s, box-shadow .15s; border-top: 4px solid var(--navy); }
.isp:hover { border-color: var(--blue); box-shadow: var(--shadow); text-decoration: none; }
.isp h3 { margin: .75rem 0 .2rem; font-size: 1.15rem; }
.isp p { margin: 0; }
.isp-foot { display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; margin-top: 1rem; padding-top: .8rem; border-top: 1px solid var(--line); font-size: .85rem; color: var(--ink-2); }
.isp-foot strong { color: var(--navy); }
.go { margin-left: auto; color: var(--blue); font-weight: 600; display: inline-flex; align-items: center; gap: .25rem; }
.cols { gap: 1.25rem; align-items: start; }
.contact { display: flex; flex-direction: column; gap: .35rem; margin: 0; }
.contact a, .contact span { display: inline-flex; align-items: center; gap: .45rem; }
@media (max-width: 600px) { .start { flex-direction: column; } }
</style>
