import type { AttendanceRecord } from '@/types'

/**
 * Retorna una clave única para identificar un registro por fecha y usuario.
 */
export function attendanceRowKey(r: AttendanceRecord): string {
  return `${r.date}_${r.userId}_${r.serviceName || ''}`
}

/**
 * Elimina duplicados de una lista de registros, manteniendo solo el más reciente 
 * (basado en updatedAt) para cada combinación de fecha y usuario.
 */
export function dedupeAttendanceRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  const map = new Map<string, AttendanceRecord>()
  
  // Ordenar por fecha descendente
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))

  for (const r of sorted) {
    const key = attendanceRowKey(r)
    const existing = map.get(key)
    
    if (!existing || new Date(r.updatedAt) > new Date(existing.updatedAt)) {
      map.set(key, r)
    }
  }

  return Array.from(map.values())
}
