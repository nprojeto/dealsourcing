<script setup lang="ts">
import type { MeetingItem } from '~/utils/simulator'
interface Hist { id: string; kind: string; event: string | null; outcome: string | null; description: string | null; occurred_at: string; user: { full_name: string } | null }
const props = defineProps<{ id: string | null }>()
const emit = defineEmits<{ close: []; changed: []; edit: [MeetingItem] }>()
const api = useApi()
const toast = useToast()
const m = ref<MeetingItem | null>(null)
const history = ref<Hist[]>([])
const canEdit = ref(false)
const conflicts = ref<{ title: string; starts_at: string }[]>([])
const loading = ref(false)
const action = ref<'' | 'realizada' | 'cancelada' | 'nao_compareceu'>('')
const form = reactive({ outcome: '', next_steps: '', next_due_at: '', note: '', notify: true })
const busy = ref(false)

async function load() {
  if (!props.id) return
  loading.value = !m.value || m.value.id !== props.id
  try {
    const r = await api.get<{ meeting: MeetingItem; history: Hist[]; can_edit: boolean; conflicts: { title: string; starts_at: string }[] }>(`/crm/meetings/${props.id}`)
    m.value = r.meeting; history.value = r.history; canEdit.value = r.can_edit; conflicts.value = r.conflicts
  } catch (e) { toast.error(errorMessage(e)); emit('close') } finally { loading.value = false }
}
watch(() => props.id, (v) => { action.value = ''; if (v) { m.value = null; load() } }, { immediate: true })

