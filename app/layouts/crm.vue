<script setup lang="ts">
import type { Role } from '~/utils/labels'
const { profile, signOut } = useAuth()
const route = useRoute()
const open = ref(false)
watch(() => route.fullPath, () => { open.value = false })

interface Item { to: string; label: string; icon: string; roles?: Role[] }
const groups: { title: string; items: Item[] }[] = [
  { title: 'Visão geral', items: [
    { to: '/crm', label: 'Painel', icon: 'dashboard' },
    { to: '/crm/desempenho', label: 'Meu desempenho', icon: 'chart' },
    { to: '/notificacoes', label: 'Notificações', icon: 'bell' },
  ] },
  { title: 'Comercial', items: [
    { to: '/crm/oportunidades', label: 'Funil comercial', icon: 'briefcase' },
    { to: '/crm/provedores', label: 'Provedores', icon: 'building' },
    { to: '/crm/simulacoes', label: 'Simulações', icon: 'file', roles: ['admin', 'gestor_comercial'] },
    { to: '/crm/equipe', label: 'Equipe e parceiros', icon: 'handshake', roles: ['admin', 'gestor_comercial'] },
  ] },
  { title: 'Administração', items: [
    { to: '/crm/usuarios', label: 'Usuários e acessos', icon: 'users', roles: ['admin', 'gestor_comercial'] },
    { to: '/crm/simulador', label: 'Parâmetros do simulador', icon: 'dashboard', roles: ['admin'] },
    { to: '/crm/configuracoes', label: 'Configurações', icon: 'settings', roles: ['admin'] },
    { to: '/crm/auditoria', label: 'Auditoria', icon: 'history', roles: ['admin'] },
  ] },
  { title: 'Conta', items: [
    { to: '/minha-conta', label: 'Minha conta', icon: 'user' },
  ] },
]
const visible = computed(() => groups
  .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || (profile.value?.role && i.roles.includes(profile.value.role))) }))
  .filter((g) => g.items.length))
const isActive = (to: string) => (to === '/crm' ? route.path === '/crm' : route.path.startsWith(to))
const title = computed(() => visible.value.flatMap((g) => g.items).find((i) => isActive(i.to))?.label ?? '')
</script>

<template>
  <div class="crm" :class="{ open }">
    <aside class="side">
      <div class="side-brand">
        <NuxtLink to="/crm"><BrandLogo variant="branca" :height="28" /></NuxtLink>
        <ProductName dark :size="19" class="prod" />
        <span class="env">CRM de aquisição de ISPs</span>
      </div>
      <nav class="side-nav">
        <div v-for="g in visible" :key="g.title" class="grp">
          <div class="grp-title">{{ g.title }}</div>
          <NuxtLink v-for="i in g.items" :key="i.to" :to="i.to" class="item" :class="{ active: isActive(i.to) }">
            <AppIcon :name="i.icon" :size="18" /> {{ i.label }}
          </NuxtLink>
        </div>
      </nav>
      <div class="side-user">
        <span class="avatar">{{ initials(profile?.full_name) }}</span>
        <div class="u">
          <strong>{{ profile?.full_name }}</strong>
          <small>{{ profile?.role ? ROLE_LABEL[profile.role] : '' }}</small>
        </div>
        <button class="icon-btn out" aria-label="Sair" title="Sair" @click="signOut"><AppIcon name="logout" :size="18" /></button>
      </div>
      <BrandLogo class="side-sphere" variant="branca" symbol :height="300" />
    </aside>
    <div class="scrim" @click="open = false" />
    <div class="main">
      <header class="topbar">
        <button class="icon-btn burger" aria-label="Abrir menu" @click="open = true"><AppIcon name="menu" /></button>
        <div class="crumb"><span class="crumb-app">DealSourcing</span><AppIcon name="chevron-right" :size="14" />{{ title }}</div>
        <div class="row" style="margin-left:auto">
          <NotificationBell />
        </div>
      </header>
      <main class="content"><slot /></main>
    </div>
  </div>
</template>

<style scoped>
.crm { min-height: 100vh; background: var(--bg); }
.side {
  position: fixed; inset: 0 auto 0 0; width: var(--sidebar-w); z-index: 80; color: #fff; overflow: hidden;
  background: linear-gradient(180deg, var(--navy) 0%, var(--navy-900) 100%);
  display: flex; flex-direction: column;
}
.side-brand { padding: 1.25rem 1.25rem 1rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.prod { display: flex; margin-top: .9rem; }
.env { display: block; margin-top: .35rem; font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; color: #8FA2DE; font-weight: 600; }
.side-nav { flex: 1; overflow-y: auto; padding: .75rem .75rem; position: relative; z-index: 1; }
.grp + .grp { margin-top: 1rem; }
.grp-title { font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; color: #6F84C6; font-weight: 700; padding: .35rem .6rem; }
.item { display: flex; align-items: center; gap: .7rem; padding: .6rem .7rem; border-radius: var(--radius); color: #C9D3F0; font-size: .9rem; font-weight: 500; text-decoration: none; position: relative; }
.item:hover { background: rgba(255,255,255,.07); color: #fff; text-decoration: none; }
.item.active { background: rgba(255,255,255,.12); color: #fff; }
.item.active::before { content: ''; position: absolute; left: -.75rem; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: #8FA2DE; }
.side-user { position: relative; z-index: 1; display: flex; align-items: center; gap: .6rem; padding: .9rem 1rem; border-top: 1px solid rgba(255,255,255,.08); background: rgba(0,0,0,.12); }
.side-user .avatar { background: rgba(255,255,255,.15); color: #fff; }
.u { min-width: 0; flex: 1; line-height: 1.25; }
.u strong { display: block; font-size: .85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.u small { font-size: .74rem; color: #8FA2DE; }
.out { color: #C9D3F0; }
.out:hover { background: rgba(255,255,255,.1); color: #fff; }
.side-sphere { position: absolute; bottom: 40px; right: -120px; opacity: .06; pointer-events: none; }
.main { margin-left: var(--sidebar-w); min-height: 100vh; display: flex; flex-direction: column; }
.topbar { position: sticky; top: 0; z-index: 40; height: var(--topbar-h); display: flex; align-items: center; gap: .75rem; padding: 0 1.5rem; background: rgba(255,255,255,.92); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.crumb { display: flex; align-items: center; gap: .4rem; font: 700 .95rem var(--font-head); color: var(--navy); }
.crumb-app { color: var(--muted); font-weight: 600; }
.crumb :deep(svg) { color: var(--line-strong); }
@media (max-width: 600px) { .crumb-app, .crumb :deep(svg) { display: none; } }
.burger { display: none; }
.content { flex: 1; padding: 1.75rem 1.5rem 3rem; width: 100%; max-width: 1320px; }
.scrim { display: none; }
@media (max-width: 960px) {
  .side { transform: translateX(-100%); transition: transform .2s ease; box-shadow: var(--shadow-lg); }
  .crm.open .side { transform: none; }
  .crm.open .scrim { display: block; position: fixed; inset: 0; z-index: 70; background: rgba(8,29,66,.45); }
  .main { margin-left: 0; }
  .burger { display: inline-grid; }
  .content { padding: 1.25rem 1rem 2.5rem; }
  .topbar { padding: 0 .75rem; }
}
</style>
