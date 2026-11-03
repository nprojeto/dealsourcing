/** Caminho de arquivo da pasta public respeitando a subpasta de publicação. */
export function useAsset(path: string): string {
  const base = useRuntimeConfig().app.baseURL || '/'
  return base.replace(/\/+$/, '/') + path.replace(/^\/+/, '')
}
