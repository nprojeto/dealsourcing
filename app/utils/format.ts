const TZ = 'America/Sao_Paulo'

export function fmtDateTime(v?: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtDate(v?: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { timeZone: TZ })
}

export function fmtRelative(v?: string | null): string {
  if (!v) return ''
  const diff = (Date.now() - new Date(v).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`
  return fmtDate(v)
}

export function onlyDigits(v: string | null | undefined): string {
  return (v ?? '').replace(/\D+/g, '')
}

export function fmtPhone(v?: string | null): string {
  const d = onlyDigits(v)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length > 11) return `+${d.slice(0, d.length - 11)} ${fmtPhone(d.slice(-11))}`
  return d || '—'
}

export function fmtDocument(v?: string | null): string {
  const d = onlyDigits(v)
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return d || '—'
}

/** Máscara progressiva de telefone para inputs */
export function maskPhone(v: string): string {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Máscara progressiva de CPF/CNPJ */
export function maskDocument(v: string): string {
  const d = onlyDigits(v).slice(0, 14)
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
}

export function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '')).toUpperCase()
}

export function firstName(name?: string | null): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function fmtBRL(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? BRL.format(n) : '—'
}

/** Valor curto para tabelas e indicadores: R$ 3,3 mi · R$ 850 mil */
export function fmtBRLShort(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const f = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  if (abs >= 1e9) return `R$ ${f(n / 1e9)} bi`
  if (abs >= 1e6) return `R$ ${f(n / 1e6)} mi`
  if (abs >= 1e3) return `R$ ${f(n / 1e3)} mil`
  return fmtBRL(n)
}

export function fmtPct(fraction?: number | string | null, digits = 2): string {
  if (fraction === null || fraction === undefined || fraction === '') return '—'
  const n = Number(fraction) * 100
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`
}

export function fmtInt(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return '—'
  return Number(v).toLocaleString('pt-BR')
}

export function maskCep(v: string): string {
  const d = onlyDigits(v).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** ISO → valor para <input type="datetime-local"> no fuso local */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
export function fmtBytes(n?: number | null): string {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB`
  return `${(n / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}
/** "vence em 2 d" / "venceu há 3 h" */
export function fmtDue(iso?: string | null): string {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const t = abs < 3600_000 ? `${Math.max(1, Math.round(abs / 60_000))} min` : abs < 86400_000 ? `${Math.round(abs / 3600_000)} h` : `${Math.round(abs / 86400_000)} d`
  return diff >= 0 ? `vence em ${t}` : `venceu há ${t}`
}

/** Primeira letra maiúscula (sem afetar preposições: "novembro de 2026" → "Novembro de 2026") */
export function capFirst(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }

/** Data sem horário (AAAA-MM-DD) → DD/MM/AAAA, sem deslocamento de fuso. */
export function fmtDay(v?: string | null): string {
  if (!v) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fmtDate(v)
}
export function todayISO(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

/** Aplica a máscara e reescreve o campo na hora (impede digitar além do tamanho). */
export function masked(e: Event, fn: (v: string) => string): string {
  const el = e.target as HTMLInputElement
  const pos = el.selectionStart ?? el.value.length
  const atEnd = pos >= el.value.length
  const v = fn(el.value)
  if (el.value !== v) {
    el.value = v
    if (atEnd) el.setSelectionRange(v.length, v.length)
  }
  return v
}
