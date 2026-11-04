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
  isps: number; isps_simulated: number; simulations: number; isps_formalized: number; formalizations: number
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
