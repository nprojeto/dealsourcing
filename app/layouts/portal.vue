<script setup lang="ts">
const { profile, signOut } = useAuth()
const menuOpen = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { menuOpen.value = false })
const links = [
  { to: '/portal', label: 'Início', icon: 'home' },
  { to: '/notificacoes', label: 'Notificações', icon: 'bell' },
  { to: '/minha-conta', label: 'Minha conta', icon: 'user' },
]
</script>

<template>
  <div class="portal">
    <header class="top">
      <div class="inner">
        <NuxtLink to="/portal" class="logo"><BrandLogo variant="branca" :height="26" /><span class="sep" /><ProductName dark :size="17" /></NuxtLink>
        <nav class="nav" :class="{ open: menuOpen }">
          <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="nav-link" :class="{ active: route.path === l.to }">
            <AppIcon :name="l.icon" :size="18" /> {{ l.label }}
          </NuxtLink>
          <button class="nav-link" @click="signOut"><AppIcon name="logout" :size="18" /> Sair</button>
        </nav>
        <div class="right">
          <NotificationBell dark />
          <div class="who">
            <span class="avatar">{{ initials(profile?.full_name) }}</span>
            <span class="who-txt">
              <strong>{{ firstName(profile?.full_name) }}</strong>
              <small>{{ profile?.role ? ROLE_LABEL[profile.role] : '' }}</small>
            </span>
          </div>
          <button class="icon-btn burger" aria-label="Menu" @click="menuOpen = !menuOpen"><AppIcon :name="menuOpen ? 'x' : 'menu'" /></button>
        </div>
      </div>
    </header>
    <main class="content"><slot /></main>
    <footer class="foot">
      <BrandLogo variant="azul" :height="20" />
      <span>DealSourcing © {{ new Date().getFullYear() }} NOVALE · T8 Soluções Ltda. · Documento confidencial</span>
    </footer>
  </div>
</template>

<style scoped>
.portal { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); }
.top { background: var(--navy); color: #fff; position: sticky; top: 0; z-index: 50; box-shadow: 0 2px 10px rgba(8,29,66,.25); }
.inner { max-width: 1180px; margin: 0 auto; padding: 0 1.25rem; height: var(--topbar-h); display: flex; align-items: center; gap: 1.5rem; }
.logo { display: inline-flex; align-items: center; gap: .75rem; text-decoration: none; flex: none; }
.logo .sep { width: 1px; height: 22px; background: rgba(255,255,255,.25); }
.nav { display: flex; gap: .25rem; flex: 1; }
.nav-link { display: inline-flex; align-items: center; gap: .45rem; padding: .5rem .8rem; border-radius: var(--radius); color: #C9D3F0; font: 500 .9rem var(--font-body); background: none; border: 0; cursor: pointer; text-decoration: none; }
.nav-link:hover { color: #fff; background: rgba(255,255,255,.08); text-decoration: none; }
.nav-link.active { color: #fff; background: rgba(255,255,255,.12); }
.right { display: flex; align-items: center; gap: .75rem; margin-left: auto; }
.who { display: flex; align-items: center; gap: .55rem; }
.who .avatar { background: rgba(255,255,255,.15); color: #fff; }
.who-txt { display: flex; flex-direction: column; line-height: 1.2; }
.who-txt strong { font-size: .88rem; }
.who-txt small { font-size: .74rem; color: #9FB0E8; }
.burger { display: none; color: #fff; }
.content { flex: 1; width: 100%; max-width: 1180px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
.foot { display: flex; gap: 1rem; align-items: center; justify-content: center; flex-wrap: wrap; padding: 1.25rem; font-size: .78rem; color: var(--muted); border-top: 1px solid var(--line); background: #fff; }
@media (max-width: 820px) {
  .burger { display: inline-grid; }
  .burger:hover { background: rgba(255,255,255,.12); }
  .who-txt { display: none; }
  .logo :deep(img), .logo .sep { display: none; }
  .nav { display: none; position: absolute; top: var(--topbar-h); left: 0; right: 0; flex-direction: column; background: var(--navy-900); padding: .5rem 1rem 1rem; }
  .nav.open { display: flex; }
  .nav-link { padding: .8rem; }
}
</style>
