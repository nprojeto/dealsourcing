<script setup lang="ts">
definePageMeta({ layout: 'portal', roles: ['parceiro', 'admin', 'gestor_comercial'] })
useHead({ title: 'Como funciona sua comissão · DealSourcing' })

interface Crit { key: string; title: string; weight: number; phase: number; help: string | null; level_low: string; level_mid: string; level_high: string }
interface Band { min_points: number; max_points: number; percent: number; label: string; description: string | null }
interface FeeAdj { max_fee: number; points: number; label: string; description: string | null }
interface Guide { active: boolean; criteria: Crit[]; bands: Band[]; fee_adjustments: FeeAdj[]; payment_days: number | null; payment_terms: string | null }

const api = useApi()
const toast = useToast()
const { profile } = useAuth()
const g = ref<Guide | null>(null)
const loading = ref(true)
onMounted(async () => {
  try { g.value = await api.get<Guide>('/commission-guide') }
  catch (e) { toast.error(errorMessage(e)) } finally { loading.value = false }
})

const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const pts = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const minPct = computed(() => g.value?.bands.length ? Math.min(...g.value.bands.map(b => b.percent)) : 0)
const maxPct = computed(() => g.value?.bands.length ? Math.max(...g.value.bands.map(b => b.percent)) : 0)
const phase1 = computed(() => (g.value?.criteria ?? []).filter(c => c.phase === 1))
const phase2 = computed(() => (g.value?.criteria ?? []).filter(c => c.phase === 2))
const numsOf = (list: Crit[]) => {
  const n = list.map(c => (g.value!.criteria.indexOf(c) + 1))
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} e ${n.at(-1)}` : String(n[0] ?? '')
}
function bandRange(b: Band, i: number) { return i === 0 ? `de ${pts(b.min_points)} a ${pts(b.max_points)} pts` : `acima de ${pts(b.min_points)} até ${pts(b.max_points)} pts` }
const open = ref<string | null>(null)

// Simulador
type Lv = 'baixo' | 'medio' | 'alto'
const sim = reactive<Record<string, Lv | ''>>({})
const LV: { k: Lv; t: string }[] = [{ k: 'baixo', t: 'Baixo' }, { k: 'medio', t: 'Médio' }, { k: 'alto', t: 'Alto' }]
const lvPts = (c: Crit, k: Lv) => k === 'alto' ? c.weight : k === 'medio' ? c.weight / 2 : 0
const simBase = computed(() => (g.value?.criteria ?? []).reduce((s, c) => s + (sim[c.key] ? lvPts(c, sim[c.key] as Lv) : 0), 0))
const fees = computed(() => g.value?.fee_adjustments ?? [])
const simFee = ref(-1)
watch(fees, (f) => { if (simFee.value < 0) simFee.value = Math.max(0, f.findIndex(x => Number(x.points) === 0)) }, { immediate: true })
const simAdj = computed(() => Number(fees.value[simFee.value]?.points ?? 0))
const maxPts = computed(() => g.value?.bands.length ? Math.max(...g.value.bands.map(b => b.max_points)) : 100)
const simTotal = computed(() => Math.max(0, Math.min(maxPts.value, simBase.value + simAdj.value)))
const fmtFee = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const feeRange = (i: number) => {
  const f = fees.value[i]; if (!f) return ''
  if (i === 0) return `Até ${fmtFee(f.max_fee)}`
  const prev = fees.value[i - 1].max_fee
  return f.max_fee >= 100 ? `Acima de ${fmtFee(prev)}` : `De ${fmtFee(prev + 0.01)} a ${fmtFee(f.max_fee)}`
}
const signed = (n: number) => n === 0 ? '0 pts' : `${n > 0 ? '+' : '−'}${pts(Math.abs(n))} pts`
const neutral = computed(() => fees.value.find(f => Number(f.points) === 0) ?? null)
const simFilled = computed(() => (g.value?.criteria ?? []).filter(c => sim[c.key]).length)
const bandOf = (t: number) => [...(g.value?.bands ?? [])].reverse().find(b => (t > b.min_points || (b.min_points === 0 && t >= 0)) && t <= b.max_points) ?? null
const simBand = computed(() => bandOf(simTotal.value))
function simAll(k: Lv) { for (const c of g.value?.criteria ?? []) sim[c.key] = k }
const preview = computed(() => profile.value?.role !== 'parceiro')
</script>

<template>
  <div class="guide">
    <div v-if="preview" class="alert info small prev"><AppIcon name="eye" :size="16" /> Você está vendo esta página como o parceiro externo a vê.</div>

    <section class="hero">
      <BrandLogo class="sphere" variant="branca" symbol :height="280" />
      <div class="h-in">
        <div class="eyebrow light">Portal do parceiro · Treinamento</div>
        <h1>Como funciona a sua comissão</h1>
        <p v-if="g?.bands.length">Sua comissão vai de <b>{{ pct(minPct) }}</b> a <b>{{ pct(maxPct) }}</b> do valor do negócio. Quanto mais você participa, maior o percentual.
          Aqui você entende cada critério e pode simular a sua pontuação.</p>
      </div>
    </section>

    <div v-if="loading" class="empty"><span class="spinner" /></div>
    <template v-else-if="g">
      <div v-if="!g.active" class="alert warning small">As regras abaixo ainda estão em preparação e podem mudar.</div>

      <!-- 1. Passo a passo -->
      <section class="block">
        <div class="sec-head"><span class="num">1</span><div><h2>O caminho até a sua comissão</h2><p class="muted">Quatro momentos, do primeiro contato ao depósito.</p></div></div>
        <ol class="steps">
          <li><span class="st-ico"><AppIcon name="send" :size="20" /></span><div><strong>Você indica</strong><p>Compartilhe seu código de indicação com o provedor e apresente-o à nossa equipe. Ele passa a aparecer em <NuxtLink to="/portal/desempenho">Minhas indicações</NuxtLink>.</p></div></li>
          <li><span class="st-ico"><AppIcon name="handshake" :size="20" /></span><div><strong>Negociação</strong><p>Nossa equipe conduz a negociação. Sua participação ao longo do caminho é avaliada em {{ g.criteria.length }} critérios, que somam até 100 pontos.<template v-if="fees.length"> A taxa que o provedor fecha com a NOVALE pode somar ou tirar pontos.</template></p></div></li>
          <li><span class="st-ico"><AppIcon name="file" :size="20" /></span><div><strong>1ª avaliação · na proposta</strong><p>Quando a proposta for assinada, avaliamos os critérios {{ numsOf(phase1) }} e apresentamos o resultado a você.</p></div></li>
          <li><span class="st-ico"><AppIcon name="wallet" :size="20" /></span><div><strong>2ª avaliação · no fechamento</strong><p>No fim, avaliamos o critério {{ numsOf(phase2) }}, que fecha o percentual. A comissão aparece como <b>“Comissão liberada”</b><template v-if="g.payment_days === 0"> e é depositada no mesmo dia do fechamento</template><template v-else-if="g.payment_days"> e é paga em até {{ g.payment_days }} dias</template>.</p></div></li>
        </ol>
      </section>

      <!-- 2. Critérios -->
      <section class="block">
        <div class="sec-head"><span class="num">2</span><div><h2>Os {{ g.criteria.length }} critérios</h2><p class="muted">Cada critério vale pontos. <b>Baixo</b> = 0, <b>Médio</b> = metade, <b>Alto</b> = pontuação cheia.</p></div></div>
        <div class="crits">
          <article v-for="(c, i) in g.criteria" :key="c.key" class="card crit" :class="{ on: open === c.key }">
            <button class="crit-h" @click="open = open === c.key ? null : c.key">
              <span class="cn">{{ i + 1 }}</span>
              <span class="ct"><strong>{{ c.title }}</strong><small>{{ c.phase === 1 ? '1ª avaliação · na proposta' : '2ª avaliação · no fechamento' }}</small></span>
              <span class="cw">até <b>{{ pts(c.weight) }}</b> pts</span>
              <AppIcon :name="open === c.key ? 'chevron-down' : 'chevron-right'" :size="18" />
            </button>
            <div v-if="open === c.key" class="crit-b">
              <p v-if="c.help" class="help">{{ c.help }}</p>
              <div class="lvls">
                <div class="lvrow baixo"><span class="tag">Baixo · 0 pts</span><p>{{ c.level_low }}</p></div>
                <div class="lvrow medio"><span class="tag">Médio · {{ pts(c.weight / 2) }} pts</span><p>{{ c.level_mid }}</p></div>
                <div class="lvrow alto"><span class="tag">Alto · {{ pts(c.weight) }} pts</span><p>{{ c.level_high }}</p></div>
              </div>
            </div>
          </article>
        </div>
        <p class="small muted">Toque em cada critério para ver o que é considerado baixo, médio e alto.</p>
      </section>

      <!-- 3. Taxa -->
      <section v-if="fees.length" class="block">
        <div class="sec-head"><span class="num">3</span><div><h2>Bônus pela taxa do negócio</h2>
          <p class="muted">As 6 etapas medem a qualidade do seu trabalho. A taxa que o provedor fecha com a NOVALE, na assinatura do contrato de prestação de serviços, aumenta ou reduz esse resultado.<template v-if="neutral"> Padrão da casa: {{ feeRange(fees.indexOf(neutral)).toLowerCase() }}.</template></p></div></div>
        <div class="fees">
          <div v-for="(f, i) in fees" :key="i" class="fee" :class="Number(f.points) > 0 ? 'up' : Number(f.points) < 0 ? 'down' : 'zero'">
            <div class="f-pts">{{ signed(Number(f.points)) }}</div>
            <strong>{{ f.label }}</strong>
            <small>{{ feeRange(i) }}</small>
            <p v-if="f.description" class="small">{{ f.description }}</p>
          </div>
        </div>
        <p class="small muted">A nota final nunca fica abaixo de zero. Com o bônus, ela pode passar de 100 e chegar a {{ pts(maxPts) }} pontos.</p>
      </section>

      <!-- 4. Faixas -->
      <section class="block">
        <div class="sec-head"><span class="num">{{ fees.length ? 4 : 3 }}</span><div><h2>Da pontuação ao percentual</h2><p class="muted">A nota final (etapas{{ fees.length ? ' + ajuste da taxa' : '' }}) define a sua faixa e o percentual da comissão.</p></div></div>
        <div class="bands">
          <div v-for="(b, i) in g.bands" :key="i" class="band" :style="{ '--h': `${30 + (b.percent / maxPct) * 70}%` }">
            <div class="b-bar"><span>{{ pct(b.percent) }}</span></div>
            <strong>{{ b.label }}</strong>
            <small>{{ bandRange(b, i) }}</small>
            <p v-if="b.description" class="small muted">{{ b.description }}</p>
          </div>
        </div>
      </section>

      <!-- 4. Simulador -->
      <section class="block">
        <div class="sec-head"><span class="num">{{ fees.length ? 5 : 4 }}</span><div><h2>Faça um teste</h2><p class="muted">Marque como você imagina a sua participação em uma indicação e veja a faixa.</p></div></div>
        <div class="card simc">
          <div class="sim-list">
            <div v-for="(c, i) in g.criteria" :key="c.key" class="sim-row">
              <span class="sim-t"><b>{{ i + 1 }}.</b> {{ c.title }} <small class="muted">({{ pts(c.weight) }} pts)</small></span>
              <div class="lv">
                <button v-for="l in LV" :key="l.k" class="lvb" :class="[l.k, { on: sim[c.key] === l.k }]" @click="sim[c.key] = l.k">{{ l.t }}<small>{{ pts(lvPts(c, l.k)) }}</small></button>
              </div>
            </div>
            <div v-if="fees.length" class="sim-row fee-row">
              <span class="sim-t"><b>+</b> Taxa fechada com o provedor</span>
              <select v-model.number="simFee" class="select fee-sel">
                <option v-for="(f, i) in fees" :key="i" :value="i">{{ feeRange(i) }} · {{ f.label }} ({{ signed(Number(f.points)) }})</option>
              </select>
            </div>
            <div class="sim-quick small"><span class="muted">Atalhos:</span>
              <button class="link" @click="simAll('baixo')">tudo baixo</button>
              <button class="link" @click="simAll('medio')">tudo médio</button>
              <button class="link" @click="simAll('alto')">tudo alto</button>
            </div>
          </div>
          <div class="sim-res">
            <div class="eyebrow">Resultado</div>
            <div class="big">{{ pts(simTotal) }}<small>/{{ pts(maxPts) }} pts</small></div>
            <div v-if="fees.length" class="small muted">Etapas {{ pts(simBase) }} · taxa {{ signed(simAdj) }}</div>
            <div class="meter"><span :style="{ width: `${(simTotal / maxPts) * 100}%` }" /></div>
            <template v-if="simFilled">
              <div class="res-band">{{ simBand?.label ?? '—' }}</div>
              <div class="res-pct">{{ simBand ? pct(simBand.percent) : '—' }} <small>do valor do negócio</small></div>
            </template>
            <p v-else class="small muted">Escolha os níveis ao lado.</p>
            <p v-if="simFilled && simFilled < g.criteria.length" class="small muted">{{ g.criteria.length - simFilled }} critério(s) sem marcar contam como zero.</p>
          </div>
        </div>
        <p class="small muted">Simulação apenas para entender a regra. A avaliação oficial é feita pela equipe NOVALE em cada negociação.</p>
      </section>

      <!-- 5. Perguntas -->
      <section class="block">
        <div class="sec-head"><span class="num">{{ fees.length ? 6 : 5 }}</span><div><h2>Perguntas frequentes</h2></div></div>
        <div class="faq">
          <details><summary>Quem faz a avaliação?</summary><p>A equipe comercial da NOVALE, com base no que aconteceu em cada negociação. Cada nota fica registrada com data e responsável.</p></details>
          <details><summary>Quando fico sabendo da minha pontuação?</summary><p>Na 1ª avaliação, quando a proposta é assinada, nossa equipe apresenta a você o resultado dos critérios {{ numsOf(phase1) }}. O critério {{ numsOf(phase2) }} é avaliado no fechamento e define o percentual final.</p></details>
          <details v-if="fees.length"><summary>Como a taxa do negócio entra na conta?</summary><p>A taxa é registrada quando o provedor assina o contrato de prestação de serviços com a NOVALE e não muda depois. Ela soma ou tira pontos da nota das 6 etapas, conforme a tabela acima. Exemplo: 85 pontos nas etapas com taxa acima do padrão (+15) viram 100 pontos.</p></details>
          <details><summary>A pontuação pode mudar no meio do caminho?</summary><p>Sim. Até o fechamento, a avaliação pode ser revista se a sua participação mudar — para mais ou para menos.</p></details>
          <details><summary>O que é “Comissão liberada”?</summary><p>É o aviso de que a sua comissão foi gerada. Ela aparece em <NuxtLink to="/portal/comissoes">Comissões</NuxtLink>, passa por aprovação interna e depois é paga.</p></details>
          <details><summary>Como aumento o meu percentual?</summary><p>Participe de verdade: esteja nas primeiras reuniões, confirme o motivo da venda, traga os números corretos, alinhe a expectativa de preço, ajude na conferência de documentos e traga a oportunidade com exclusividade.<template v-if="fees.length"> E ajude a fechar uma taxa acima do padrão com o provedor.</template></p></details>
          <details v-if="g.payment_terms"><summary>Como é feito o pagamento?</summary><p>{{ g.payment_terms }}</p></details>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.guide { max-width: 1040px; margin: 0 auto; }
.prev { display: flex; align-items: center; gap: .4rem; margin-bottom: 1rem; }
.hero { position: relative; overflow: hidden; border-radius: var(--radius-lg); background: linear-gradient(140deg, var(--navy), var(--navy-900)); color: #D7DEF3; padding: 2rem; margin-bottom: 1.75rem; }
.h-in { position: relative; z-index: 1; max-width: 700px; }
.hero h1 { color: #fff; margin-bottom: .45rem; }
.hero p { margin: 0; line-height: 1.55; }
.hero b { color: #fff; }
.eyebrow.light { color: #9FB0E8; }
.sphere { position: absolute; right: -50px; top: -60px; opacity: .1; }
.block { margin-bottom: 2.25rem; }
.sec-head { display: flex; gap: .85rem; align-items: flex-start; margin-bottom: 1rem; }
.sec-head h2 { margin: 0 0 .15rem; }
.sec-head p { margin: 0; }
.num { flex: none; width: 34px; height: 34px; border-radius: 50%; background: var(--blue); color: #fff; display: grid; place-items: center; font-family: var(--font-head); font-weight: 700; }
.steps { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .9rem; counter-reset: s; }
.steps li { position: relative; background: #fff; border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; display: flex; flex-direction: column; gap: .6rem; }
.steps li:not(:last-child)::after { content: ''; position: absolute; right: -.75rem; top: 1.6rem; width: .6rem; height: 2px; background: var(--blue); }
.steps strong { color: var(--navy); font-family: var(--font-head); }
.steps p { margin: .25rem 0 0; font-size: .88rem; color: var(--ink-2); line-height: 1.5; }
.st-ico { width: 40px; height: 40px; border-radius: 12px; background: var(--blue-100); color: var(--blue); display: grid; place-items: center; }
.crits { display: grid; gap: .6rem; margin-bottom: .5rem; }
.crit { padding: 0; overflow: hidden; }
.crit.on { border-color: var(--blue); }
.crit-h { width: 100%; display: flex; align-items: center; gap: .9rem; padding: .85rem 1rem; background: none; border: 0; font: inherit; text-align: left; cursor: pointer; color: inherit; }
.cn { flex: none; width: 30px; height: 30px; border-radius: 8px; background: var(--navy); color: #fff; display: grid; place-items: center; font-weight: 700; font-family: var(--font-head); }
.ct { flex: 1; display: grid; }
.ct strong { color: var(--navy); }
.ct small { color: var(--muted); font-size: .78rem; }
.cw { white-space: nowrap; font-size: .85rem; color: var(--ink-2); }
.cw b { color: var(--blue); font-size: 1.05rem; }
.crit-b { padding: 0 1rem 1rem 3.75rem; }
.help { margin: 0 0 .8rem; color: var(--ink-2); line-height: 1.55; font-size: .92rem; }
.lvls { display: grid; gap: .45rem; }
.lvrow { display: grid; grid-template-columns: 130px 1fr; gap: .75rem; align-items: start; border-radius: 10px; padding: .55rem .7rem; }
.lvrow p { margin: 0; font-size: .88rem; line-height: 1.45; }
.lvrow .tag { font-weight: 700; font-size: .78rem; }
.lvrow.baixo { background: #fdf2f2; } .lvrow.baixo .tag { color: #a61b1b; }
.lvrow.medio { background: #fff8e6; } .lvrow.medio .tag { color: #8a5a00; }
.lvrow.alto { background: #eaf6ee; } .lvrow.alto .tag { color: #1e6b33; }
.fees { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: .8rem; margin-bottom: .5rem; }
.fee { background: #fff; border: 1px solid var(--line); border-top: 4px solid var(--muted); border-radius: var(--radius); padding: .9rem; display: flex; flex-direction: column; gap: .15rem; }
.fee.up { border-top-color: #1e8a43; } .fee.down { border-top-color: #c0392b; } .fee.zero { border-top-color: var(--blue); }
.f-pts { font-family: var(--font-head); font-weight: 800; font-size: 1.5rem; color: var(--navy); }
.fee.up .f-pts { color: #1e6b33; } .fee.down .f-pts { color: #a61b1b; }
.fee strong { color: var(--navy); }
.fee small { color: var(--muted); }
.fee p { margin: .35rem 0 0; color: var(--ink-2); line-height: 1.45; }
.fee-row { border-bottom: 0; background: var(--bg); border-radius: 10px; padding: .55rem .7rem; }
.fee-sel { max-width: 100%; width: auto; font-size: .85rem; }
.bands { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: .8rem; align-items: stretch; }
.band { background: #fff; border: 1px solid var(--line); border-radius: var(--radius); padding: .9rem; display: flex; flex-direction: column; gap: .2rem; }
.b-bar { height: 120px; display: flex; align-items: flex-end; margin-bottom: .5rem; }
.b-bar span { width: 100%; height: var(--h); border-radius: 8px 8px 4px 4px; background: linear-gradient(180deg, var(--blue), var(--navy)); color: #fff; display: grid; place-items: start center; padding-top: .4rem; font-family: var(--font-head); font-weight: 800; font-size: 1.15rem; }
.band strong { color: var(--navy); font-size: .92rem; }
.band small { color: var(--muted); }
.band p { margin: .3rem 0 0; }
.simc { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 1.25rem; padding: 1.1rem; margin-bottom: .5rem; }
.sim-list { display: grid; gap: .55rem; }
.sim-row { display: flex; justify-content: space-between; align-items: center; gap: .75rem; flex-wrap: wrap; padding-bottom: .55rem; border-bottom: 1px dashed var(--line); }
.sim-t { font-size: .92rem; }
.sim-quick { display: flex; gap: .7rem; align-items: center; }
.link { background: none; border: 0; padding: 0; color: var(--blue); font: inherit; cursor: pointer; text-decoration: underline; }
.lv { display: inline-flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.lvb { border: 0; background: #fff; padding: .3rem .75rem; font-size: .8rem; font-weight: 600; cursor: pointer; display: grid; line-height: 1.1; color: var(--ink-2); border-left: 1px solid var(--line); font-family: inherit; }
.lvb:first-child { border-left: 0; }
.lvb small { font-weight: 500; font-size: .68rem; color: var(--muted); }
.lvb.on.baixo { background: #fdecec; color: #a61b1b; }
.lvb.on.medio { background: #fff4db; color: #8a5a00; }
.lvb.on.alto { background: #e6f4ea; color: #1e6b33; }
.sim-res { background: var(--bg); border-radius: var(--radius); padding: 1rem; align-self: start; position: sticky; top: 1rem; }
.big { font-family: var(--font-head); font-weight: 800; font-size: 2.4rem; color: var(--navy); line-height: 1.1; }
.big small { font-size: .9rem; color: var(--muted); font-weight: 600; margin-left: .2rem; }
.meter { height: 8px; border-radius: 99px; background: #dfe5f3; margin: .5rem 0 .8rem; overflow: hidden; }
.meter span { display: block; height: 100%; background: var(--blue); transition: width .25s; }
.res-band { font-weight: 700; color: var(--navy); }
.res-pct { font-family: var(--font-head); font-weight: 800; font-size: 1.8rem; color: var(--blue); }
.res-pct small { font-size: .8rem; color: var(--muted); font-weight: 500; }
.faq { display: grid; gap: .5rem; }
.faq details { background: #fff; border: 1px solid var(--line); border-radius: var(--radius); padding: .8rem 1rem; }
.faq summary { cursor: pointer; font-weight: 600; color: var(--navy); }
.faq p { margin: .6rem 0 0; color: var(--ink-2); line-height: 1.55; }
@media (max-width: 860px) {
  .steps { grid-template-columns: 1fr 1fr; }
  .steps li::after { display: none; }
  .simc { grid-template-columns: minmax(0, 1fr); padding: .8rem; }
  .fee-sel { width: 100%; }
  .sim-row .lvb { padding: .3rem .55rem; }
  .sim-res { position: static; }
}
@media (max-width: 560px) {
  .steps { grid-template-columns: 1fr; }
  .crit-b { padding-left: 1rem; }
  .lvrow { grid-template-columns: 1fr; gap: .2rem; }
  .cw { display: none; }
}
</style>
