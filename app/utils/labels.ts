export type Role = 'admin' | 'gestor_comercial' | 'colaborador' | 'parceiro' | 'isp_owner'
export type AccountStatus =
  | 'pending_verification' | 'pending_approval' | 'active'
  | 'rejected' | 'blocked' | 'inactive'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  gestor_comercial: 'Gestor comercial',
  colaborador: 'Colaborador interno',
  parceiro: 'Parceiro indicador',
  isp_owner: 'Proprietário de ISP',
}

export const STATUS_LABEL: Record<AccountStatus, string> = {
  pending_verification: 'E-mail não confirmado',
  pending_approval: 'Aguardando aprovação',
  active: 'Ativo',
  rejected: 'Rejeitado',
  blocked: 'Bloqueado',
  inactive: 'Desativado',
}

export const STATUS_TONE: Record<AccountStatus, string> = {
  pending_verification: 'plain',
  pending_approval: 'warning',
  active: 'success',
  rejected: 'danger',
  blocked: 'danger',
  inactive: '',
}

export const INTERNAL_ROLES: Role[] = ['admin', 'gestor_comercial', 'colaborador']
export const MANAGER_ROLES: Role[] = ['admin', 'gestor_comercial']
export const ALL_ROLES: Role[] = ['admin', 'gestor_comercial', 'colaborador', 'parceiro', 'isp_owner']

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  insert: 'Criação',
  update: 'Alteração',
  delete: 'Exclusão',
  login: 'Acesso',
  publish: 'Publicação',
  password_reset: 'Senha redefinida',
  resend_invite: 'Convite reenviado',
}

export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  profiles: 'Usuários',
  user_roles: 'Perfis de acesso',
  system_settings: 'Configurações',
  legal_documents: 'Documentos legais',
  isp_companies: 'Provedores',
  referral_codes: 'Códigos de indicação',
  commercial_opportunities: 'Oportunidades',
  simulator_parameter_versions: 'Parâmetros do simulador',
}

export const FIELD_LABEL: Record<string, string> = {
  full_name: 'Nome', email: 'E-mail', phone: 'Telefone', document: 'CPF/CNPJ',
  company_name: 'Empresa', additional_info: 'Informações adicionais', status: 'Status',
  status_reason: 'Justificativa', email_verified_at: 'E-mail confirmado em',
  approved_at: 'Aprovado em', role: 'Perfil', value: 'Valor',
  legal_name: 'Nome empresarial', trade_name: 'Nome fantasia', cnpj: 'CNPJ', city: 'Cidade', state: 'Estado',
  referral_code: 'Código de indicação', stage_key: 'Etapa', in_queue: 'Na fila', code: 'Código', active: 'Ativo',
}

export function homeFor(role: Role | null | undefined): string {
  if (!role) return '/entrar'
  return INTERNAL_ROLES.includes(role) ? '/crm' : '/portal'
}

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const

export const REGION_LABEL: Record<string, string> = {
  SE: 'Sudeste', SU: 'Sul', CO: 'Centro-Oeste', NE: 'Nordeste', NO: 'Norte',
}

export type IspStatus = 'registered' | 'simulated' | 'interest_formalized' | 'inactive'
export const ISP_STATUS_LABEL: Record<IspStatus, string> = {
  registered: 'Cadastrado',
  simulated: 'Simulação realizada',
  interest_formalized: 'Interesse formalizado',
  inactive: 'Inativo',
}
export const ISP_STATUS_TONE: Record<IspStatus, string> = {
  registered: 'plain', simulated: 'info', interest_formalized: 'success', inactive: '',
}

export type SimStatus = 'simulated' | 'interest_formalized'
export const SIM_STATUS_LABEL: Record<SimStatus, string> = {
  simulated: 'Simulação realizada',
  interest_formalized: 'Interesse formalizado',
}
export const SIM_STATUS_TONE: Record<SimStatus, string> = { simulated: 'info', interest_formalized: 'success' }

export const CRITERION_FIELD_LABEL: Record<string, string> = {
  client_base: 'Base de clientes',
  regularized: 'Regularização societária',
  poles_valid_pct: 'Postes com contrato válido',
  clt_pct: 'Equipe em CLT',
  pj_avg_fee: 'Honorário médio dos PJ',
  pj_weekly_hours: 'Carga horária semanal dos PJ',
  pj_days_week: 'Dias por semana dos PJ',
  pj_shift: 'PJ em escala',
  pj_invoice: 'PJ emitem nota fiscal',
  pj_contract_months: 'Tempo médio de contrato dos PJ',
  arpu: 'ARPU',
}
export const YES_NO_PARTIAL: Record<string, string> = { SIM: 'Sim', NAO: 'Não', PARCIAL: 'Parcialmente' }

