<script setup lang="ts">
definePageMeta({ layout: 'portal', roles: ['isp_owner', 'parceiro'] })
useHead({ title: 'Início · DealSourcing' })
const { profile } = useAuth()
const pc = usePublicConfig()
onMounted(() => pc.load())
const isIsp = computed(() => profile.value?.role === 'isp_owner')
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
          ? 'Seu cadastro está ativo. Aqui você acompanhará suas avaliações, formalizações de interesse e reuniões com nossa equipe.'
          : 'Seu cadastro de parceiro está ativo. Aqui você acompanhará suas indicações e o andamento de cada uma.' }}</p>
      </div>
    </section>

    <div class="grid-2 cols">
      <article class="card">
        <div class="card-head"><h2>Meus dados</h2><NuxtLink to="/minha-conta" class="btn btn-outline btn-sm">Editar</NuxtLink></div>
        <div class="card-body">
          <dl class="dl">
            <dt>Nome</dt><dd>{{ profile.full_name }}</dd>
            <dt>E-mail</dt><dd>{{ profile.email }}</dd>
            <dt>Telefone</dt><dd>{{ fmtPhone(profile.phone) }}</dd>
            <dt>{{ isIsp ? 'Provedor' : 'Empresa' }}</dt><dd>{{ profile.company_name || '—' }}</dd>
            <dt>CPF/CNPJ</dt><dd>{{ fmtDocument(profile.document) }}</dd>
            <dt>Cadastro desde</dt><dd>{{ fmtDate(profile.created_at) }}</dd>
            <dt>Status</dt><dd><StatusBadge :status="profile.status" /></dd>
          </dl>
        </div>
      </article>

      <article class="card">
        <div class="card-head"><h2>{{ isIsp ? 'Avaliação do provedor' : 'Minhas indicações' }}</h2></div>
        <div class="card-body stack">
          <div class="alert info">
            <AppIcon name="info" :size="18" />
            <span v-if="isIsp">O formulário de avaliação preliminar do seu provedor será liberado nesta área em breve. Você será avisado por e-mail.</span>
            <span v-else>Seu código individual de indicação e o acompanhamento das indicações serão liberados nesta área em breve.</span>
          </div>
          <div v-if="contactEmail || contactPhone">
            <div class="eyebrow">Fale com a NOVALE</div>
            <p class="contact">
              <a v-if="contactEmail" :href="`mailto:${contactEmail}`"><AppIcon name="mail" :size="16" /> {{ contactEmail }}</a>
              <span v-if="contactPhone"><AppIcon name="phone" :size="16" /> {{ fmtPhone(contactPhone) }}</span>
            </p>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.welcome { position: relative; overflow: hidden; border-radius: var(--radius-lg); background: linear-gradient(140deg, var(--navy), var(--navy-900)); color: #D7DEF3; padding: 2rem 2rem; margin-bottom: 1.5rem; }
.w-in { position: relative; z-index: 1; max-width: 680px; }
.welcome h1 { color: #fff; margin-bottom: .4rem; }
.welcome p { margin: 0; }
.eyebrow.light { color: #9FB0E8; }
.w-sphere { position: absolute; right: -60px; top: -60px; opacity: .1; }
.cols { gap: 1.25rem; align-items: start; }
.contact { display: flex; flex-direction: column; gap: .35rem; margin: 0; }
.contact a, .contact span { display: inline-flex; align-items: center; gap: .45rem; }
</style>
