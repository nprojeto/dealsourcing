export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Cliente da Edge Function "api". Toda regra de negócio passa por aqui. */
export function useApi() {
  const cfg = useRuntimeConfig().public

  async function request<T = unknown>(method: Method, path: string, body?: unknown,
    query?: Record<string, string | number | undefined | null>, form?: FormData): Promise<T> {
    const base = `${String(cfg.supabaseUrl).replace(/\/+$/, '')}/functions/v1/api`
    const qs = query
      ? '?' + new URLSearchParams(Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])).toString()
      : ''
    const headers: Record<string, string> = {
      apikey: String(cfg.supabaseAnonKey),
    }
    if (!form) headers['Content-Type'] = 'application/json'
    try {
      const { data } = await useSupabase().auth.getSession()
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`
    } catch { /* sem sessão */ }

    let res: Response
    try {
      res = await fetch(base + path + (qs === '?' ? '' : qs), {
        method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      })
    } catch {
      throw new ApiError(0, 'network', 'Não foi possível conectar ao servidor. Verifique sua internet.')
    }
    let payload: Record<string, unknown> = {}
    try { payload = await res.json() } catch { /* resposta vazia */ }
    if (!res.ok) {
      const err = (payload.error ?? {}) as Record<string, unknown>
      throw new ApiError(res.status, String(err.code ?? 'error'),
        String(err.message ?? 'Ocorreu um erro. Tente novamente.'), err)
    }
    return payload as T
  }

  return {
    get: <T = unknown>(p: string, q?: Record<string, string | number | undefined | null>) => request<T>('GET', p, undefined, q),
    post: <T = unknown>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
    put: <T = unknown>(p: string, b?: unknown) => request<T>('PUT', p, b ?? {}),
    patch: <T = unknown>(p: string, b?: unknown) => request<T>('PATCH', p, b ?? {}),
    del: <T = unknown>(p: string) => request<T>('DELETE', p),
    upload: <T = unknown>(p: string, form: FormData) => request<T>('POST', p, undefined, undefined, form),
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return 'Ocorreu um erro inesperado.'
}
