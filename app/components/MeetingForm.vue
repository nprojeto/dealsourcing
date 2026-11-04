<script setup lang="ts">
import type { Assignee, MeetingItem, MeetingParticipant, OppItem } from '~/utils/simulator'
const props = defineProps<{ open: boolean; meeting?: MeetingItem | null; opportunityId?: string | null; presetDate?: string | null; assignees: Assignee[] }>()
const emit = defineEmits<{ close: []; saved: [string] }>()
const api = useApi()
const toast = useToast()
const auth = useAuth()

const opps = ref<OppItem[]>([])
const editing = computed(() => !!props.meeting)
const f = reactive({
  opportunity_id: '', title: '', unscheduled: false, starts_at: '', duration_min: 60, mode: 'online', meeting_url: '', address: '',
  organizer_id: '', notes: '', visible_to_isp: true, notify: true,
})
const internals = ref<string[]>([])
const externals = ref<MeetingParticipant[]>([])
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const error = ref('')

async function init() {
  errors.value = {}; error.value = ''
  const m = props.meeting
  if (m) {
    Object.assign(f, {
      opportunity_id: m.opportunity_id, title: m.title, unscheduled: !m.starts_at, starts_at: toLocalInput(m.starts_at),
      duration_min: m.duration_min, mode: m.mode, meeting_url: m.meeting_url ?? '', address: m.address ?? '',
      organizer_id: m.organizer_id, notes: m.notes ?? '', visible_to_isp: m.visible_to_isp, notify: true,
    })
    internals.value = m.participants.filter((p) => p.kind === 'interno' && p.user_id).map((p) => p.user_id!)
    externals.value = m.participants.filter((p) => p.kind !== 'interno').map((p) => ({ kind: p.kind, name: p.name, email: p.email ?? '', phone: maskPhone(p.phone ?? '') }))
    return
  }
  Object.assign(f, {
    opportunity_id: props.opportunityId ?? '', title: '', unscheduled: false,
    starts_at: props.presetDate ? `${props.presetDate}T10:00` : '', duration_min: 60, mode: 'online', meeting_url: '', address: '',
    organizer_id: auth.profile.value?.id ?? '', notes: '', visible_to_isp: true, notify: true,
  })
  internals.value = []; externals.value = []
  try {
    const r = await api.get<{ items: OppItem[] }>('/crm/opportunities', { status: 'open' })
    opps.value = r.items.sort((a, b) => a.name.localeCompare(b.name))
  } catch (e) { toast.error(errorMessage(e)) }
  if (f.opportunity_id) onOpp()
}
watch(() => props.open, (v) => { if (v) init() })

function onOpp() {
  const o = opps.value.find((x) => x.id === f.opportunity_id)
  if (!o) return
  if (!f.title) f.title = `Reunião com ${o.name}`
  const email = o.isp?.email ?? o.prospect_email ?? ''
  const name = o.isp?.responsible_name ?? o.prospect_contact ?? o.name
  if (!externals.value.length && (email || name)) externals.value = [{ kind: 'provedor', name, email, phone: maskPhone(o.isp?.phone ?? o.prospect_phone ?? '') }]
}
function addExternal() { externals.value.push({ kind: 'externo', name: '', email: '', phone: '' }) }
const otherInternals = computed(() => props.assignees.filter((a) => a.id !== f.organizer_id))

