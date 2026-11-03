import type { Role } from '~/utils/labels'

declare module '#app' {
  interface PageMeta {
    /** public: livre · guest: só sem login · auth (padrão): exige conta ativa */
    access?: 'public' | 'guest' | 'auth'
    /** Perfis autorizados a abrir a página */
    roles?: Role[]
  }
}

export {}
