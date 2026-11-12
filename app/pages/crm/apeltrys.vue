<script setup lang="ts">
/**
 * Apeltrys Analytical Map — estratégia de abordagem de ISPs.
 * Somente admin e gestão. Os dados (com contatos de sócios, LGPD) vêm da API
 * protegida e são entregues ao mapa (iframe da mesma origem) por postMessage.
 */
definePageMeta({ layout: 'crm', roles: ['admin', 'gestor_comercial'], wide: true })
useHead({ title: 'Apeltrys Analytical Map · DealSourcing' })

interface Dataset { id: string; version: string; generated_at: string | null; isp_count: number; activated_at: string; uploaded_by: string | null; stats: Record<string, number> }
interface AmapResp { dataset: Dataset | null; data: Record<string, unknown> | null; params: Record<string, unknown>; funnel: Record<string, unknown>; stages: unknown[]; params_updated_at: string | null; params_updated_by: string | null }
interface SendReq { mode: 'one' | 'bulk'; items: { amap_key: string; tier: string; name: string }[]; by_tier: Record<string, number>; total: number }
interface SendResp { created: { opportunity_id: string }[]; skipped: unknown[]; unknown: string[]; funnel: Record<string, unknown> }

const api = useApi()
const toast = useToast()
const router = useRouter()
const base = useRuntimeConfig().app.baseURL.replace(/\/?$/, '/')
const src = `${base}apeltrys/index.html`

const loading = ref(true)
const loadError = ref('')
const resp = ref<AmapResp | null>(null)
const frame = ref<HTMLIFrameElement | null>(null)
const frameKey = ref(0)

async function load() {
  loading.value = true; loadError.value = ''
  try { resp.value = await api.get<AmapResp>('/amap') } catch (e) { loadError.value = errorMessage(e) } finally { loading.value = false }
}
onMounted(load)

// ---------- comunicação com o mapa ----------
function post(type: string, payload: unknown) {
  frame.value?.contentWindow?.postMessage({ type, payload: JSON.parse(JSON.stringify(payload)) }, location.origin)
}
let paramsBusy: Promise<unknown> = Promise.resolve()
async function onMessage(ev: MessageEvent) {
  if (ev.origin !== location.origin || !frame.value || ev.source !== frame.value.contentWindow) return
  const { type, payload } = (ev.data ?? {}) as { type?: string; payload?: unknown }
  if (type === 'amap:ready' && resp.value?.data) {
    post('amap:init', { data: resp.value.data, params: resp.value.params, funnel: resp.value.funnel, stages: resp.value.stages })
  } else if (type === 'amap:params') {
    paramsBusy = paramsBusy.then(async () => {
      try { await api.put('/amap/params', { params: payload }); post('amap:saved', {}) } catch (e) { post('amap:saved', { error: `Não salvou: ${errorMessage(e)}` }) }
    })
  } else if (type === 'amap:send') {
    sendReq.value = payload as SendReq
  } else if (type === 'amap:open') {
    const id = (payload as { opportunity_id?: string })?.opportunity_id
    if (id) router.push({ path: '/crm/oportunidades', query: { id } })
  }
}
onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

// ---------- envio ao funil ----------
const sendReq = ref<SendReq | null>(null)
const sending = ref(false)
const TIERS = ['Tier 1', 'Tier 2', 'Tier 3', 'Sem comprador']
async function confirmSend() {
  if (!sendReq.value) return
  sending.value = true
  try {
    const r = await api.post<SendResp>('/amap/send', { items: sendReq.value.items })
    post('amap:funnel', r.funnel)
    if (resp.value) resp.value.funnel = r.funnel
    const c = r.created.length, s = r.skipped.length
    if (c) toast.success(`${c} ISP(s) enviados para a etapa 1, na fila de atendimento.${s ? ` ${s} já estavam no funil.` : ''}`)
    else toast.info(s ? `Nenhum enviado: ${s} já estava(m) no funil.` : 'Nenhum ISP enviado.')
    sendReq.value = null
  } catch (e) { toast.error(errorMessage(e)) } finally { sending.value = false }
}

// ---------- importação da base ----------
const showUpload = ref(false)
const upFile = ref<File | null>(null)
const upError = ref('')
const upProgress = ref(0)
const upBusy = ref(false)
const upInfo = ref<{ isps: number; mun: number; versao: string } | null>(null)
let parsed: { base: Record<string, unknown>; isps: unknown[][] } | null = null

type Raw = { municipios?: Record<string, { municipio: string; uf: string; cep_cod: string; vizinhos: number[]; centroide: number[] }>; compradores?: Record<string, unknown>;
  isps?: Record<string, unknown>[]; excluidos_padrao_idx?: number[]; versao?: string; gerado_em?: string }
