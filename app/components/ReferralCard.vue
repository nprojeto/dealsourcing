<script setup lang="ts">
interface Referral { code: string | null; link: string | null; link_token?: string | null; stats?: { isps: number; simulations: number; formalizations: number } }
const api = useApi()
const toast = useToast()
const data = ref<Referral | null>(null)
const loading = ref(true)
onMounted(async () => {
  try { data.value = await api.get<Referral>('/me/referral') } catch { data.value = null } finally { loading.value = false }
})
const shareLink = computed(() => {
  if (!data.value?.code) return ''
  if (data.value.link) return data.value.link
  return data.value.link_token ? `${window.location.origin}${useRuntimeConfig().app.baseURL}#/?i=${data.value.link_token}` : ''
})
async function copy(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); toast.success(`${what} copiado.`) }
  catch { toast.warning('Não foi possível copiar. Selecione e copie manualmente.') }
}
</script>

<template>
  <article class="card ref">
    <div class="card-head"><h2>Meu código de indicação</h2></div>
    <div class="card-body">
      <div v-if="loading" class="empty"><span class="spinner" /></div>
      <template v-else-if="data?.code">
        <div class="code-row">
          <span class="code">{{ data.code }}</span>
          <button class="btn btn-outline btn-sm" @click="copy(data.code!, 'Código')"><AppIcon name="file" :size="16" /> Copiar código</button>
        </div>
        <p class="small muted">O provedor pode informar este código no cadastro ou entrar pelo seu link. Pelo link, o código não aparece e a indicação fica travada no cadastro, sem possibilidade de troca.</p>
        <div class="link-row">
          <input class="input small" :value="shareLink" readonly aria-label="Link de indicação" @focus="($event.target as HTMLInputElement).select()">
          <button class="btn btn-sm" @click="copy(shareLink, 'Link')"><AppIcon name="send" :size="16" /> Copiar link</button>
        </div>
        <div v-if="data.stats" class="grid-3 stats">
          <div><strong>{{ data.stats.isps }}</strong><span>provedores</span></div>
          <div><strong>{{ data.stats.simulations }}</strong><span>simulações</span></div>
          <div><strong>{{ data.stats.formalizations }}</strong><span>formalizações</span></div>
        </div>
      </template>
      <p v-else class="muted small">Seu código será gerado assim que o seu acesso estiver ativo.</p>
    </div>
  </article>
</template>

<style scoped>
.code-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: .75rem; }
.code { font: 800 1.6rem var(--font-head); letter-spacing: .12em; color: var(--navy); background: var(--tint); border: 1px dashed var(--line-strong); border-radius: var(--radius); padding: .35rem .9rem; }
.link-row { display: flex; gap: .5rem; }
.link-row .input { min-height: 36px; font-size: .82rem; color: var(--ink-2); }
.stats { margin-top: 1.1rem; gap: .5rem; }
.stats > div { background: var(--tint); border: 1px solid var(--line); border-radius: var(--radius); padding: .6rem; text-align: center; }
.stats strong { display: block; font: 800 1.3rem var(--font-head); color: var(--navy); }
.stats span { font-size: .75rem; color: var(--muted); }
@media (max-width: 600px) { .stats { grid-template-columns: repeat(3, 1fr); } }
</style>
