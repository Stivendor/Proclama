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
export function parseField(v: string): number {
  const n = parseInt(v.trim() || '0', 10)
  return isNaN(n) || n < 0 ? 0 : n
}

/**
 * Calculates total attendance from a breakdown (supports both array and legacy format).
 */
export function totalAttendance(a?: { values?: number[]; caballeros?: number; damas?: number; amigos?: number; ninos?: number }): number {
  if (!a) return 0
  if (a.values?.length) {
    return a.values.reduce((sum, v) => sum + (v || 0), 0)
  }
  return (a.caballeros ?? 0) + (a.damas ?? 0) + (a.amigos ?? 0) + (a.ninos ?? 0)
}

/**
 * Resolves an AttendanceRecord's values into a number array, handling both
 * new array format and legacy field format.
 */
export function resolveValues(r: AttendanceRecord): number[] {
  if (r.values?.length) return r.values
  return [r.caballeros ?? 0, r.damas ?? 0, r.amigos ?? 0, r.ninos ?? 0]
}
