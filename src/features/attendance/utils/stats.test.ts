import { describe, it, expect } from 'vitest'
import { computeAttendanceStats } from './stats'
import type { AttendanceRecord } from '@/types'

const rec = (date: string, values: number[], preacher?: string, serviceName?: string): AttendanceRecord => ({
  userId: 'u', date, values, preacher, serviceName, createdAt: date, updatedAt: date,
})

describe('computeAttendanceStats', () => {
  it('returns null for empty history', () => {
    expect(computeAttendanceStats([])).toBeNull()
  })

  it('computes average, peak, top preacher and monthly growth', () => {
    const s = computeAttendanceStats([
      rec('2026-05-04', [10, 10], 'Ana'),          // mayo total 20
      rec('2026-05-11', [20, 20], 'Beto'),         // mayo total 40  -> mayo avg 30
      rec('2026-06-07', [30, 30], 'Ana', 'Vigilia'), // junio total 60 -> junio avg 60
    ])!
    expect(s.count).toBe(3)
    expect(s.average).toBe(40)                     // (20+40+60)/3
    expect(s.peak.total).toBe(60)
    expect(s.peak.label).toBe('Vigilia')           // usa serviceName si existe
    expect(s.topPreacher).toEqual({ name: 'Ana', times: 2 })
    expect(s.monthlyGrowth).toBe(100)              // 60 vs 30 = +100%
  })

  it('null growth with a single month, null preacher when none set', () => {
    const s = computeAttendanceStats([rec('2026-06-07', [5])])!
    expect(s.monthlyGrowth).toBeNull()
    expect(s.topPreacher).toBeNull()
    expect(s.peak.label).toBe('2026-06-07')        // sin serviceName cae a la fecha
  })
})
