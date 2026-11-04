<script setup lang="ts">
import type { CommissionItem, CommissionPayment } from '~/utils/simulator'
interface Hist { id: string; action: string; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; reason: string | null; created_at: string; actor: { full_name: string } | null }

const props = defineProps<{ id: string | null; portal?: boolean }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const api = useApi()
const toast = useToast()

const c = ref<CommissionItem | null>(null)
const payments = ref<CommissionPayment[]>([])
const history = ref<Hist[]>([])
const canManage = ref(false)
const loading = ref(false)
const busy = ref(false)
const action = ref<'' | 'adjust' | 'cancel' | 'pay'>('')
const form = reactive({ amount: null as number | null, reason: '', method: 'pix', paid_at: '', reference: '', notes: '' })
const errors = ref<Record<string, string>>({})

async function load() {
  if (!props.id) return
  loading.value = !c.value || c.value.id !== props.id
  try {
    const r = await api.get<{ commission: CommissionItem; payments: CommissionPayment[]; history: Hist[]; can_manage: boolean }>(`/commissions/${props.id}`)
    c.value = r.commission; payments.value = r.payments; history.value = r.history; canManage.value = r.can_manage && !props.portal
  } catch (e) { toast.error(errorMessage(e)); emit('close') } finally { loading.value = false }
}
watch(() => props.id, (v) => { action.value = ''; if (v) { c.value = null; load() } }, { immediate: true })

function start(a: typeof action.value) {
  action.value = a; errors.value = {}
  Object.assign(form, { amount: a === 'pay' ? c.value?.balance ?? null : a === 'adjust' ? c.value?.amount ?? null : null, reason: '', method: 'pix', paid_at: todayISO(), reference: '', notes: '' })
}
async function run(kind: 'approve' | 'adjust' | 'cancel' | 'reopen' | 'pay') {
  busy.value = true; errors.value = {}
  const body: Record<string, unknown> = { reason: form.reason }
  if (kind === 'adjust') body.amount = form.amount
  if (kind === 'pay') Object.assign(body, { amount: form.amount, method: form.method, paid_at: form.paid_at, reference: form.reference, notes: form.notes })
  try {
    await api.post(`/commissions/${c.value!.id}/${kind}`, body)
    const msg = { approve: 'Comissão aprovada. O beneficiário foi avisado.', adjust: 'Valor ajustado.', cancel: 'Comissão cancelada.', reopen: 'Comissão reaberta.', pay: 'Pagamento registrado.' }
    toast.success(msg[kind]); action.value = ''; await load(); emit('changed')
  } catch (e) {
    if (e instanceof ApiError && e.data.errors) errors.value = e.data.errors as Record<string, string>
    toast.error(errorMessage(e))
  } finally { busy.value = false }
}

const STATUS_WORD: Record<string, string> = COMMISSION_STATUS_LABEL
function histText(h: Hist): string {
  const o = h.old_data ?? {}; const n = h.new_data ?? {}
  if (h.action === 'insert') return `Comissão gerada${n.amount !== null && n.amount !== undefined ? ` · ${fmtBRL(Number(n.amount))}` : ''}`
  const parts: string[] = []
  if (n.status !== undefined && n.status !== o.status) parts.push(`${STATUS_WORD[String(o.status)] ?? o.status} → ${STATUS_WORD[String(n.status)] ?? n.status}`)
  if (n.amount !== undefined && Number(n.amount) !== Number(o.amount)) parts.push(`valor ${o.amount === null ? '—' : fmtBRL(Number(o.amount))} → ${n.amount === null ? '—' : fmtBRL(Number(n.amount))}`)
  if (n.paid_amount !== undefined && Number(n.paid_amount) !== Number(o.paid_amount)) parts.push(`pago ${fmtBRL(Number(n.paid_amount))}`)
  return parts.length ? capFirst(parts.join(' · ')) : 'Atualização'
}
const histReason = (h: Hist) => h.reason ?? (h.new_data?.cancel_reason !== h.old_data?.cancel_reason ? h.new_data?.cancel_reason : null) ?? (h.new_data?.adjust_reason !== h.old_data?.adjust_reason ? h.new_data?.adjust_reason : null)
const visibleHistory = computed(() => history.value.filter((h) => h.action === 'insert' || histText(h) !== 'Atualização'))
const rule = computed(() => c.value?.rule_snapshot ?? {})
const ruleText = computed(() => {
  const r = rule.value; const p: string[] = []
  if (r.percent) p.push(`${Number(r.percent).toLocaleString('pt-BR')}%`)
  if (r.fixed_amount) p.push(`${p.length ? '+ ' : ''}${fmtBRL(Number(r.fixed_amount))}`)
  if (r.max_amount) p.push(`(teto ${fmtBRL(Number(r.max_amount))})`)
  return p.join(' ')
})
</script>

