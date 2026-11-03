import { onlyDigits } from './format'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim())
}

export function isFullName(v: string): boolean {
  const s = v.trim().replace(/\s+/g, ' ')
  return s.length >= 3 && s.includes(' ')
}

export function isPhone(v: string): boolean {
  const d = onlyDigits(v)
  return d.length >= 10 && d.length <= 13
}

export function isCPF(v: string): boolean {
  const c = onlyDigits(v)
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false
  const calc = (len: number) => {
    let s = 0
    for (let i = 0; i < len; i++) s += Number(c[i]) * (len + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10])
}

export function isCNPJ(v: string): boolean {
  const c = onlyDigits(v)
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let s = 0
    for (let i = 0; i < len; i++) s += Number(c[i]) * (w[i] ?? 0)
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13])
}

export function passwordIssues(pw: string, min = 8): string[] {
  const issues: string[] = []
  if (pw.length < min) issues.push(`mínimo de ${min} caracteres`)
  if (!/[A-Za-z]/.test(pw)) issues.push('ao menos uma letra')
  if (!/\d/.test(pw)) issues.push('ao menos um número')
  return issues
}