const open = computed(() => !!m.value && ['aguardando_agendamento', 'agendada', 'confirmada', 'reagendada'].includes(m.value.status))
const started = computed(() => !!m.value?.starts_at && new Date(m.value.starts_at).getTime() <= Date.now() + 15 * 60_000)
function start(a: typeof action.value) { action.value = a; Object.assign(form, { outcome: '', next_steps: '', next_due_at: '', note: '', notify: true }) }
async function setStatus(status: string) {
  busy.value = true
  try {
    const r = await api.post<{ emailed: number }>(`/crm/meetings/${m.value!.id}/status`, { status, outcome: form.outcome, next_steps: form.next_steps, next_due_at: fromLocalInput(form.next_due_at), note: form.note, notify: form.notify })
    toast.success(`Reunião: ${MEETING_STATUS_LABEL[status]}.`)
    if (r.emailed) toast.info(`Aviso de cancelamento enviado para ${r.emailed} participante(s).`)
    action.value = ''; await load(); emit('changed')
  } catch (e) { toast.error(errorMessage(e)) } finally { busy.value = false }
}
function end(x: MeetingItem) { return x.ends_at ? new Date(x.ends_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '' }
</script>

<template>
  <AppModal :open="!!id" side :width="620" :title="m?.title ?? 'Reunião'" @close="emit('close')">
    <div v-if="loading" class="empty"><span class="spinner" /></div>
    <div v-else-if="m" class="stack">
      <div class="row">
        <span class="badge" :class="MEETING_STATUS_TONE[m.status]">{{ MEETING_STATUS_LABEL[m.status] }}</span>
        <span v-if="m.result_pending" class="badge danger">Resultado pendente</span>
        <span v-if="!m.visible_to_isp" class="badge plain">Oculta para o provedor</span>
        <NuxtLink :to="`/crm/oportunidades?id=${m.opportunity_id}`" class="small" style="margin-left:auto">{{ m.opp_name }} →</NuxtLink>
      </div>
      <div v-if="conflicts.length && open" class="alert warning small"><AppIcon name="alert" :size="18" />
        <span>Conflito de horário: o responsável também tem <b>{{ conflicts[0]!.title }}</b> em {{ fmtDateTime(conflicts[0]!.starts_at) }}.</span></div>

      <section class="when">
        <AppIcon name="calendar" :size="22" />
        <div v-if="m.starts_at"><strong>{{ capFirst(new Date(m.starts_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })) }}</strong>
          <div>{{ new Date(m.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) }} – {{ end(m) }} ({{ m.duration_min }} min)</div></div>
        <div v-else><strong>Data a definir</strong><div class="small muted">Aguardando agendamento</div></div>
      </section>

      <dl class="dl">
        <dt>Formato</dt><dd><AppIcon :name="MEETING_MODE_ICON[m.mode] ?? 'info'" :size="14" /> {{ MEETING_MODE_LABEL[m.mode] }}</dd>
        <template v-if="m.meeting_url"><dt>Link</dt><dd><a :href="m.meeting_url" target="_blank" rel="noopener">{{ m.meeting_url }}</a></dd></template>
        <template v-if="m.address"><dt>Endereço</dt><dd>{{ m.address }}</dd></template>
        <dt>Responsável</dt><dd>{{ m.organizer?.full_name }}</dd>
        <dt>Participantes</dt><dd>
          <ul class="parts"><li v-for="p in m.participants" :key="p.id ?? p.name"><span class="badge plain">{{ p.kind === 'interno' ? 'Equipe' : p.kind === 'provedor' ? 'Provedor' : 'Convidado' }}</span> {{ p.name }}<span v-if="p.email" class="muted"> · {{ p.email }}</span></li>
            <li v-if="!m.participants.length" class="muted">Somente o responsável</li></ul></dd>
        <template v-if="m.notes"><dt>Observações</dt><dd class="pre">{{ m.notes }}</dd></template>
        <template v-if="m.outcome"><dt>Resultado</dt><dd class="pre">{{ m.outcome }}</dd></template>
        <template v-if="m.next_steps"><dt>Próximos passos</dt><dd class="pre">{{ m.next_steps }}</dd></template>
        <template v-if="m.cancel_reason"><dt>Motivo do cancelamento</dt><dd>{{ m.cancel_reason }}</dd></template>
      </dl>

      <section v-if="canEdit && open && !action" class="box">
        <div class="eyebrow">Ações</div>
        <div class="row">
          <button class="btn btn-outline btn-sm" @click="emit('edit', m)"><AppIcon name="edit" :size="16" /> {{ m.starts_at ? 'Editar / reagendar' : 'Definir data' }}</button>
          <button v-if="['agendada', 'reagendada'].includes(m.status)" class="btn btn-outline btn-sm" :disabled="busy" @click="setStatus('confirmada')"><AppIcon name="check" :size="16" /> Confirmar</button>
          <button v-if="m.starts_at" class="btn btn-success btn-sm" :disabled="!started" :title="started ? '' : 'Disponível a partir do horário da reunião'" @click="start('realizada')"><AppIcon name="check-circle" :size="16" /> Realizada</button>
          <button v-if="m.starts_at" class="btn btn-outline btn-sm" :disabled="!started" @click="start('nao_compareceu')">Não compareceu</button>
          <button class="btn btn-ghost btn-sm" @click="start('cancelada')"><AppIcon name="ban" :size="16" /> Cancelar</button>
        </div>
      </section>

      <section v-if="action === 'realizada'" class="box stack">
        <div class="eyebrow">Registrar resultado</div>
        <div class="field"><label for="mo">Resultado da reunião<span class="req">*</span></label><textarea id="mo" v-model="form.outcome" class="textarea" rows="3" placeholder="O que foi apresentado e decidido" /></div>
        <div class="form-grid">
          <div class="field"><label for="mn">Próximos passos</label><input id="mn" v-model="form.next_steps" class="input" placeholder="Ex.: Enviar proposta formal"></div>
          <div class="field"><label for="md">Prazo</label><input id="md" v-model="form.next_due_at" class="input" type="datetime-local"></div>
        </div>
        <p class="small muted" style="margin:0">A oportunidade avança para "Reunião realizada" e o próximo passo é atualizado na ficha.</p>
        <div class="row end"><button class="btn btn-ghost btn-sm" @click="action = ''">Voltar</button>
          <button class="btn btn-success btn-sm" :disabled="busy || form.outcome.trim().length < 3" @click="setStatus('realizada')">Salvar resultado</button></div>
      </section>
      <section v-if="action === 'nao_compareceu' || action === 'cancelada'" class="box stack">
        <div class="eyebrow">{{ action === 'cancelada' ? 'Cancelar reunião' : 'Provedor não compareceu' }}</div>
        <div class="field"><label for="mr">{{ action === 'cancelada' ? 'Motivo' : 'Observação (opcional)' }}<span v-if="action === 'cancelada'" class="req">*</span></label><input id="mr" v-model="form.note" class="input"></div>
        <label v-if="action === 'cancelada' && m.visible_to_isp && m.starts_at" class="check small"><input v-model="form.notify" type="checkbox"> Avisar os participantes externos por e-mail</label>
        <div class="row end"><button class="btn btn-ghost btn-sm" @click="action = ''">Voltar</button>
          <button class="btn btn-danger btn-sm" :disabled="busy || (action === 'cancelada' && form.note.trim().length < 3)" @click="setStatus(action)">Confirmar</button></div>
      </section>

      <section v-if="history.length">
        <div class="eyebrow">Histórico</div>
        <ul class="hist"><li v-for="h in history" :key="h.id"><strong class="small">{{ h.description?.split('\n')[0] }}</strong>
          <div class="small muted">{{ fmtDateTime(h.occurred_at) }} · {{ h.user?.full_name ?? 'Sistema' }}</div></li></ul>
      </section>
    </div>
  </AppModal>
</template>

<style scoped>
.when { display: flex; gap: .9rem; align-items: center; padding: .9rem 1rem; background: var(--navy); color: #fff; border-radius: var(--radius); }
.when :deep(svg) { color: #9FB0E8; flex: none; }

.box { border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; background: var(--tint); }
.parts { list-style: none; margin: 0; padding: 0; display: grid; gap: .3rem; }
.pre { white-space: pre-wrap; }
.hist { list-style: none; margin: 0; padding: 0 0 0 .9rem; border-left: 2px solid var(--line); display: grid; gap: .6rem; }
</style>
