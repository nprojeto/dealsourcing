<script setup lang="ts">
interface Notif { id: string; type: string; title: string; body: string | null; link: string | null; created_at: string; read: boolean }
const props = withDefaults(defineProps<{ dark?: boolean; listPath?: string }>(), { dark: false, listPath: '/notificacoes' })
const api = useApi()
const open = ref(false)
const items = ref<Notif[]>([])
const unread = ref(0)
const root = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

async function load() {
  try {
    const r = await api.get<{ items: Notif[]; unread: number }>('/notifications', { limit: 8 })
    items.value = r.items; unread.value = r.unread
  } catch { /* silencioso */ }
}
async function openItem(n: Notif) {
  open.value = false
  if (!n.read) { await api.post('/notifications/read', { ids: [n.id] }).catch(() => {}); load() }
  if (n.link) navigateTo(n.link)
}
async function readAll() {
  await api.post('/notifications/read', { all: true }).catch(() => {})
  load()
}
function onDoc(e: MouseEvent) { if (root.value && !root.value.contains(e.target as Node)) open.value = false }
onMounted(() => { load(); timer = setInterval(load, 60_000); document.addEventListener('click', onDoc) })
onBeforeUnmount(() => { clearInterval(timer); document.removeEventListener('click', onDoc) })
defineExpose({ load })
</script>

<template>
  <div ref="root" class="bell">
    <button class="icon-btn" :class="{ dark: props.dark }" :aria-label="`Notificações (${unread} não lidas)`" @click="open = !open; if (open) load()">
      <AppIcon name="bell" />
      <span v-if="unread" class="count">{{ unread > 9 ? '9+' : unread }}</span>
    </button>
    <Transition name="fade">
      <div v-if="open" class="drop card">
        <div class="drop-head">
          <strong>Notificações</strong>
          <button v-if="unread" class="link-btn" @click="readAll">Marcar todas como lidas</button>
        </div>
        <ul v-if="items.length">
          <li v-for="n in items" :key="n.id" :class="{ unread: !n.read }" @click="openItem(n)">
            <div class="t">{{ n.title }}</div>
            <div v-if="n.body" class="b">{{ n.body }}</div>
            <div class="d">{{ fmtRelative(n.created_at) }}</div>
          </li>
        </ul>
        <div v-else class="none">Nenhuma notificação.</div>
        <NuxtLink class="all" :to="listPath" @click="open = false">Ver todas</NuxtLink>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bell { position: relative; }
.icon-btn.dark { color: #fff; }
.icon-btn.dark:hover { background: rgba(255,255,255,.12); }
.count { position: absolute; top: 4px; right: 3px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 99px; background: var(--danger); color: #fff; font: 700 .68rem/18px var(--font-body); text-align: center; border: 2px solid #fff; }
.drop { position: absolute; right: 0; top: calc(100% + 8px); width: min(360px, calc(100vw - 24px)); z-index: 120; box-shadow: var(--shadow-lg); overflow: hidden; color: var(--ink); }
.drop-head { display: flex; justify-content: space-between; align-items: center; padding: .8rem 1rem; border-bottom: 1px solid var(--line); background: var(--tint); font-size: .9rem; color: var(--navy); }
.link-btn { background: none; border: 0; color: var(--blue); font: 600 .8rem var(--font-body); cursor: pointer; }
ul { list-style: none; margin: 0; padding: 0; max-height: 360px; overflow-y: auto; }
li { padding: .75rem 1rem; border-bottom: 1px solid var(--line); cursor: pointer; }
li:hover { background: var(--tint); }
li.unread { border-left: 3px solid var(--blue); background: #FBFCFF; }
.t { font-weight: 600; font-size: .88rem; color: var(--navy); }
.b { font-size: .83rem; color: var(--ink-2); margin-top: 2px; }
.d { font-size: .75rem; color: var(--muted); margin-top: 4px; }
.none { padding: 1.5rem 1rem; text-align: center; color: var(--muted); font-size: .88rem; }
.all { display: block; text-align: center; padding: .7rem; font-size: .85rem; font-weight: 600; }
</style>
