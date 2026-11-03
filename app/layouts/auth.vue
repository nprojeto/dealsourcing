<template>
  <div class="auth">
    <aside class="brand-panel">
      <NuxtLink to="/" class="brand-link" aria-label="Página inicial">
        <BrandLogo variant="branca" :height="40" />
      </NuxtLink>
      <div class="brand-copy">
        <ProductName dark :size="34" class="prod" />
        <div class="eyebrow light">Plataforma de M&amp;A para provedores</div>
        <h2>Avaliação, prospecção e aquisição de ISPs em um só lugar.</h2>
        <ul>
          <li><AppIcon name="shield" :size="18" /> Seus dados protegidos conforme a LGPD</li>
          <li><AppIcon name="lock" :size="18" /> Acesso confirmado por código no e-mail</li>
          <li><AppIcon name="handshake" :size="18" /> Atendimento por equipe especializada</li>
        </ul>
      </div>
      <p class="tagline">Transformando ideias em soluções inteligentes.</p>
      <BrandLogo class="sphere" variant="branca" symbol :height="560" />
    </aside>
    <main class="form-side">
      <div class="mobile-brand"><NuxtLink to="/" class="mb-link"><BrandLogo variant="azul" :height="26" /><span class="sep" /><ProductName :size="17" /></NuxtLink></div>
      <div class="form-box"><slot /></div>
      <footer class="foot">DealSourcing © {{ new Date().getFullYear() }} NOVALE · T8 Soluções Ltda.</footer>
    </main>
  </div>
</template>

<style scoped>
.auth { min-height: 100vh; display: grid; grid-template-columns: minmax(380px, 44%) 1fr; background: #fff; }
.brand-panel {
  position: sticky; top: 0; height: 100vh; overflow: hidden; color: #fff; padding: 2.5rem 3rem;
  background: linear-gradient(160deg, var(--navy) 0%, var(--navy-900) 100%);
  display: flex; flex-direction: column; justify-content: space-between; gap: 2rem;
}
.brand-link { position: relative; z-index: 1; width: fit-content; }
.brand-copy { position: relative; z-index: 1; max-width: 420px; }
.eyebrow.light { color: #9FB0E8; }
.prod { margin-bottom: 1.5rem; }
.mb-link { display: inline-flex; align-items: center; gap: .75rem; text-decoration: none; }
.mb-link .sep { width: 1px; height: 22px; background: var(--line-strong); }
.brand-copy h2 { color: #fff; font-size: 1.85rem; font-weight: 800; line-height: 1.25; margin-bottom: 1.5rem; }
.brand-copy ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .85rem; font-size: .95rem; color: #D7DEF3; }
.brand-copy li { display: flex; gap: .65rem; align-items: center; }
.brand-copy li :deep(svg) { color: #9FB0E8; flex: none; }
.tagline { position: relative; z-index: 1; margin: 0; font-size: .85rem; color: #9FB0E8; }
.sphere { position: absolute; right: -170px; bottom: -150px; opacity: .09; pointer-events: none; }
.form-side { display: flex; flex-direction: column; align-items: center; padding: 2rem 1.25rem; background: var(--bg); }
.mobile-brand { display: none; }
.form-box { width: 100%; max-width: 460px; margin: auto 0; padding: 1rem 0; }
.foot { font-size: .78rem; color: var(--muted); padding-top: 1rem; }
@media (max-width: 900px) {
  .auth { grid-template-columns: 1fr; }
  .brand-panel { display: none; }
  .mobile-brand { display: block; width: 100%; max-width: 460px; padding: .25rem 0 1rem; }
}
</style>