function toCompact(text: string) {
  // aceita o dados.json (pasta dados/) ou o data.js (pasta web/data/) gerados pelo build do pacote
  if (/^\s*(\/\*|var\s+DATA)/.test(text)) {
    const line = text.split('\n').find((l) => l.startsWith('var DATA'))
    if (!line) throw new Error('fmt')
    const d = JSON.parse(line.slice(line.indexOf('=') + 1).trim().replace(/;$/, ''))
    return { base: { mun: d.mun, nio: d.nio, zaaz: d.zaaz, alares: d.alares, alaresTotUF: d.alaresTotUF, excl_padrao: d.excl_padrao ?? [], versao: d.versao, gerado_em: d.gerado_em }, isps: d.isps as unknown[][] }
  }
  const d = JSON.parse(text) as Raw
  if (!d.municipios || !d.compradores || !Array.isArray(d.isps)) throw new Error('fmt')
  const mun: Record<string, unknown[]> = {}
  for (const [k, v] of Object.entries(d.municipios)) mun[k] = [v.municipio, v.uf, v.cep_cod, v.vizinhos, v.centroide]
  const c = d.compradores as Record<string, unknown>
  const isps = d.isps.map((s) => [s.nome, s.razao_social, s.cnpj, s.assinantes_max, s.mensal, s.tendencia_mes, s.flag_col_O, s.porte, s.uf_sede, s.cidade_sede, s.ibge_sede, s.socio1, s.socio2, s.status, s.quem])
  return { base: { mun, nio: c.nio, zaaz: c.zaaz_sky, alares: c.alares, alaresTotUF: c.alares_totais_planilha, excl_padrao: d.excluidos_padrao_idx ?? [], versao: d.versao, gerado_em: d.gerado_em }, isps }
}
async function pickFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  upFile.value = f; upError.value = ''; upInfo.value = null; parsed = null; upProgress.value = 0
  if (!f) return
  try {
    parsed = toCompact(await f.text())
    upInfo.value = { isps: parsed.isps.length, mun: Object.keys(parsed.base.mun as object).length, versao: String(parsed.base.versao ?? '') }
  } catch { upError.value = 'Arquivo não reconhecido. Use o dados.json (pasta dados) do pacote do mapa.' }
}
async function doUpload() {
  if (!parsed) return
  upBusy.value = true; upError.value = ''; upProgress.value = 0
  const SIZE = 1000
  const chunks = Math.ceil(parsed.isps.length / SIZE)
  try {
    const st = await api.post<{ id: string }>('/amap/dataset', { version: parsed.base.versao, generated_at: parsed.base.gerado_em, base: parsed.base, isp_count: parsed.isps.length, chunks })
    for (let i = 0; i < chunks; i++) {
      await api.post(`/amap/dataset/${st.id}/chunk/${i}`, { rows: parsed.isps.slice(i * SIZE, (i + 1) * SIZE) })
      upProgress.value = Math.round(((i + 1) / (chunks + 1)) * 100)
    }
    await api.post(`/amap/dataset/${st.id}/finish`)
    upProgress.value = 100
    toast.success('Base do mapa atualizada.')
    showUpload.value = false; upFile.value = null; parsed = null; upInfo.value = null
    await load(); frameKey.value++
  } catch (e) { upError.value = errorMessage(e) } finally { upBusy.value = false }
}
</script>

