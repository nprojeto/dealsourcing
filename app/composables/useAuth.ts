import type { AccountStatus, Role } from '~/utils/labels'

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  document: string | null
  company_name: string | null
  additional_info: string | null
  status: AccountStatus
  status_reason: string | null
  email_verified_at: string | null
  approved_at: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
  roles: Role[]
  role: Role | null
}

/** Estado de sessão compartilhado por toda a aplicação. */
export function useAuth() {
  const profile = useState<Profile | null>('auth:profile', () => null)
  const ready = useState<boolean>('auth:ready', () => false)
  const api = useApi()

  const role = computed(() => profile.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'admin')
  const isManager = computed(() => role.value === 'admin' || role.value === 'gestor_comercial')
  const isInternal = computed(() => !!role.value && INTERNAL_ROLES.includes(role.value))

  async function refresh(): Promise<Profile | null> {
    if (!useSupabaseConfigured()) { profile.value = null; return null }
    const { data } = await useSupabase().auth.getSession()
    if (!data.session) { profile.value = null; return null }
    try {
      const r = await api.get<{ profile: Profile }>('/me')
      profile.value = r.profile
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        await useSupabase().auth.signOut()
      }
      profile.value = null
    }
    return profile.value
  }

  async function init() {
    if (ready.value) return
    await refresh()
    ready.value = true
  }

  async function signIn(email: string, password: string): Promise<Profile | null> {
    const { error } = await useSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('banned')) throw new ApiError(403, 'banned', 'Esta conta está bloqueada ou desativada. Contate o administrador.')
      if (msg.includes('invalid')) throw new ApiError(401, 'invalid_credentials', 'E-mail ou senha incorretos.')
      throw new ApiError(400, 'auth_error', 'Não foi possível entrar. Tente novamente.')
    }
    try { await api.post('/me/login') } catch { /* registro de acesso é complementar */ }
    return refresh()
  }

  async function signOut() {
    try { await useSupabase().auth.signOut() } catch { /* ignora */ }
    profile.value = null
    await navigateTo('/entrar')
  }

  /** Para onde o usuário deve ir conforme status e perfil. */
  function nextRoute(p: Profile | null = profile.value): string {
    if (!p) return '/entrar'
    if (!p.email_verified_at || p.status === 'pending_verification') {
      return `/confirmar-email?email=${encodeURIComponent(p.email)}`
    }
    if (p.status === 'pending_approval') return '/aguardando-aprovacao'
    if (p.status !== 'active') return '/conta-indisponivel'
    return homeFor(p.role)
  }

  return { profile, ready, role, isAdmin, isManager, isInternal, init, refresh, signIn, signOut, nextRoute }
}
