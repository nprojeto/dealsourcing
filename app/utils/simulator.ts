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
  value_min: number; value_max: number; total_penalty?: number
  factors?: { label: string; band: string; penalty: number }[]
}