<template>
  <div class="amap">
    <div class="topline">
      <div class="ttl">
        <span class="ic"><AppIcon name="map" :size="18" /></span>
        <div>
          <strong>Apeltrys Analytical Map</strong>
          <small v-if="resp?.dataset">Base {{ resp.dataset.version }} · {{ fmtInt(resp.dataset.isp_count) }} ISPs · importada {{ fmtDateTime(resp.dataset.activated_at) }}<template v-if="resp.dataset.uploaded_by"> por {{ resp.dataset.uploaded_by }}</template></small>
          <small v-else>Estratégia de abordagem: daqui saem os ISPs da etapa 1 do funil</small>
        </div>
      </div>
      <div class="acts">
        <span class="lock small muted"><AppIcon name="lock" :size="14" /> Admin e gestão</span>
        <NuxtLink to="/crm/oportunidades?visao=fila" class="btn btn-sm btn-outline">Fila do funil</NuxtLink>
        <button class="btn btn-sm btn-navy" @click="showUpload = true"><AppIcon name="refresh" :size="15" /> {{ resp?.dataset ? 'Atualizar base' : 'Importar base' }}</button>
      </div>
    </div>

    <div v-if="loading" class="state"><span class="spinner" /> Carregando a base…</div>
    <div v-else-if="loadError" class="state"><p class="error">{{ loadError }}</p><button class="btn btn-sm" @click="load">Tentar de novo</button></div>
    <div v-else-if="!resp?.dataset" class="state">
      <div class="card empty">
        <span class="big"><AppIcon name="map" :size="30" /></span>
        <h2>Importe a base do mapa</h2>
        <p class="muted">Envie o arquivo <b>dados.json</b> (pasta <i>dados</i> do pacote Apeltrys). A base fica guardada no servidor, só para admin e gestão.</p>
        <button class="btn btn-navy" @click="showUpload = true">Importar base</button>
      </div>
    </div>
    <iframe v-else :key="frameKey" ref="frame" :src="src" class="frame" title="Apeltrys Analytical Map" />

    <!-- confirmação de envio -->
    <AppModal :open="!!sendReq" title="Enviar ao funil" :width="480" @close="sendReq = null">
      <template v-if="sendReq">
        <p v-if="sendReq.mode === 'one'" style="margin-top:0"><b>{{ sendReq.items[0]?.name }}</b> ({{ sendReq.items[0]?.tier }}) vai para a <b>etapa 1 — ISP identificado</b>.</p>
        <template v-else>
          <p style="margin-top:0"><b>{{ fmtInt(sendReq.items.length) }} ISPs</b> vão para a <b>etapa 1 — ISP identificado</b>.</p>
          <div class="tiers">
            <div v-for="t in TIERS.filter((x) => sendReq!.by_tier[x])" :key="t"><span>{{ t }}</span><b>{{ fmtInt(sendReq.by_tier[t]) }}</b></div>
          </div>
          <p v-if="sendReq.total > sendReq.items.length" class="small warn">Limite de 3.000 por envio: os demais ficam para o próximo envio.</p>
        </template>
        <ul class="small muted rules">
          <li>Entram na <b>fila de atendimento</b>, sem responsável.</li>
          <li>Levam tier, compradores, assinantes e os contatos dos sócios.</li>
          <li>Quem já está no funil não é duplicado.</li>
        </ul>
      </template>
      <template #footer>
        <button class="btn btn-ghost" :disabled="sending" @click="sendReq = null">Cancelar</button>
        <button class="btn" :disabled="sending" @click="confirmSend"><span v-if="sending" class="spinner" /> Enviar</button>
      </template>
    </AppModal>

    <!-- importação -->
    <AppModal :open="showUpload" title="Importar base do mapa" :width="520" @close="!upBusy && (showUpload = false)">
      <p style="margin-top:0" class="small">Selecione o <b>dados.json</b> gerado pelo pacote Apeltrys (pasta <i>dados</i>). A base atual é substituída; parâmetros e o funil continuam como estão.</p>
      <input type="file" accept=".json,.js,application/json" :disabled="upBusy" @change="pickFile">
      <div v-if="upInfo" class="info small">Versão <b>{{ upInfo.versao || '—' }}</b> · {{ fmtInt(upInfo.isps) }} ISPs · {{ fmtInt(upInfo.mun) }} municípios</div>
      <div v-if="upBusy || upProgress" class="prog"><div :style="{ width: `${upProgress}%` }" /></div>
      <p v-if="upError" class="error">{{ upError }}</p>
      <p class="small muted" style="margin-bottom:0"><AppIcon name="lock" :size="13" /> Contém dados pessoais de sócios (LGPD): fica só no servidor, visível para admin e gestão. Não publique este arquivo no GitHub.</p>
      <template #footer>
        <button class="btn btn-ghost" :disabled="upBusy" @click="showUpload = false">Cancelar</button>
        <button class="btn btn-navy" :disabled="!upInfo || upBusy" @click="doUpload"><span v-if="upBusy" class="spinner" /> Importar</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.amap { display: flex; flex-direction: column; height: calc(100vh - var(--topbar-h)); height: calc(100dvh - var(--topbar-h)); min-height: 520px; overflow: hidden; }
.topline { flex: none; display: flex; align-items: center; justify-content: space-between; gap: .8rem 1rem; flex-wrap: wrap; padding: .6rem 1rem; background: #fff; border-bottom: 1px solid var(--line); }
.ttl { display: flex; align-items: center; gap: .7rem; min-width: 0; }
.ttl strong { display: block; font: 700 1rem var(--font-head); color: var(--navy); }
.ttl small { display: block; color: var(--muted); font-size: .78rem; }
.ic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: var(--blue-100); color: var(--blue); flex: none; }
.acts { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.lock { display: inline-flex; align-items: center; gap: .3rem; margin-right: .3rem; }
.frame { flex: 1; min-height: 0; width: 100%; border: 0; display: block; background: #f3f5fa; }
.state { flex: 1; display: grid; place-items: center; align-content: center; gap: .8rem; padding: 2rem 1rem; color: var(--muted); }
.empty { max-width: 520px; padding: 2rem; text-align: center; display: grid; gap: .7rem; justify-items: center; }
.empty h2 { margin: 0; }
.empty p { margin: 0; }
.big { width: 60px; height: 60px; border-radius: 16px; display: grid; place-items: center; background: var(--blue-100); color: var(--blue); }
.tiers { display: grid; gap: .3rem; padding: .7rem .9rem; border-radius: var(--radius); background: var(--tint); }
.tiers div { display: flex; justify-content: space-between; }
.rules { padding-left: 1.1rem; margin: .9rem 0 0; display: grid; gap: .2rem; }
.warn { color: #8a5a00; }
.info { margin-top: .7rem; padding: .55rem .8rem; border-radius: var(--radius); background: var(--tint); }
.prog { height: 8px; border-radius: 99px; background: var(--line); overflow: hidden; margin-top: .8rem; }
.prog div { height: 100%; background: var(--blue); transition: width .3s; }
@media (max-width: 600px) { .lock { display: none; } .topline { padding: .5rem .75rem; } }
</style>