async function save() {
  errors.value = {}; error.value = ''
  if (!f.opportunity_id) { errors.value.opportunity_id = 'Selecione a oportunidade.'; return }
  if (!f.unscheduled && !f.starts_at) { errors.value.starts_at = 'Informe data e horário, ou marque "ainda sem data".'; return }
  busy.value = true
  const body: Record<string, unknown> = {
    title: f.title, starts_at: f.unscheduled ? null : fromLocalInput(f.starts_at), duration_min: f.duration_min, mode: f.mode,
    meeting_url: f.mode === 'online' ? f.meeting_url : '', address: f.mode === 'presencial' ? f.address : '',
    organizer_id: f.organizer_id, notes: f.notes, visible_to_isp: f.visible_to_isp, notify: f.notify,
    participants: [
      ...internals.value.filter((id) => id !== f.organizer_id).map((id) => ({ kind: 'interno', user_id: id })),
      ...externals.value.filter((p) => p.name.trim()).map((p) => ({ kind: p.kind, name: p.name, email: p.email, phone: onlyDigits(p.phone ?? '') })),
    ],
  }
  try {
    let id = props.meeting?.id ?? ''
    let r: { conflicts?: { title: string; starts_at: string }[]; emailed?: number; id?: string }
    if (editing.value) r = await api.patch(`/crm/meetings/${id}`, body)
    else { r = await api.post('/crm/meetings', { ...body, opportunity_id: f.opportunity_id }); id = r.id! }
    toast.success(editing.value ? 'Reunião atualizada.' : 'Reunião registrada.')
    if (r.emailed) toast.info(`Convite enviado por e-mail para ${r.emailed} participante(s).`)
    if (r.conflicts?.length) toast.warning(`Atenção: o responsável já tem "${r.conflicts[0]!.title}" em ${fmtDateTime(r.conflicts[0]!.starts_at)}.`)
    emit('saved', id)
  } catch (e) {
    if (e instanceof ApiError && e.data.errors) errors.value = e.data.errors as Record<string, string>
    error.value = errorMessage(e)
  } finally { busy.value = false }
}
</script>

