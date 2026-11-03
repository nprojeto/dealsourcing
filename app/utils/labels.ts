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
}

export const FIELD_LABEL: Record<string, string> = {
  full_name: 'Nome', email: 'E-mail', phone: 'Telefone', document: 'CPF/CNPJ',
  company_name: 'Empresa', additional_info: 'Informações adicionais', status: 'Status',
  status_reason: 'Justificativa', email_verified_at: 'E-mail confirmado em',
  approved_at: 'Aprovado em', role: 'Perfil', value: 'Valor',
}

export function homeFor(role: Role | null | undefined): string {
  if (!role) return '/entrar'
  return INTERNAL_ROLES.includes(role) ? '/crm' : '/portal'
}
