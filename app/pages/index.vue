<script setup lang="ts">
definePageMeta({ access: 'public' })
useHead({ title: 'DealSourcing · Avaliação e aquisição de provedores de internet | NOVALE' })

const pc = usePublicConfig()
const auth = useAuth()
const route = useRoute()
const api = useApi()
const router = useRouter()
onMounted(async () => {
  pc.load(); auth.init()
  // Link de indicação (?i=CHAVE): guarda a chave para o cadastro do provedor. O código não aparece no link nem na tela.
  const token = String(route.query.i ?? '').trim().toLowerCase()
  const legacy = String(route.query.ref ?? '').trim().toUpperCase()   // links antigos (?ref=CÓDIGO)
  if (token || legacy) router.replace({ query: {} })                  // tira a chave da barra de endereço
  if (/^[a-f0-9]{32}$/.test(token)) {
    try {
      const r = await api.get<{ valid: boolean; owner_first_name?: string | null }>('/public/referral-link', { i: token })
      if (r.valid) {
        try { localStorage.setItem('ds_ref_token', token); localStorage.removeItem('ds_ref') } catch { /* ignora */ }
        refNote.value = r.owner_first_name ? `Você chegou pela indicação de ${r.owner_first_name}` : 'Você chegou por uma indicação'
      }
    } catch { /* segue sem indicação */ }
  } else if (/^[A-Z0-9-]{4,20}$/.test(legacy)) {
    try { localStorage.setItem('ds_ref', legacy); localStorage.removeItem('ds_ref_token') } catch { /* ignora */ }
    refNote.value = 'Você chegou por uma indicação'
  }
})
const refNote = ref('')

const ispOn = computed(() => pc.setting('signup_isp_enabled', true))
const partnerOn = computed(() => pc.setting('signup_partner_enabled', true))
const employeeOn = computed(() => pc.setting('signup_employee_enabled', true))
const contactEmail = computed(() => pc.setting('contact_email', ''))
const contactPhone = computed(() => pc.setting('contact_phone', ''))
const legalOpen = ref<'terms' | 'privacy' | null>(null)
const loggedHome = computed(() => (auth.profile.value ? auth.nextRoute() : ''))

const steps = [
  { n: '01', t: 'Cadastre seu provedor', d: 'Crie sua conta e confirme o e-mail com o código que enviamos. O acesso é individual e protegido.' },
  { n: '02', t: 'Informe os dados da operação', d: 'Base de clientes, região, regularização, posteamento, equipe e ARPU — de forma simples e confidencial.' },
  { n: '03', t: 'Fale com nossa equipe', d: 'Ao formalizar interesse, um especialista entra em contato para conduzir as próximas etapas.' },
]
</script>

<template>
  <div class="landing">
    <header class="hdr">
      <div class="wrap hdr-in">
        <div class="brandset">
          <BrandLogo variant="azul" :height="30" />
          <span class="sep" />
          <ProductName :size="19" />
        </div>
        <nav class="row">
          <a href="#como-funciona" class="lnk">Como funciona</a>
          <a v-if="partnerOn" href="#parceiros" class="lnk">Parceiros</a>
          <NuxtLink v-if="loggedHome" :to="loggedHome" class="btn btn-sm">Acessar painel</NuxtLink>
          <NuxtLink v-else to="/entrar" class="btn btn-sm btn-outline">Entrar</NuxtLink>
        </nav>
      </div>
    </header>

    <section class="hero">
      <BrandLogo class="hero-sphere" variant="branca" symbol :height="720" />
      <div class="wrap hero-in">
        <ProductName dark :size="22" class="hero-product" />
        <div v-if="refNote" class="ref-note"><AppIcon name="handshake" :size="16" /> {{ refNote }}</div>
        <div class="eyebrow light">M&amp;A para provedores regionais de internet</div>
        <h1>Seu provedor tem valor.<br>Descubra o caminho para uma aquisição segura.</h1>
        <p class="lead">O DealSourcing, da NOVALE, conecta proprietários de ISPs a um processo estruturado de avaliação, negociação e aquisição — com sigilo, método e acompanhamento especializado.</p>
        <div class="row">
          <NuxtLink v-if="ispOn" to="/cadastro?perfil=isp_owner" class="btn btn-white btn-lg">
            Cadastrar meu provedor <AppIcon name="arrow-right" :size="18" />
          </NuxtLink>
          <NuxtLink to="/entrar" class="btn btn-on-navy btn-lg">Já tenho cadastro</NuxtLink>
        </div>
        <ul class="trust">
          <li><AppIcon name="shield" :size="18" /> Informações tratadas conforme a LGPD</li>
          <li><AppIcon name="lock" :size="18" /> Avaliações internas e confidenciais</li>
          <li><AppIcon name="handshake" :size="18" /> Atendimento dedicado</li>
        </ul>
      </div>
    </section>

    <section id="como-funciona" class="sec">
      <div class="wrap">
        <div class="eyebrow">Como funciona</div>
        <h2 class="sec-title">Um processo claro, do primeiro contato à conclusão</h2>
        <div class="grid-3 steps">
          <article v-for="s in steps" :key="s.n" class="card step">
            <span class="num">{{ s.n }}</span>
            <h3>{{ s.t }}</h3>
            <p class="muted">{{ s.d }}</p>
          </article>
        </div>
      </div>
    </section>

    <section v-if="partnerOn || employeeOn" id="parceiros" class="sec alt">
      <div class="wrap grid-2 cta-grid">
        <article v-if="partnerOn" class="card cta">
          <div class="cta-ico"><AppIcon name="handshake" :size="26" /></div>
          <div>
            <h3>Seja um parceiro indicador</h3>
            <p class="muted">Conhece provedores que podem se interessar por uma aquisição? Cadastre-se, aguarde a aprovação e receba seu código individual de indicação.</p>
            <NuxtLink to="/cadastro?perfil=parceiro" class="btn btn-navy">Quero ser parceiro</NuxtLink>
          </div>
        </article>
        <article v-if="employeeOn" class="card cta">
          <div class="cta-ico"><AppIcon name="briefcase" :size="26" /></div>
          <div>
            <h3>Equipe comercial NOVALE</h3>
            <p class="muted">Colaboradores internos solicitam acesso aqui. O cadastro é liberado após aprovação do administrador.</p>
            <NuxtLink to="/cadastro?perfil=colaborador" class="btn btn-outline">Solicitar acesso da equipe</NuxtLink>
          </div>
        </article>
      </div>
    </section>

    <footer class="ftr">
      <div class="wrap ftr-in">
        <div>
          <ProductName dark :size="26" />
          <p class="ftr-about">Plataforma de prospecção, avaliação e aquisição de provedores de internet.</p>
          <BrandLogo variant="branca" tagline :height="38" />
        </div>
        <div class="ftr-col">
          <strong>Contato</strong>
          <a v-if="contactEmail" :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>
          <span v-if="contactPhone">{{ fmtPhone(String(contactPhone)) }}</span>
          <span>São José dos Campos · SP</span>
        </div>
        <div class="ftr-col">
          <strong>Privacidade</strong>
          <button class="ftr-link" @click="legalOpen = 'terms'">Termos de Uso</button>
          <button class="ftr-link" @click="legalOpen = 'privacy'">Aviso de Privacidade</button>
        </div>
      </div>
      <div class="wrap copy">DealSourcing © {{ new Date().getFullYear() }} NOVALE · T8 Soluções Ltda. · CNPJ 43.530.033/0001-56</div>
    </footer>
    <LegalModal :kind="legalOpen" @close="legalOpen = null" />
  </div>
