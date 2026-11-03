import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/** Indica se o frontend recebeu a URL e a chave pública do Supabase no build. */
export function useSupabaseConfigured(): boolean {
  const cfg = useRuntimeConfig().public
  return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey)
}

export function useSupabase(): SupabaseClient {
  if (client) return client
  const cfg = useRuntimeConfig().public
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error('Supabase não configurado: informe a URL e a chave anon em nuxt.config.ts.')
  }
  client = createClient(String(cfg.supabaseUrl), String(cfg.supabaseAnonKey), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'novale-auth',
    },
  })
  return client
}
