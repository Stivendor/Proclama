import { useState, useEffect } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { AttendanceRecord } from '@/types'
import { formatDate, totalAttendance, resolveValues } from '../utils/validation'
import { attendanceRowKey } from '../utils/dedup'

interface AttendanceHistoryProps {
  records: AttendanceRecord[]
  categories: string[]
  onEdit: (date: string) => void
  onDelete: (r: AttendanceRecord) => void
}

export default function AttendanceHistory({ records, categories, onEdit, onDelete }: AttendanceHistoryProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const RECORDS_PER_PAGE = 7

  const availableMonths = Array.from(
    new Set(records.map(r => r.date.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a))

  let filtered = records
  if (selectedMonth !== 'all') {
    filtered = filtered.filter(r => r.date.startsWith(selectedMonth))
  }

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  useEffect(() => {
    setCurrentPage(0)
  }, [selectedMonth])

  if (sorted.length === 0) {
    if (selectedMonth !== 'all') {
      return (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
          No hay registros de asistencia para este mes
        </p>
      )
    }
    return (
      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
        Registra asistencia en varios cultos para ver el historial
      </p>
    )
  }

  const totalPages = Math.ceil(sorted.length / RECORDS_PER_PAGE)
  const startIdx = currentPage * RECORDS_PER_PAGE
  const endIdx = startIdx + RECORDS_PER_PAGE
  const currentRecords = sorted.slice(startIdx, endIdx)

  const maxTotal = Math.max(
    ...currentRecords.map(r => {
      const vals = resolveValues(r)
      return vals.reduce((sum, v) => sum + (v || 0), 0)
    }),
    1
  )

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${monthNames[parseInt(month) - 1]} ${year}`
  }

  return (
    <div className="attendance-chart">
      {availableMonths.length > 1 && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="month-filter" style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Filtrar por mes:
          </label>
          <select
            id="month-filter"
            className="input"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ width: 'auto', minWidth: 180 }}
          >
            <option value="all">Todos los meses ({records.length})</option>
            {availableMonths.map(month => {
              const count = records.filter(r => r.date.startsWith(month)).length
              return (
                <option key={month} value={month}>
                  {formatMonth(month)} ({count})
                </option>
              )
            })}
          </select>
        </div>
      )}

      <div className="chart-bars-row">
        {currentRecords.map(r => {
          const values = resolveValues(r)
          const t = values.reduce((sum, v) => sum + (v || 0), 0)
          const pct = Math.round((t / maxTotal) * 100)
          const colors = ['var(--blue)', 'var(--gold)', 'var(--green)', '#a78bfa', 'var(--text-secondary)', 'var(--orange)']
          const segments = values.map((v, idx) => {
            const color = colors[idx % colors.length]
            const heightPct = t > 0 ? Math.round((v / t) * 100) : 0
            return { color, height: heightPct }
          })
          return (
            <div key={attendanceRowKey(r)} className="chart-col">
              <span className="chart-value">{t}</span>
              <div className="chart-bar-wrap">
                <div className="chart-bar" style={{ height: `${Math.max(pct, 4)}%` }}>
                  {segments.map((seg, idx) => (
                    <div key={idx} className="chart-bar-segment" style={{ height: `${seg.height}%`, background: seg.color }} />
                  ))}
                </div>
              </div>
              <span className="chart-label">{r.date.slice(5)}</span>
            </div>
          )
        })}
      </div>

      <div className="chart-legend">
        {categories.map((cat, idx) => (
          <span key={idx}>
            <span className="legend-dot" style={{
              background: idx === 0 ? 'var(--blue)' :
                idx === 1 ? 'var(--gold)' :
                  idx === 2 ? 'var(--green)' :
                    idx === 3 ? '#a78bfa' :
                      'var(--text-secondary)'
            }} />
            {cat}
          </span>
        ))}
      </div>

      <div style={{ overflowX: 'auto', marginTop: 16, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Fecha</th>
              {categories.map((cat, idx) => (
                <th key={idx} style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600 }}>{cat}</th>
              ))}
              <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600 }}>Total</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {currentRecords.map((r, i) => {
              const values = resolveValues(r)
              const total = totalAttendance({ values })
              return (
                <tr key={attendanceRowKey(r)} style={{ borderBottom: i === currentRecords.length - 1 ? 'none' : '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                    {r.serviceName
                      ? <><strong>{r.serviceName}</strong><span style={{ fontSize: 11, color: "var(--text-muted)", display: 'block', marginTop: 2 }}>{formatDate(r.date)}</span></>
                      : formatDate(r.date)
                    }
                  </td>
                  {categories.map((_, idx) => (
                    <td key={idx} style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-primary)' }}>
                      {values[idx] ?? 0}
                    </td>
                  ))}
                  <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--gold)' }}>
                    {total}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      <button className="btn-icon" style={{ padding: 6 }} onClick={() => onEdit(r.date)} title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button className="btn-icon" style={{ padding: 6, color: 'var(--red)' }} onClick={() => onDelete(r)} title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button
            className="btn-ghost"
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            style={{ minWidth: 80 }}
          >
            Anterior
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Página {currentPage + 1} de {totalPages}
          </span>
          <button
            className="btn-ghost"
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            style={{ minWidth: 80 }}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