<template>
  <AppModal :open="!!id" side :width="600" :title="c ? `Comissão · ${c.opp_name}` : 'Comissão'" @close="emit('close')">
    <div v-if="loading" class="empty"><span class="spinner" /></div>
    <div v-else-if="c" class="stack">
      <div class="row">
        <span class="badge" :class="COMMISSION_STATUS_TONE[c.status]">{{ COMMISSION_STATUS_LABEL[c.status] }}</span>
        <span v-if="c.overdue" class="badge danger">Pagamento atrasado</span>
        <span class="badge plain">{{ BENEFICIARY_TYPE_LABEL[c.beneficiary_type] }}</span>
        <NuxtLink v-if="!portal" :to="`/crm/oportunidades?id=${c.opportunity_id}`" class="small" style="margin-left:auto">Ver oportunidade →</NuxtLink>
      </div>

      <section class="amount">
        <div><span>Valor da comissão</span><strong>{{ c.amount === null ? 'A definir' : fmtBRL(c.amount) }}</strong></div>
        <div><span>Pago</span><strong>{{ fmtBRL(c.paid_amount) }}</strong></div>
        <div><span>Saldo</span><strong>{{ c.balance === null ? '—' : fmtBRL(c.balance) }}</strong></div>
      </section>
      <div v-if="c.amount === null && !portal" class="alert warning small"><AppIcon name="alert" :size="18" />
        <span>Sem valor: informe o valor do negócio na oportunidade ou ajuste o valor manualmente.</span></div>

      <dl class="dl">
        <dt>Beneficiário</dt><dd>{{ c.beneficiary?.full_name }}<span v-if="!portal" class="muted"> · {{ c.beneficiary?.email }}</span></dd>
        <dt>Provedor</dt><dd>{{ c.opp_name }}<span v-if="c.opp?.isp" class="muted"> · {{ c.opp.isp.city }}/{{ c.opp.isp.state }}</span></dd>
        <dt>Regra</dt><dd>{{ rule.name }}<span v-if="!portal && ruleText" class="muted"> · {{ ruleText }}</span></dd>
        <template v-if="!portal && c.base"><dt>Base de cálculo</dt><dd>{{ COMMISSION_BASE_LABEL[c.base] }}: {{ c.base_value === null || c.base_value === undefined ? 'não informado' : fmtBRL(c.base_value) }}</dd></template>
        <dt>Gerada em</dt><dd>{{ fmtDateTime(c.generated_at) }}</dd>
        <template v-if="c.approved_at"><dt>Aprovada em</dt><dd>{{ fmtDateTime(c.approved_at) }}<template v-if="c.approver"> por {{ c.approver.full_name }}</template></dd></template>
        <template v-if="c.due_date"><dt>Previsão de pagamento</dt><dd :class="{ late: c.overdue }">{{ fmtDay(c.due_date) }}</dd></template>
        <template v-if="c.paid_at"><dt>Quitada em</dt><dd>{{ fmtDateTime(c.paid_at) }}</dd></template>
        <template v-if="rule.payment_terms"><dt>Condições</dt><dd class="pre">{{ rule.payment_terms }}</dd></template>
        <template v-if="c.adjust_reason"><dt>Motivo do ajuste</dt><dd>{{ c.adjust_reason }}</dd></template>
        <template v-if="c.cancel_reason && c.status === 'cancelada'"><dt>Motivo do cancelamento</dt><dd>{{ c.cancel_reason }}</dd></template>
      </dl>

      <section v-if="canManage && !action && c.status !== 'paga'" class="box">
        <div class="eyebrow">Ações</div>
        <div class="row">
          <button v-if="c.status === 'gerada'" class="btn btn-success btn-sm" :disabled="busy || c.amount === null" @click="run('approve')"><AppIcon name="check-circle" :size="16" /> Aprovar</button>
          <button v-if="c.status === 'aprovada'" class="btn btn-sm" @click="start('pay')"><AppIcon name="wallet" :size="16" /> Registrar pagamento</button>
          <button v-if="['gerada', 'aprovada'].includes(c.status)" class="btn btn-outline btn-sm" @click="start('adjust')"><AppIcon name="edit" :size="16" /> Ajustar valor</button>
          <button v-if="['gerada', 'aprovada'].includes(c.status) && !c.paid_amount" class="btn btn-ghost btn-sm" @click="start('cancel')"><AppIcon name="ban" :size="16" /> Cancelar</button>
          <button v-if="c.status === 'cancelada'" class="btn btn-outline btn-sm" :disabled="busy" @click="run('reopen')"><AppIcon name="refresh" :size="16" /> Reabrir</button>
        </div>
      </section>

      <section v-if="action === 'pay'" class="box stack">
        <div class="eyebrow">Registrar pagamento</div>
        <div class="form-grid">
          <div class="field"><label for="pa">Valor pago<span class="req">*</span></label><MoneyInput id="pa" v-model="form.amount" />
            <span v-if="errors.amount" class="err">{{ errors.amount }}</span><span v-else class="hint">Saldo: {{ fmtBRL(c.balance) }}</span></div>
          <div class="field"><label for="pd">Data do pagamento</label><input id="pd" v-model="form.paid_at" type="date" class="input" :max="todayISO()">
            <span v-if="errors.paid_at" class="err">{{ errors.paid_at }}</span></div>
          <div class="field"><label for="pm">Forma</label><select id="pm" v-model="form.method" class="select"><option v-for="(l, k) in PAY_METHOD_LABEL" :key="k" :value="k">{{ l }}</option></select></div>
          <div class="field"><label for="pr">Comprovante / referência</label><input id="pr" v-model="form.reference" class="input" placeholder="Ex.: ID da transação Pix"></div>
          <div class="field full"><label for="pn">Observação interna</label><input id="pn" v-model="form.notes" class="input"></div>
        </div>
        <p class="small muted" style="margin:0">Pagamentos parciais são permitidos. Ao quitar o saldo, a comissão passa para "Paga" e o beneficiário é avisado.</p>
        <div class="row end"><button class="btn btn-ghost btn-sm" @click="action = ''">Voltar</button>
          <button class="btn btn-sm" :disabled="busy || !(form.amount && form.amount > 0)" @click="run('pay')">Registrar</button></div>
      </section>
      <section v-if="action === 'adjust'" class="box stack">
        <div class="eyebrow">Ajustar valor</div>
        <div class="form-grid">
          <div class="field"><label for="aa">Novo valor<span class="req">*</span></label><MoneyInput id="aa" v-model="form.amount" /></div>
          <div class="field"><label for="ar">Motivo<span class="req">*</span></label><input id="ar" v-model="form.reason" class="input"></div>
        </div>
        <p class="small muted" style="margin:0">Valores ajustados manualmente não são recalculados quando o valor do negócio muda.</p>
        <div class="row end"><button class="btn btn-ghost btn-sm" @click="action = ''">Voltar</button>
          <button class="btn btn-sm" :disabled="busy || form.amount === null || form.reason.trim().length < 3" @click="run('adjust')">Salvar ajuste</button></div>
      </section>
      <section v-if="action === 'cancel'" class="box stack">
        <div class="eyebrow">Cancelar comissão</div>
        <div class="field"><label for="cr">Motivo<span class="req">*</span></label><input id="cr" v-model="form.reason" class="input"></div>
        <div class="row end"><button class="btn btn-ghost btn-sm" @click="action = ''">Voltar</button>
          <button class="btn btn-danger btn-sm" :disabled="busy || form.reason.trim().length < 3" @click="run('cancel')">Cancelar comissão</button></div>
      </section>

      <section>
        <div class="eyebrow">Pagamentos</div>
        <p v-if="!payments.length" class="small muted" style="margin:0">Nenhum pagamento registrado.</p>
        <ul v-else class="pays">
          <li v-for="p in payments" :key="p.id">
            <div class="grow"><strong>{{ fmtBRL(p.amount) }}</strong> · {{ PAY_METHOD_LABEL[p.method] ?? p.method }}
              <div class="small muted">{{ fmtDay(p.paid_at) }}<template v-if="p.reference"> · {{ p.reference }}</template><template v-if="p.author"> · registrado por {{ p.author.full_name }}</template></div>
              <div v-if="p.notes" class="small">{{ p.notes }}</div></div>
          </li>
        </ul>
      </section>

      <section v-if="visibleHistory.length">
        <div class="eyebrow">Histórico</div>
        <ul class="hist"><li v-for="h in visibleHistory" :key="h.id"><strong class="small">{{ histText(h) }}</strong>
          <div v-if="histReason(h)" class="small">{{ histReason(h) }}</div>
          <div class="small muted">{{ fmtDateTime(h.created_at) }} · {{ h.actor?.full_name ?? 'Sistema' }}</div></li></ul>
      </section>
    </div>
  </AppModal>
</template>

<style scoped>
.amount { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--navy); border-radius: var(--radius); overflow: hidden; color: #fff; }
.amount > div { padding: .8rem 1rem; background: var(--navy); }
.amount span { display: block; font-size: .68rem; text-transform: uppercase; letter-spacing: .08em; color: #9FB0E8; }
.amount strong { font-family: var(--font-head); font-size: 1.15rem; }
.box { border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; background: var(--tint); }
.pays { list-style: none; margin: 0; padding: 0; display: grid; gap: .4rem; }
.pays li { display: flex; gap: .7rem; padding: .6rem .8rem; border: 1px solid var(--line); border-radius: var(--radius); }
.hist { list-style: none; margin: 0; padding: 0 0 0 .9rem; border-left: 2px solid var(--line); display: grid; gap: .6rem; }
.pre { white-space: pre-wrap; }
.late { color: var(--danger); font-weight: 600; }
.err { color: var(--danger); font-size: .8rem; }
@media (max-width: 520px) { .amount { grid-template-columns: 1fr; } }
</style>