/** Composição da equipe: "60% CLT" (ou o vínculo das simulações antigas). */
export function teamMix(s: { clt_pct?: number | null; employment_type?: string | null }): string {
  if (s.clt_pct === null || s.clt_pct === undefined) return s.employment_type ? `${s.employment_type} (vínculo predominante)` : '—'
  const c = Number(s.clt_pct)
  return c >= 100 ? '100% CLT' : `${c.toLocaleString('pt-BR')}% CLT · ${(100 - c).toLocaleString('pt-BR')}% PJ`
}

// ----- Fase 4: funil comercial -----
export const PRIORITY_LABEL: Record<string, string> = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta' }
export const PRIORITY_TONE: Record<string, string> = { baixa: 'plain', normal: '', alta: 'danger' }
export const ORIGIN_LABEL: Record<string, string> = { formalizacao: 'Formalização', prospeccao: 'Prospecção', manual: 'Cadastro do portal' }
export const ACTIVITY_KIND_LABEL: Record<string, string> = {
  ligacao: 'Ligação', whatsapp: 'WhatsApp', email: 'E-mail', visita: 'Visita', reuniao: 'Reunião', observacao: 'Observação', sistema: 'Sistema',
}
export const ACTIVITY_KIND_ICON: Record<string, string> = {
  ligacao: 'phone', whatsapp: 'send', email: 'mail', visita: 'building', reuniao: 'users', observacao: 'file', sistema: 'refresh',
}
export const OUTCOME_LABEL: Record<string, string> = {
  realizado: 'Contato realizado', sem_resposta: 'Sem resposta', retornar: 'Pediu retorno', sem_interesse: 'Sem interesse',
}
export const OUTCOME_TONE: Record<string, string> = { realizado: 'success', sem_resposta: 'warning', retornar: 'info', sem_interesse: 'danger' }

// ----- Fase 5: reuniões -----
export const MEETING_STATUS_LABEL: Record<string, string> = {
  aguardando_agendamento: 'Aguardando agendamento', agendada: 'Agendada', confirmada: 'Confirmada', realizada: 'Realizada',
  reagendada: 'Reagendada', cancelada: 'Cancelada', nao_compareceu: 'Não compareceu',
}
export const MEETING_STATUS_TONE: Record<string, string> = {
  aguardando_agendamento: 'plain', agendada: 'info', confirmada: 'success', realizada: 'navy', reagendada: 'warning', cancelada: '', nao_compareceu: 'danger',
}
export const MEETING_MODE_LABEL: Record<string, string> = { online: 'Online', presencial: 'Presencial', telefone: 'Telefone' }
export const MEETING_MODE_ICON: Record<string, string> = { online: 'video', presencial: 'map-pin', telefone: 'phone' }

// ----- Fase 6: comissões -----
export const COMMISSION_STATUS_LABEL: Record<string, string> = { gerada: 'Gerada', aprovada: 'Aprovada', paga: 'Paga', cancelada: 'Cancelada' }
export const COMMISSION_STATUS_TONE: Record<string, string> = { gerada: 'info', aprovada: 'warning', paga: 'success', cancelada: 'plain' }
export const COMMISSION_BASE_LABEL: Record<string, string> = {
  deal_value: 'Valor do negócio fechado', estimate_min: 'Estimativa mínima', estimate_avg: 'Estimativa média', estimate_max: 'Estimativa máxima',
}
export const BENEFICIARY_TYPE_LABEL: Record<string, string> = { internal: 'Equipe interna', external: 'Parceiro' }
export const COMMISSION_SOURCE_LABEL: Record<string, string> = { referral: 'Dono da indicação', assignee: 'Responsável pelo atendimento' }
export const PAY_METHOD_LABEL: Record<string, string> = { pix: 'Pix', transferencia: 'Transferência', boleto: 'Boleto', folha: 'Folha de pagamento', outro: 'Outro' }
export const REFERRAL_ORIGIN_LABEL: Record<string, string> = {
  any: 'Qualquer origem', external: 'Indicados por parceiro externo', internal: 'Indicados pela equipe interna', none: 'Cadastrados sem código de indicação',
}
