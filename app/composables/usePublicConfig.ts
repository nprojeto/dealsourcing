export interface LegalDoc { id: string; kind: 'terms' | 'privacy'; version: string; title: string; content: string; published_at: string }
export interface PublicConfig {
  settings: Record<string, unknown>
  legal: LegalDoc[]
  code_length: number
}

/** Configurações públicas (cadastros habilitados, contato, documentos legais vigentes). */
export function usePublicConfig() {
  const config = useState<PublicConfig | null>('public-config', () => null)
  const loading = useState<boolean>('public-config:loading', () => false)
  const error = useState<string>('public-config:error', () => '')

  async function load(force = false) {
    if ((config.value && !force) || loading.value) return config.value
    loading.value = true
    error.value = ''
    try {
      config.value = await useApi().get<PublicConfig>('/public/config')
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
    return config.value
  }

  const setting = <T = unknown>(key: string, fallback: T): T =>
    (config.value?.settings?.[key] as T | undefined) ?? fallback
  const legal = (kind: 'terms' | 'privacy') => config.value?.legal.find((d) => d.kind === kind)

  return { config, loading, error, load, setting, legal }
}
