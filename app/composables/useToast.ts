export interface Toast { id: number; tone: 'success' | 'danger' | 'info' | 'warning'; text: string }

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])
  let seq = 0
  function push(tone: Toast['tone'], text: string, ms = 4500) {
    const id = Date.now() + seq++
    toasts.value = [...toasts.value, { id, tone, text }]
    setTimeout(() => dismiss(id), ms)
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  return {
    toasts,
    dismiss,
    success: (t: string) => push('success', t),
    error: (t: string) => push('danger', t, 6500),
    info: (t: string) => push('info', t),
    warning: (t: string) => push('warning', t),
  }
}
