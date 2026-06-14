import type { AttendanceRecord } from '@/types'

/**
 * Validates that an attendance value is a non-negative integer or empty string.
 */
export function validateAttendance(value: unknown): boolean {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return true // campo vacío = 0, permitido
    const num = Number(trimmed)
    if (!Number.isFinite(num)) return false
    return Number.isInteger(num) && num >= 0
  }
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0
  return false
}

/**
 * Validates that a service name is not empty.
 */
export function validateServiceName(name: string): boolean {
  return name.trim().length > 0
}

/**
 * Validates that a notice text is not empty.
 */
export function validateNoticeText(text: string): boolean {
  return text.trim().length > 0
}

/**
 * Returns today's date as YYYY-MM-DD in LOCAL timezone.
 */
export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Formats a date from ISO (YYYY-MM-DD) to DD/MM/YYYY.
 * Returns empty string on invalid input.
 */
export function formatDate(iso: string): string {
  const parts = iso?.split('-')
  if (!parts || parts.length !== 3) return ''
  const [y, m, d] = parts
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

/**
 * Parses a string field to a non-negative integer (0 if empty/NaN).
 */
export function parseField(v: string | undefined): number {
  const n = parseInt((v ?? '').trim() || '0', 10)
  return isNaN(n) || n < 0 ? 0 : n
}

/**
 * Calculates total attendance from a breakdown.
 */
export function totalAttendance(a?: { values?: number[] }): number {
  if (!a) return 0
  return (a.values ?? []).reduce((sum, v) => sum + (v || 0), 0)
}

/**
 * Resolves an AttendanceRecord's values into a number array.
 */
export function resolveValues(r: AttendanceRecord): number[] {
  return r.values ?? []
}
