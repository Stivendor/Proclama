import type { AttendanceRecord } from '@/types'
import { computeAttendanceStats } from '../utils/stats'
import { formatDate } from '../utils/validation'

export default function AttendanceStats({ records }: { records: AttendanceRecord[] }) {
  const stats = computeAttendanceStats(records)
  if (!stats) return null

  const { count, average, peak, monthlyGrowth, topPreacher } = stats
  const peakLabel = /^\d{4}-\d{2}-\d{2}$/.test(peak.label) ? formatDate(peak.label) : peak.label

  return (
    <div className="attendance-stats">
      <div className="stat-card">
        <span className="stat-label">Promedio</span>
        <span className="stat-value">{average}</span>
        <span className="stat-sub">{count} {count === 1 ? 'culto' : 'cultos'}</span>
      </div>

      {monthlyGrowth !== null && (
        <div className="stat-card">
          <span className="stat-label">Vs. mes anterior</span>
          <span className="stat-value" style={{ color: monthlyGrowth >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {monthlyGrowth >= 0 ? '+' : ''}{monthlyGrowth}%
          </span>
          <span className="stat-sub">promedio mensual</span>
        </div>
      )}

      <div className="stat-card">
        <span className="stat-label">Más concurrido</span>
        <span className="stat-value">{peak.total}</span>
        <span className="stat-sub" title={peakLabel}>{peakLabel}</span>
      </div>

      {topPreacher && (
        <div className="stat-card">
          <span className="stat-label">Predicador frecuente</span>
          <span className="stat-value" style={{ fontSize: 16 }} title={topPreacher.name}>{topPreacher.name}</span>
          <span className="stat-sub">{topPreacher.times} {topPreacher.times === 1 ? 'vez' : 'veces'}</span>
        </div>
      )}
    </div>
  )
}
