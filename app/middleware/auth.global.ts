import type { Role } from '~/utils/labels'

/**
 * Controle de acesso por rota. Cada página declara em definePageMeta:
 *   access: 'public' | 'guest' | 'auth'   (padrão: 'auth')
 *   roles:  Role[]                          (opcional)
 * O backend também valida cada operação — esta camada só orienta a navegação.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const access = (to.meta.access as string | undefined) ?? 'auth'
  if (access === 'public') return

  const auth = useAuth()
  await auth.init()
  const p = auth.profile.value

  if (access === 'guest') {
    if (p && p.status === 'active' && p.email_verified_at) return navigateTo(auth.nextRoute(p))
    return
  }

  if (!p) return navigateTo({ path: '/entrar', query: { r: to.fullPath } })

  const target = auth.nextRoute(p)
  if (p.status !== 'active' || !p.email_verified_at) return navigateTo(target)

  const roles = to.meta.roles as Role[] | undefined
  if (roles && (!p.role || !roles.includes(p.role))) return navigateTo(target)
})
