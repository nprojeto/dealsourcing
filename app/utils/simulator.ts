// Tipos e utilidades do simulador (equipe interna)
export interface SimPenalty { key: string; label: string; input: unknown; band: string; penalty: number; applied: boolean }
export interface SimResult {
  parameter_version: number; formula: string; region_code: string
  base_min_per_client: number; base_max_per_client: number; base_min_total: number; base_max_total: number
  penalties: SimPenalty[]; total_penalty: number; value_min: number; value_max: number
}
export interface SimRange { min: number; max: number | null; penalty: number }
export interface SimOption { value: string; label: string; penalty: number }
export interface SimCriterion {
  key: string; label: string; type: 'ranges' | 'options'; unit?: string
  active: boolean; order: number; ranges?: SimRange[]; options?: SimOption[]
}
export interface SimRegion { code: string; name: string; min_per_client: number; max_per_client: number; states: string[] }
export interface SimParams { formula: 'additive' | 'multiplicative'; max_total_penalty: number; regions: SimRegion[]; criteria: SimCriterion[] }

/** Resultado exibido ao proprietário do ISP (quando liberado em Configurações). */
export interface OwnerResultData {
  value_min: number; value_max: number
}

// ----- Fase 3: desempenho (sem valores financeiros) -----
export interface Performance {
  isps: number; isps_simulated: number; simulations: number; isps_formalized: number; formalizations: number; meetings?: number
  opportunities_open: number; acquisitions: number; lost: number; assigned_open: number; last_activity: string | null
  monthly: { month: string; isps: number; simulations: number; formalizations: number }[]
}
export interface ReferredIsp {
  id: string; trade_name: string; city: string; state: string; status: string; created_at: string
  simulations: number; formalized: boolean; last_simulation_at: string | null; stage: string | null; won: boolean; lost: boolean
}
export interface PerformancePayload {
  performance: Performance; isps: ReferredIsp[]; code: string | null; owner_type: string | null; link: string | null
}

// ----- Fase 4: funil -----
export interface Stage {
  key: string; name: string; position: number; is_won: boolean; is_lost: boolean; active: boolean; is_system: boolean
  description: string | null; sla_days: number | null; requires_assignee: boolean; requires_note: boolean; count?: number
}
export interface OppItem {
  id: string; isp_id: string | null; stage_key: string; priority: string; origin: string; in_queue: boolean
  name: string; city: string | null; state: string | null; value_min: number | null; value_max: number | null; client_base: number | null
  assigned_to: string | null; created_by: string | null; referral_owner_id: string | null
  assignee: { id: string; full_name: string } | null; referrer: { full_name: string } | null; creator: { full_name: string } | null
  stage: { key: string; name: string; is_won: boolean; is_lost: boolean } | null
  next_step: string | null; due_at: string | null; last_activity_at: string; stage_entered_at: string
  first_formalized_at: string | null; lost_reason: string | null; notes: string | null
  prospect_name: string | null; prospect_cnpj: string | null; prospect_city: string | null; prospect_state: string | null
  prospect_contact: string | null; prospect_phone: string | null; prospect_email: string | null; client_base_estimate: number | null
  open: boolean; overdue: boolean; stale: boolean; days_in_stage: number; days_idle: number; created_at: string
  isp: { trade_name: string; legal_name: string; cnpj: string; city: string; state: string; phone: string; email: string; responsible_name: string; referral_code: string | null } | null
  deal_value?: number | null; deal_value_set_at?: string | null
}
export interface Assignee { id: string; full_name: string; email: string; role: string; open: number }

// ----- Fase 5: reuniões -----
export interface MeetingParticipant { id?: string; kind: 'interno' | 'provedor' | 'externo'; user_id?: string | null; name: string; email?: string | null; phone?: string | null }
export interface MeetingItem {
  id: string; opportunity_id: string; isp_id: string | null; title: string; status: string; starts_at: string | null; ends_at: string | null
  duration_min: number; mode: string; address: string | null; meeting_url: string | null; organizer_id: string; notes: string | null
  outcome: string | null; next_steps: string | null; cancel_reason: string | null; visible_to_isp: boolean; created_at: string
  organizer: { id: string; full_name: string; email: string; phone: string | null } | null
  participants: MeetingParticipant[]; opp_name: string; city: string | null; state: string | null; result_pending: boolean
}

// ----- Fase 6: comissões -----
export interface CommissionItem {
  id: string; opportunity_id: string; status: string; amount: number | null; paid_amount: number; balance: number | null
  beneficiary_id: string; beneficiary_type: string; source?: string; base?: string; base_value?: number | null
  generated_at: string; due_date: string | null; approved_at: string | null; cancelled_at: string | null; cancel_reason: string | null
  adjust_reason?: string | null; notes?: string | null; paid_at: string | null; overdue: boolean; opp_name: string
  rule_snapshot: { name?: string; percent?: number | null; fixed_amount?: number | null; max_amount?: number | null; payment_terms?: string | null; payment_days?: number }
  beneficiary: { id: string; full_name: string; email: string } | null; approver: { full_name: string } | null
  opp: { id: string; prospect_name: string | null; stage_key?: string; isp: { trade_name: string; city: string; state: string } | null } | null
}
export interface ForecastItem {
  opportunity_id: string; opp_name: string; stage: string; trigger: string; rule_id: string; rule_name: string
  beneficiary_id: string; beneficiary_name: string; beneficiary_type: string; base_value: number | null; estimated: boolean; amount: number | null
}
export interface CommissionSummary {
  gerada: { n: number; total: number }; aprovada: { n: number; total: number }; paga: { n: number; total: number }; cancelada: { n: number; total: number }
  pendente: { n: number; total: number }; prevista: { n: number; total: number }; paid_total: number; overdue: number
}
export interface CommissionRule {
  id: string; name: string; beneficiary_type: string; source: string; role: string | null; trigger_stage: string; base: string
  percent: number | null; fixed_amount: number | null; max_amount: number | null; payment_days: number; payment_terms: string | null
  valid_from: string | null; valid_to: string | null; active: boolean; commissions: number; trigger: { name: string } | null; referral_origin: string
}
export interface CommissionPayment {
  id: string; amount: number; paid_at: string; method: string; reference: string | null; notes?: string | null; created_at: string
  author?: { full_name: string } | null
  commission?: { id: string; beneficiary_type: string; beneficiary: { full_name: string } | null; opp: { prospect_name: string | null; isp: { trade_name: string } | null } | null }
}
