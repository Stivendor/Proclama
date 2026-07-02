import type { AttendanceRecord } from '@/types'
import { resolveValues } from './validation'

export interface AttendanceStats {
  count: number
  average: number
  peak: { total: number; label: string }
  /** % de cambio del promedio del último mes vs. el anterior; null si no hay 2 meses */
  monthlyGrowth: number | null
  /** predicador más frecuente; null si no hay ninguno registrado */
  topPreacher: { name: string; times: number } | null
}

function recordTotal(r: AttendanceRecord): number {
  return resolveValues(r).reduce((sum, v) => sum + (v || 0), 0)
}

/**
 * Estadísticas derivadas del historial de asistencia. Función pura.
 * `records` se asume deduplicado (un registro por culto).
 */
export function computeAttendanceStats(records: AttendanceRecord[]): AttendanceStats | null {
  if (records.length === 0) return null

  const totals = records.map(recordTotal)
  const average = Math.round(totals.reduce((a, b) => a + b, 0) / records.length)

  // Culto más concurrido
  let peakIdx = 0
  for (let i = 1; i < totals.length; i++) if (totals[i] > totals[peakIdx]) peakIdx = i
  const peakRec = records[peakIdx]
  const peak = { total: totals[peakIdx], label: peakRec.serviceName?.trim() || peakRec.date }

  // Predicador más frecuente
  const freq = new Map<string, number>()
  for (const r of records) {
    const p = r.preacher?.trim()
    if (p) freq.set(p, (freq.get(p) ?? 0) + 1)
  }
  let topPreacher: AttendanceStats['topPreacher'] = null
  for (const [name, times] of freq) {
    if (!topPreacher || times > topPreacher.times) topPreacher = { name, times }
  }

  // Crecimiento: promedio del último mes con datos vs. el mes previo con datos
  const byMonth = new Map<string, number[]>()
  records.forEach((r, i) => {
    const m = r.date.slice(0, 7)
    const arr = byMonth.get(m) ?? []
    arr.push(totals[i])
    byMonth.set(m, arr)
  })
  const months = [...byMonth.keys()].sort()
  let monthlyGrowth: number | null = null
  if (months.length >= 2) {
    const avgOf = (m: string) => {
      const a = byMonth.get(m)!
      return a.reduce((x, y) => x + y, 0) / a.length
    }
    const cur = avgOf(months[months.length - 1])
    const prev = avgOf(months[months.length - 2])
    if (prev > 0) monthlyGrowth = Math.round(((cur - prev) / prev) * 100)
  }

  return { count: records.length, average, peak, monthlyGrowth, topPreacher }
}
