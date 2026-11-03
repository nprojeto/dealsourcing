<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Notificações · DealSourcing' })

interface Notif { id: string; type: string; title: string; body: string | null; link: string | null; created_at: string; read: boolean }
const auth = useAuth()
const api = useApi()
const toast = useToast()
const layout = computed(() => (auth.isInternal.value ? 'crm' : 'portal'))
const items = ref<Notif[]>([])
const unread = ref(0)
const loading = ref(true)
const onlyUnread = ref(false)
const shown = computed(() => (onlyUnread.value ? items.value.filter((n) => !n.read) : items.value))

async function load() {
  loading.value = true
  try { const r = await api.get<{ items: Notif[]; unread: number }>('/notifications', { limit: 100 }); items.value = r.items; unread.value = r.unread }
  catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
}
async function readAll() { await api.post('/notifications/read', { all: true }).catch(() => {}); load() }
async function open(n: Notif) {
  if (!n.read) { await api.post('/notifications/read', { ids: [n.id] }).catch(() => {}); n.read = true; unread.value = Math.max(0, unread.value - 1) }
  if (n.link) navigateTo(n.link)
}
onMounted(load)
</script>

<template>
  <NuxtLayout :name="layout">
    <div class="page-head">
      <div><div class="eyebrow">Central</div><h1>Notificações</h1><p>{{ unread }} não lida(s)</p></div>
      <div class="row">
        <label class="switch"><input v-model="onlyUnread" type="checkbox"><span class="track" /><span class="small">Somente não lidas</span></label>
        <button class="btn btn-outline btn-sm" :disabled="!unread" @click="readAll"><AppIcon name="check" :size="16" /> Marcar todas como lidas</button>
      </div>
    </div>
    <div class="card">
      <div v-if="loading" class="empty"><span class="spinner" /></div>
      <div v-else-if="!shown.length" class="empty"><BrandLogo symbol :height="56" />Nenhuma notificação.</div>
      <ul v-else class="list">
        <li v-for="n in shown" :key="n.id" :class="{ unread: !n.read, link: !!n.link }" @click="open(n)">
          <span class="dot" />
          <div class="grow">
            <div class="t">{{ n.title }}</div>
            <div v-if="n.body" class="b">{{ n.body }}</div>
          </div>
          <span class="d" :title="fmtDateTime(n.created_at)">{{ fmtRelative(n.created_at) }}</span>
        </li>
      </ul>
    </div>
  </NuxtLayout>
</template>

<style scoped>
.list { list-style: none; margin: 0; padding: 0; }
.list li { display: flex; gap: .9rem; align-items: flex-start; padding: 1rem 1.25rem; border-top: 1px solid var(--line); }
.list li:first-child { border-top: 0; }
.list li.link { cursor: pointer; }
.list li:hover { background: var(--tint); }
.dot { width: 9px; height: 9px; border-radius: 50%; margin-top: .45rem; background: transparent; flex: none; }
.unread .dot { background: var(--blue); }
.t { font-weight: 600; color: var(--navy); }
.unread .t { font-weight: 700; }
.b { color: var(--ink-2); font-size: .9rem; margin-top: 2px; }
.d { font-size: .8rem; color: var(--muted); white-space: nowrap; }
</style>