</template>

<style scoped>
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 1.25rem; }
.hdr { position: sticky; top: 0; z-index: 30; background: rgba(255,255,255,.95); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.brandset { display: flex; align-items: center; gap: .9rem; }
.brandset .sep { width: 1px; height: 28px; background: var(--line-strong); }
.hero-product { margin-bottom: 1.4rem; }
.ref-note { display: inline-flex; align-items: center; gap: .45rem; margin-bottom: 1.2rem; padding: .4rem .8rem; border-radius: 99px; background: rgba(255,255,255,.1); color: #D7DEF3; font-size: .85rem; }
.ftr-about { font-size: .88rem; color: #9FB0E8; margin: .6rem 0 1.25rem; max-width: 320px; }
.hdr-in { height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.lnk { color: var(--ink-2); font-size: .9rem; padding: .4rem .6rem; }
.hero { position: relative; overflow: hidden; color: #fff; background: linear-gradient(150deg, var(--navy) 0%, var(--navy-900) 70%); }
.hero-in { position: relative; z-index: 1; padding: 5.5rem 1.25rem 5rem; max-width: 1180px; }
.hero h1 { color: #fff; font-size: clamp(1.9rem, 4.2vw, 3rem); font-weight: 800; max-width: 760px; margin-bottom: 1.1rem; }
.lead { font-size: 1.1rem; color: #CFD8F2; max-width: 620px; margin-bottom: 2rem; }
.eyebrow.light { color: #9FB0E8; }
.trust { list-style: none; padding: 0; margin: 2.5rem 0 0; display: flex; gap: 1.75rem; flex-wrap: wrap; color: #C9D3F0; font-size: .9rem; }
.trust li { display: flex; gap: .5rem; align-items: center; }
.trust :deep(svg) { color: #8FA2DE; }
.hero-sphere { position: absolute; right: -160px; top: -40px; opacity: .1; pointer-events: none; }
.sec { padding: 4.5rem 0; }
.sec.alt { background: var(--tint); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.sec-title { font-size: clamp(1.4rem, 2.6vw, 1.9rem); font-weight: 800; max-width: 640px; margin-bottom: 2rem; }
.step { padding: 1.6rem; border-top: 4px solid var(--navy); }
.num { font: 800 2rem var(--font-head); color: var(--blue-100); -webkit-text-stroke: 1px var(--blue); display: block; margin-bottom: .6rem; }
.cta-grid { gap: 1.25rem; }
.cta { display: flex; gap: 1.1rem; padding: 1.6rem; }
.cta-ico { flex: none; width: 52px; height: 52px; border-radius: 12px; display: grid; place-items: center; background: var(--navy); color: #fff; }
.ftr { background: var(--navy-900); color: #C9D3F0; padding: 3rem 0 1.5rem; }
.ftr-in { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 2rem; }
.ftr-col { display: flex; flex-direction: column; gap: .4rem; font-size: .88rem; }
.ftr-col strong { color: #fff; font-family: var(--font-head); margin-bottom: .3rem; }
.ftr-col a, .ftr-link { color: #C9D3F0; background: none; border: 0; padding: 0; text-align: left; font: inherit; cursor: pointer; }
.ftr-col a:hover, .ftr-link:hover { color: #fff; text-decoration: underline; }
.copy { margin-top: 2.5rem; padding-top: 1.25rem; border-top: 1px solid rgba(255,255,255,.08); font-size: .78rem; color: #7F8FBF; }
@media (max-width: 720px) {
  .lnk { display: none; }
  .brandset :deep(img) { height: 22px !important; }
  .brandset .sep { height: 22px; }
  .hero-in { padding: 3.5rem 1.25rem; }
  .ftr-in { grid-template-columns: 1fr; }
  .cta { flex-direction: column; }
}
</style>