<template>
  <AppModal :open="open" :title="editing ? 'Editar reunião' : 'Agendar reunião'" :width="760" @close="emit('close')">
    <div class="form-grid">
      <div v-if="!editing" class="field full"><label for="m-opp">Oportunidade<span class="req">*</span></label>
        <select id="m-opp" v-model="f.opportunity_id" class="select" :aria-invalid="!!errors.opportunity_id" @change="onOpp">
          <option value="" disabled>Selecione o provedor</option>
          <option v-for="o in opps" :key="o.id" :value="o.id">{{ o.name }}{{ o.city ? ` · ${o.city}/${o.state}` : '' }} · {{ o.stage?.name }}</option>
        </select><span v-if="errors.opportunity_id" class="error">{{ errors.opportunity_id }}</span></div>
      <div class="field full"><label for="m-title">Assunto<span class="req">*</span></label>
        <input id="m-title" v-model="f.title" class="input" :aria-invalid="!!errors.title" placeholder="Ex.: Apresentação da proposta"><span v-if="errors.title" class="error">{{ errors.title }}</span></div>

      <div class="field"><label for="m-when">Data e horário</label>
        <input id="m-when" v-model="f.starts_at" class="input" type="datetime-local" :disabled="f.unscheduled" :aria-invalid="!!errors.starts_at">
        <span v-if="errors.starts_at" class="error">{{ errors.starts_at }}</span>
        <label class="check small" style="margin-top:.35rem"><input v-model="f.unscheduled" type="checkbox"> Ainda sem data (aguardando agendamento)</label></div>
      <div class="field"><label for="m-dur">Duração</label>
        <select id="m-dur" v-model.number="f.duration_min" class="select"><option v-for="d in [15, 30, 45, 60, 90, 120, 180, 240]" :key="d" :value="d">{{ d < 60 ? `${d} min` : `${d / 60} h`.replace('.5', ',5') }}</option></select></div>

      <div class="field"><span class="label">Formato</span>
        <SegmentedControl v-model="f.mode" name="mode" :options="[{ value: 'online', label: 'Online' }, { value: 'presencial', label: 'Presencial' }, { value: 'telefone', label: 'Telefone' }]" /></div>
      <div v-if="f.mode === 'online'" class="field"><label for="m-url">Link da reunião</label>
        <input id="m-url" v-model="f.meeting_url" class="input" placeholder="https://meet.google.com/…" :aria-invalid="!!errors.meeting_url">
        <span v-if="errors.meeting_url" class="error">{{ errors.meeting_url }}</span><span v-else class="hint">Pode ser informado depois.</span></div>
      <div v-else-if="f.mode === 'presencial'" class="field"><label for="m-addr">Endereço</label>
        <input id="m-addr" v-model="f.address" class="input" :aria-invalid="!!errors.address"><span v-if="errors.address" class="error">{{ errors.address }}</span></div>
      <div v-else class="field" />

      <div class="field"><label for="m-org">Responsável comercial</label>
        <select id="m-org" v-model="f.organizer_id" class="select" :disabled="!auth.isManager.value" :aria-invalid="!!errors.organizer_id">
          <option v-for="a in assignees" :key="a.id" :value="a.id">{{ a.full_name }}</option>
        </select><span v-if="errors.organizer_id" class="error">{{ errors.organizer_id }}</span></div>
      <div class="field"><label for="m-int">Outros participantes da equipe</label>
        <select id="m-int" v-model="internals" class="select multi" multiple :size="Math.min(4, Math.max(2, otherInternals.length))">
          <option v-for="a in otherInternals" :key="a.id" :value="a.id">{{ a.full_name }}</option>
        </select><span class="hint">Ctrl/⌘ + clique para escolher vários.</span></div>

      <div class="field full"><span class="label">Participantes externos (provedor e convidados)</span>
        <div v-for="(p, i) in externals" :key="i" class="ext">
          <select v-model="p.kind" class="select sm" aria-label="Tipo"><option value="provedor">Provedor</option><option value="externo">Convidado</option></select>
          <input v-model="p.name" class="input sm" placeholder="Nome" aria-label="Nome">
          <input v-model="p.email" class="input sm" type="email" placeholder="E-mail" aria-label="E-mail">
          <input maxlength="15" class="input sm" :value="p.phone" placeholder="Telefone" aria-label="Telefone" @input="p.phone = masked($event, maskPhone)">
          <button class="icon-btn" type="button" aria-label="Remover" @click="externals.splice(i, 1)"><AppIcon name="x" :size="16" /></button>
        </div>
        <span v-for="(msg, k) in errors" v-show="String(k).startsWith('participants')" :key="k" class="error">{{ msg }}</span>
        <button type="button" class="btn btn-ghost btn-sm" style="justify-self:start" @click="addExternal"><AppIcon name="plus" :size="16" /> Adicionar participante</button></div>

      <div class="field full"><label for="m-notes">Observações internas</label><textarea id="m-notes" v-model="f.notes" class="textarea" rows="2" style="min-height:64px" placeholder="Pauta, materiais, pontos de atenção (não aparecem para o provedor)" /></div>
      <label class="check full"><input v-model="f.visible_to_isp" type="checkbox"> Mostrar esta reunião no portal do provedor</label>
      <label class="check full"><input v-model="f.notify" type="checkbox" :disabled="!f.visible_to_isp"> Enviar convite por e-mail aos participantes externos (com arquivo de calendário)</label>
      <div v-if="error" class="alert danger full small"><AppIcon name="alert" :size="18" /> {{ error }}</div>
    </div>
    <template #footer>
      <button class="btn btn-ghost" @click="emit('close')">Cancelar</button>
      <button class="btn" :disabled="busy" @click="save"><span v-if="busy" class="spinner" /> {{ editing ? 'Salvar alterações' : 'Agendar' }}</button>
    </template>
  </AppModal>
</template>

<style scoped>
.ext { display: grid; grid-template-columns: 120px 1fr 1.2fr 150px 36px; gap: .4rem; align-items: center; margin-bottom: .4rem; }
.input.sm, .select.sm { min-height: 38px; padding: .4rem .6rem; font-size: .88rem; }
.select.sm { padding-right: 1.8rem; }
.multi { min-height: 76px; background-image: none; padding-right: .6rem; }
@media (max-width: 720px) { .ext { grid-template-columns: 1fr 1fr; } .ext .icon-btn { justify-self: end; } }
</style>
