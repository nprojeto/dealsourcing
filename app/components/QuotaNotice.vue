<script setup lang="ts">
/** Cota mensal de simulações do provedor: aviso discreto ou tela de bloqueio. */
export interface OwnerQuota { used: number; limit: number; remaining: number; blocked: boolean; resets_at: string }
const props = defineProps<{ quota: OwnerQuota; ispId: string; mode: 'banner' | 'blocked' }>()
const pc = usePublicConfig()
onMounted(() => pc.load())
const contactEmail = computed(() => String(pc.setting('contact_email', '') || ''))
const contactPhone = computed(() => String(pc.setting('contact_phone', '') || ''))
const phoneDigits = computed(() => contactPhone.value.replace(/\D/g, ''))
const next = computed(() => fmtDay(props.quota.resets_at))
</script>

<template>
  <section v-if="mode === 'blocked'" class="card blocked">
    <span class="ic"><AppIcon name="lock" :size="26" /></span>
    <div class="eyebrow">Limite do mês atingido</div>
    <h2>Você já usou as {{ quota.limit }} simulações deste mês</h2>
    <p>As suas simulações estão guardadas. Escolha a que melhor representa o seu provedor e <b>formalize o interesse</b>: a equipe NOVALE entra em contato.</p>
    <NuxtLink :to="`/portal/provedor/${ispId}`" class="btn btn-lg btn-navy">Ver minhas simulações e formalizar</NuxtLink>
    <div v-if="contactEmail || contactPhone" class="contact">
      <span class="small muted">Precisa simular de novo? Fale com a equipe:</span>
      <a v-if="contactEmail" :href="`mailto:${contactEmail}`"><AppIcon name="mail" :size="16" /> {{ contactEmail }}</a>
      <a v-if="contactPhone" :href="`tel:${phoneDigits}`"><AppIcon name="phone" :size="16" /> {{ contactPhone }}</a>
    </div>
    <p class="small muted" style="margin:0">Novas simulações liberadas em {{ next }}.</p>
  </section>
  <div v-else class="banner" :class="{ last: quota.remaining <= 1 }">
    <AppIcon name="info" :size="16" />
    <span v-if="quota.remaining > 1">Você tem <b>{{ quota.remaining }} de {{ quota.limit }}</b> simulações disponíveis neste mês.</span>
    <span v-else-if="quota.remaining === 1">Esta é a sua <b>última simulação</b> deste mês. Depois, escolha uma das simulações para formalizar.</span>
  </div>
</template>

<style scoped>
.blocked { padding: 2.2rem 2rem; text-align: center; display: grid; gap: .8rem; justify-items: center; }
.blocked h2 { margin: 0; font-size: 1.45rem; }
.blocked p { margin: 0; max-width: 560px; color: var(--ink-2); }
.ic { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; background: var(--blue-100); color: var(--blue); }
.contact { display: flex; flex-wrap: wrap; gap: .4rem 1.1rem; justify-content: center; align-items: center; padding: .8rem 1rem; border-radius: var(--radius); background: var(--tint); }
.contact a { display: inline-flex; align-items: center; gap: .35rem; font-weight: 600; }
.banner { display: flex; align-items: center; gap: .5rem; padding: .65rem .9rem; border-radius: var(--radius); background: var(--tint); border: 1px solid var(--line); font-size: .88rem; color: var(--ink-2); }
.banner :deep(svg) { color: var(--blue); flex: none; }
.banner.last { border-color: #E9B949; background: #FFF8E6; }
</style>
