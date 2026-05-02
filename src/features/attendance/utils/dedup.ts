import type { AttendanceRecord } from '@/types'

/**
 * Dexie puede tener varias filas con el mismo (userId, date).
 * Mantiene solo la más reciente por par (userId + date).
 */
export function dedupeAttendanceRecords(rows: AttendanceRecord[]): AttendanceRecord[] {
  const map = new Map<string, AttendanceRecord>()
  for (const r of rows) {
    const k = `${r.userId}\u0000${r.date}`
    const prev = map.get(k)
    if (!prev || new Date(r.updatedAt) >= new Date(prev.updatedAt)) {
      map.set(k, r)
    }
  }
  return Array.from(map.values())
}

/**
 * Generates a stable React key for an attendance record row.
 */
export function attendanceRowKey(r: AttendanceRecord): string {
  return String(r.id ?? r.remoteId ?? `${r.date}-${r.updatedAt}`)
}
