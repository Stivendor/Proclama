import { useState, useEffect, useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  ClipboardEdit, Users, Megaphone, Plus, Pencil, Trash2,
  Check, Tv2, BarChart2, Download, Lock, X, FileText
} from 'lucide-react'
import { db } from '@/db'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import { supabase } from '@/services/supabase'
import { parseLyrics } from '@/services/lyricsParser'
import { sendProjectionUpdate, openProjectionWindow } from '@/services/projection'
import type { ChurchNote, Notice, AttendanceBreakdown, AttendanceRecord } from '@/types'
import ConfirmDialog from '@/components/ConfirmDialog'
import { usePlan } from '@/hooks/usePlan'

/** Dexie permite varias filas con el mismo usuario y fecha; una sola “vigente” por par (userId+date). */
function dedupeAttendanceRecords(rows: AttendanceRecord[]): AttendanceRecord[] {
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

function attendanceRowKey(r: AttendanceRecord): string {
  return String(r.id ?? r.remoteId ?? `${r.date}-${r.updatedAt}`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

export function validateNoticeText(text: string): boolean {
  return text.trim().length > 0
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function totalAttendance(a?: AttendanceBreakdown): number {
  if (!a) return 0
  if (a.values?.length) {
    return a.values.reduce((sum, v) => sum + (v || 0), 0)
  }
  return (a.caballeros ?? 0) + (a.damas ?? 0) + (a.amigos ?? 0) + (a.ninos ?? 0)
}

/** Solo para el gráfico / export (misma forma que antes con `ChurchNote`). */
function attendanceRecordToChartNote(r: AttendanceRecord): ChurchNote {
  return {
    userId: r.userId,
    date: r.date,
    serviceName: r.serviceName,
    attendance: {
      values: r.values,
      caballeros: r.caballeros,
      damas: r.damas,
      amigos: r.amigos,
      ninos: r.ninos,
    },
    notices: [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ─── Attendance projection slide text ─────────────────────────────────────────

function buildAttendanceLyrics(values: number[], categories: string[], date: string, name?: string): string {
  const total = values.reduce((sum, v) => sum + v, 0)
  const title = name ? `${name}  ${formatDate(date)}` : `Asistencia  ${formatDate(date)}`
  const lines = [title]
  
  const maxLength = Math.max(10, ...categories.map(c => c.length))
  
  categories.forEach((cat, idx) => {
    lines.push(`${cat.padEnd(maxLength)}  ${values[idx] || 0}`)
  })
  lines.push(`Total`.padEnd(maxLength) + `  ${total}`)
  return lines.join('\n')
}

// ─── Mini bar chart (CSS only, no lib) ────────────────────────────────────────

function AttendanceChart({ records, categories, onEdit, onDelete }: { records: AttendanceRecord[], categories: string[], onEdit: (date: string) => void, onDelete: (r: AttendanceRecord) => void }) {
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const RECORDS_PER_PAGE = 7

  // Obtener lista de meses disponibles
  const availableMonths = Array.from(
    new Set(records.map(r => r.date.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a)) // Más recientes primero

  // Filtrar por mes seleccionado
  let filtered = records
  if (selectedMonth !== 'all') {
    filtered = filtered.filter(r => r.date.startsWith(selectedMonth))
  }

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date)) // Más recientes primero

  // Reset page when filter changes
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

  // Calcular max para los registros actuales (para el gráfico)
  const maxTotal = Math.max(
    ...currentRecords.map(r => {
      const vals = r.values?.length ? r.values : [r.caballeros ?? 0, r.damas ?? 0, r.amigos ?? 0, r.ninos ?? 0]
      return vals.reduce((sum, v) => sum + (v || 0), 0)
    }),
    1
  )

  // Formatear mes para mostrar
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${monthNames[parseInt(month) - 1]} ${year}`
  }

  return (
    <div className="attendance-chart">
      {/* Month filter */}
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

      {/* Bar chart - sincronizado con la página actual */}
      <div className="chart-bars-row">
        {currentRecords.map(r => {
          const values = r.values?.length ? r.values : [r.caballeros ?? 0, r.damas ?? 0, r.amigos ?? 0, r.ninos ?? 0]
          const t = values.reduce((sum, v) => sum + (v || 0), 0)
          const pct = Math.round((t / maxTotal) * 100)
          const colors = ['var(--blue)', 'var(--gold)', 'var(--green)', '#a78bfa', 'var(--text-secondary)', 'var(--orange)']
          // Calcular segmentos proporcionalmente
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
{/* Legend */}
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
      {/* Summary table */}
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
              const values = r.values?.length
                ? r.values
                : [r.caballeros ?? 0, r.damas ?? 0, r.amigos ?? 0, r.ninos ?? 0]
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

      {/* Pagination controls */}
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotesView() {
  const { canExportReports } = usePlan()
  const [selectedDate, setSelectedDate] = useState<string>(todayISO())
  const [showDashboard, setShowDashboard] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Service name
  const [serviceName, setServiceName] = useState('')

  // Attendance breakdown inputs (array for dynamic categories)
  const [att, setAtt] = useState<string[]>([])
  const [attError, setAttError] = useState('')
  /** Evita solapar upserts de asistencia (p. ej. doble clic o guardar mientras otra petición sigue en vuelo). */


  // Notices
  const [newNoticeText, setNewNoticeText] = useState('')
  const [noticeError, setNoticeError] = useState('')
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const { user, settings, updateSettings } = useAppStore(useShallow(s => ({ user: s.user, settings: s.settings, updateSettings: s.updateSettings })))
  const attendanceCategories = settings.attendanceCategories || ['Caballeros', 'Damas', 'Amigos', 'Niños']
  const { loadSong, projectionState, projectionWindow, setProjectionWindow } = useProjectionStore(useShallow(s => ({
    loadSong: s.loadSong,
    projectionState: { songTitle: s.state.songTitle, slides: s.state.slides },
    projectionWindow: s.projectionWindow,
    setProjectionWindow: s.setProjectionWindow,
  })))
  const userId = user?.id ?? 'guest'

  const churchNote = useLiveQuery(
    () => db.church_notes.where({ date: selectedDate, userId }).first(),
    [selectedDate, userId]
  )

  const attendanceRecord = useLiveQuery(
    async () => {
      const rows = await db.attendance_records.where({ date: selectedDate, userId }).toArray()
      if (rows.length === 0) return undefined
      return rows.reduce((a, b) =>
        new Date(a.updatedAt) >= new Date(b.updatedAt) ? a : b
      )
    },
    [selectedDate, userId]
  )

  const allAttendanceRows = useLiveQuery(
    () => db.attendance_records.where('userId').equals(userId).toArray(),
    [userId]
  )
  const isLoadingAttendance = attendanceRecord === undefined && allAttendanceRows === undefined
  const chartAttendanceRecords = useMemo(
    () => dedupeAttendanceRecords(allAttendanceRows ?? []),
    [allAttendanceRows]
  )

  const chartNotes = useMemo(
    () => chartAttendanceRecords.map(attendanceRecordToChartNote),
    [chartAttendanceRecords]
  )

  // Sync attendance inputs when the saved record changes
  useEffect(() => {
    const a = attendanceRecord
    setServiceName(a?.serviceName ?? '')
    // Support both new array format and legacy field format
    if (a?.values?.length) {
      setAtt(a.values.map(String))
    } else {
      // Legacy format: map fields to array
      setAtt([
        a != null ? String(a.caballeros) : '',
        a != null ? String(a.damas) : '',
        a != null ? String(a.amigos) : '',
        a != null ? String(a.ninos) : '',
      ])
    }
    setAttError('')
  }, [attendanceRecord, selectedDate])

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Solo avisos en `church_notes` (sin asistencia ni nombre de culto). */
  function buildNoticeNote(overrides: Partial<ChurchNote>): ChurchNote {
    const now = new Date().toISOString()
    const base = churchNote ?? {
      userId,
      date: selectedDate,
      notices: [],
      createdAt: now,
      updatedAt: now,
    }
    return {
      ...base,
      attendance: undefined,
      serviceName: undefined,
      updatedAt: now,
      ...overrides,
    } as ChurchNote
  }

  // Persist avisos locally
  async function persistNote(updated: ChurchNote) {
    const stripped: ChurchNote = {
      ...updated,
      attendance: undefined,
      serviceName: undefined,
    }
    await db.church_notes.put(stripped)
  }

  // ─── Attendance ──────────────────────────────────────────────────────────────

  function parseField(v: string): number {
    const n = parseInt(v.trim() || '0', 10)
    return isNaN(n) || n < 0 ? 0 : n
  }


  async function saveAttendance() {
    if (att.some(v => !validateAttendance(v))) {
      setAttError('Introduce solo números enteros positivos (o deja en blanco)')
      return
    }
    setAttError('')
    const breakdown: AttendanceBreakdown = {
      values: att.map(parseField),
      caballeros: parseField(att[0] || '0'),
      damas: parseField(att[1] || '0'),
      amigos: parseField(att[2] || '0'),
      ninos: parseField(att[3] || '0'),
    }
    const now = new Date().toISOString()
    const existingAr = attendanceRecord
    const row: AttendanceRecord = {
      ...existingAr,
      userId,
      date: selectedDate,
      values: breakdown.values,
      caballeros: breakdown.caballeros,
      damas: breakdown.damas,
      amigos: breakdown.amigos,
      ninos: breakdown.ninos,
      serviceName: serviceName.trim() || undefined,
      createdAt: existingAr?.createdAt ?? now,
      updatedAt: now,
    }
    await db.attendance_records.put(row)
  }

  function projectAttendance() {
    // Get values: new array format or legacy field format
    const values = attendanceRecord?.values?.length
      ? attendanceRecord.values
      : [
          attendanceRecord?.caballeros ?? 0,
          attendanceRecord?.damas ?? 0,
          attendanceRecord?.amigos ?? 0,
          attendanceRecord?.ninos ?? 0,
        ]
    const lyrics = buildAttendanceLyrics(values, attendanceCategories, selectedDate, attendanceRecord?.serviceName)
    // Calculate lines per slide based on categories (title + categories + total)
    const linesPerSlide = 1 + attendanceCategories.length + 1
    const slides = parseLyrics(lyrics, linesPerSlide)
    const currentState = useProjectionStore.getState().state
    const newState = {
      ...currentState,
      songId: null,
      songTitle: 'Asistencia',
      isBible: false,
      slides,
      currentSlide: 0,
    }
    useProjectionStore.setState({ state: newState })
    sendProjectionUpdate(newState)
    if (!projectionWindow || projectionWindow.closed) {
      const w = openProjectionWindow()
      setProjectionWindow(w)
    }
  }

  const isAttendanceProjected = projectionState.songTitle === 'Asistencia'
  const savedAttendanceBreakdown: AttendanceBreakdown | undefined = attendanceRecord
    ? {
      caballeros: attendanceRecord.caballeros,
      damas: attendanceRecord.damas,
      amigos: attendanceRecord.amigos,
      ninos: attendanceRecord.ninos,
    }
    : undefined
  const savedTotal = totalAttendance(savedAttendanceBreakdown)

  // ─── Delete History ─────────────────────────────────────────────────────────────────
  const [showDeleteHistoryConfirm, setShowDeleteHistoryConfirm] = useState(false)
  async function deleteAttendanceHistory() {
    await db.attendance_records.where('userId').equals(userId).delete()
    setShowDeleteHistoryConfirm(false)
  }

  // ─── Notices ─────────────────────────────────────────────────────────────────

  async function addNotice() {
    if (!validateNoticeText(newNoticeText)) {
      setNoticeError('El aviso no puede estar vacío')
      return
    }
    setNoticeError('')
    const now = new Date().toISOString()
    const newNotice: Notice = { id: crypto.randomUUID(), text: newNoticeText.trim(), createdAt: now, updatedAt: now }
    await persistNote(buildNoticeNote({ notices: [...(churchNote?.notices ?? []), newNotice] }))
    setNewNoticeText('')
    setShowAddForm(false)
  }

  async function confirmDeleteNotice() {
    if (!deletingNoticeId) return
    await persistNote(buildNoticeNote({ notices: (churchNote?.notices ?? []).filter(n => n.id !== deletingNoticeId) }))
    setDeletingNoticeId(null)
  }

  function startEdit(notice: Notice) {
    setEditingNoticeId(notice.id)
    setEditingText(notice.text)
    setNoticeError('')
  }

  async function confirmEditNotice() {
    if (!editingNoticeId || !validateNoticeText(editingText)) {
      setNoticeError('El aviso no puede estar vacío')
      return
    }
    setNoticeError('')
    const now = new Date().toISOString()
    await persistNote(buildNoticeNote({
      notices: (churchNote?.notices ?? []).map(n =>
        n.id === editingNoticeId ? { ...n, text: editingText.trim(), updatedAt: now } : n
      ),
    }))
    setEditingNoticeId(null)
    setEditingText('')
  }

  function cancelEdit() { setEditingNoticeId(null); setEditingText(''); setNoticeError('') }

  function projectNotice(notice: Notice) {
    loadSong({
      id: undefined, title: 'Aviso', artist: '',
      lyrics: notice.text, key: '', tags: [], language: 'Español',
      usageCount: 0, isPublic: false, isVerified: false,
      createdAt: new Date(), updatedAt: new Date(),
    }, false, 0)

    if (!projectionWindow || projectionWindow.closed) {
      const w = openProjectionWindow()
      setProjectionWindow(w)
    }
  }

  const isToday = selectedDate === todayISO()

  // ─── Export Report ───────────────────────────────────────────────────────────

  function handleExportClick() {
    if (!canExportReports) {
      setShowExportModal(true)
      return
    }
    exportAttendanceReport()
  }

  function exportAttendanceReport() {
    if (!canExportReports) return

    const attendanceNotes = [...chartNotes].sort((a, b) => a.date.localeCompare(b.date))

    if (attendanceNotes.length === 0) {
      alert('No hay datos de asistencia para exportar')
      return
    }

    // Calcular estadísticas
    const totals = attendanceNotes.map(n => totalAttendance(n.attendance))
    const avgTotal = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
    const maxTotal = totals.length > 0 ? Math.max(...totals) : 0
    const minTotal = totals.length > 0 ? Math.min(...totals) : 0

    // Calcular promedios por categoría (soporte array y legacy)
    const avgByCategory = attendanceCategories.map((_, idx) => {
      const values = attendanceNotes.map(n => {
        const a = n.attendance
        return a?.values?.[idx] ?? (
          idx === 0 ? a?.caballeros :
          idx === 1 ? a?.damas :
          idx === 2 ? a?.amigos :
          idx === 3 ? a?.ninos : 0
        ) ?? 0
      })
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    })

    // Generar CSV
    const rows = [
      ['Reporte de Asistencia - Proclama'],
      ['Generado:', new Date().toLocaleString('es-ES')],
      [''],
      ['ESTADÍSTICAS GENERALES'],
      ['Total de registros:', attendanceNotes.length],
      ['Promedio total:', avgTotal],
      ['Máximo total:', maxTotal],
      ['Mínimo total:', minTotal],
      [''],
      ['PROMEDIOS POR CATEGORÍA'],
      ...attendanceCategories.map((cat, idx) => [cat + ':', avgByCategory[idx]]),
      [''],
      ['DETALLE DE ASISTENCIA'],
      ['Fecha', 'Nombre del Culto', ...attendanceCategories, 'Total'],
      ...attendanceNotes.map(n => {
        const a = n.attendance!
        const recValues = a.values?.length
          ? a.values
          : [a.caballeros ?? 0, a.damas ?? 0, a.amigos ?? 0, a.ninos ?? 0]
        // Fill with zeros if fewer values than categories
        const values = [...recValues]
        while (values.length < attendanceCategories.length) values.push(0)
        return [
          formatDate(n.date),
          n.serviceName || '-',
          ...values,
          totalAttendance(a)
        ]
      })
    ]

    const csv = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-asistencia-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  /** Genera una imagen de gráfico usando Canvas para el PDF */
  function generateChartImage(data: number[], labels: string[]): string {
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    // Fondo
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const padding = 60
    const chartWidth = canvas.width - (padding * 2)
    const chartHeight = canvas.height - (padding * 2)
    const maxVal = Math.max(...data, 10) * 1.1

    // Ejes
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, canvas.height - padding)
    ctx.lineTo(canvas.width - padding, canvas.height - padding)
    ctx.stroke()

    // Barras
    const barSpacing = chartWidth / data.length
    const barWidth = barSpacing * 0.6

    data.forEach((val, i) => {
      const h = (val / maxVal) * chartHeight
      const x = padding + (i * barSpacing) + (barSpacing - barWidth) / 2
      const y = canvas.height - padding - h

      // Gradiente para la barra
      const grad = ctx.createLinearGradient(x, y, x, y + h)
      grad.addColorStop(0, '#3b82f6')
      grad.addColorStop(1, '#1d4ed8')
      ctx.fillStyle = grad
      
      // Dibujar barra redondeada (opcional, aquí simple)
      ctx.fillRect(x, y, barWidth, h)

      // Etiqueta de valor arriba
      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(val), x + barWidth / 2, y - 10)

      // Etiqueta de fecha abajo
      ctx.fillStyle = '#64748b'
      ctx.font = '12px sans-serif'
      ctx.save()
      ctx.translate(x + barWidth / 2, canvas.height - padding + 20)
      ctx.rotate(-Math.PI / 4)
      ctx.fillText(labels[i], 0, 0)
      ctx.restore()
    })

    return canvas.toDataURL('image/png')
  }

  function exportAttendancePDF() {
    if (!canExportReports) return
    const attendanceNotes = [...chartNotes].sort((a, b) => a.date.localeCompare(b.date))
    if (attendanceNotes.length === 0) return

    const doc = new jsPDF()
    const now = new Date()
    
    // Título y Estilo
    doc.setFillColor(30, 41, 59) // Dark blue header
    doc.rect(0, 0, 210, 40, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.text('REPORTE DE ASISTENCIA', 105, 20, { align: 'center' })
    doc.setFontSize(10)
    doc.text(`Generado: ${now.toLocaleString('es-ES')}`, 105, 30, { align: 'center' })

    // 1. RESUMEN ESTADÍSTICO
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(14)
    doc.text('RESUMEN GENERAL', 14, 55)
    
    const totals = attendanceNotes.map(n => totalAttendance(n.attendance))
    const avgTotal = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
    const maxTotal = Math.max(...totals)
    
    autoTable(doc, {
      startY: 60,
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de Cultos Registrados', String(attendanceNotes.length)],
        ['Promedio de Asistencia General', String(avgTotal)],
        ['Asistencia Máxima Registrada', String(maxTotal)],
      ],
      theme: 'striped',
      headStyles: { fillStyle: [212, 175, 55] } // Gold
    })

    // 2. GRÁFICO (Últimos 12 registros)
    const lastN = attendanceNotes.slice(-12)
    const chartData = lastN.map(n => totalAttendance(n.attendance))
    const chartLabels = lastN.map(n => n.date.slice(5).split('-').reverse().join('/'))
    const chartImg = generateChartImage(chartData, chartLabels)
    
    if (chartImg) {
      doc.text('TENDENCIA DE ASISTENCIA (Últimos cultos)', 14, (doc as any).lastAutoTable.finalY + 15)
      doc.addImage(chartImg, 'PNG', 14, (doc as any).lastAutoTable.finalY + 20, 180, 80)
    }

    // 3. TABLA DETALLADA
    doc.addPage()
    doc.text('DETALLE COMPLETO DE ASISTENCIA', 14, 20)
    
    const tableBody = attendanceNotes.map(n => {
      const a = n.attendance!
      const values = a.values?.length ? a.values : [a.caballeros ?? 0, a.damas ?? 0, a.amigos ?? 0, a.ninos ?? 0]
      return [
        formatDate(n.date),
        n.serviceName || '-',
        ...values,
        totalAttendance(a)
      ]
    })

    autoTable(doc, {
      startY: 25,
      head: [['Fecha', 'Culto', ...attendanceCategories, 'Total']],
      body: tableBody,
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 9 }
    })

    doc.save(`reporte-asistencia-${now.toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="notes-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ClipboardEdit size={20} color="var(--gold)" />
          <h1>Notas</h1>
          {isToday && <span className="date-today-badge">Hoy</span>}
        </div>
        <div className="header-actions">
          <button
            className={`btn-ghost${showDashboard ? ' active' : ''}`}
            onClick={() => setShowDashboard(v => !v)}
            title="Ver historial"
          >
            <BarChart2 size={15} />
            Historial
          </button>
          <input
            type="date"
            className="input"
            style={{ width: 'auto' }}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            aria-label="Seleccionar fecha"
          />
        </div>
      </div>

      <div className="notes-body">
        {/* ── Dashboard ── */}
        {showDashboard && (
          <section className="notes-section">
            <div className="notes-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={15} />
                <span>Historial de asistencia</span>
              </div>
              <div style={{ position: 'relative' }} ref={exportMenuRef}>
                <button
                  className={`btn-ghost${showExportMenu ? ' active' : ''}`}
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  title="Opciones de exportación"
                >
                  <Download size={14} />
                  Exportar
                  <X size={10} style={{ marginLeft: 4, transform: showExportMenu ? 'rotate(0deg)' : 'rotate(45deg)', transition: 'transform 0.2s' }} />
                </button>
                
                {showExportMenu && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 8,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                    zIndex: 100,
                    minWidth: 160,
                    overflow: 'hidden',
                    animation: 'fadeIn 0.2s ease-out'
                  }}>
                    <button
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 13,
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      onClick={() => {
                        setShowExportMenu(false)
                        !canExportReports ? setShowExportModal(true) : exportAttendancePDF()
                      }}
                    >
                      <FileText size={14} color="var(--gold)" />
                      <span>Reporte PDF</span>
                      {!canExportReports && <Lock size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                    </button>
                    <div style={{ height: 1, background: 'var(--border)' }} />
                    <button
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 13,
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      onClick={() => {
                        setShowExportMenu(false)
                        handleExportClick()
                      }}
                    >
                      <Download size={14} color="var(--blue)" />
                      <span>Datos CSV</span>
                      {!canExportReports && <Lock size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                    </button>
                  </div>
                )}
              </div>
              <button
                className="btn-ghost danger"
                onClick={() => setShowDeleteHistoryConfirm(true)}
                title="Borrar historial de asistencia"
              >
                <Trash2 size={14} />
                Borrar historial
              </button>
            </div>
            <AttendanceChart 
              records={chartAttendanceRecords} 
              categories={attendanceCategories} 
              onEdit={(date) => {
                setSelectedDate(date)
                setShowDashboard(false)
              }}
              onDelete={async (r) => {
                if (window.confirm(`¿Estás seguro de que deseas eliminar el registro del ${formatDate(r.date)}?`)) {
                  if (r.id) {
                    await db.attendance_records.delete(r.id)
                  } else {
                    await db.attendance_records.where({ date: r.date, userId: r.userId }).delete()
                  }
                }
              }}
            />
          </section>
        )}



        {/* ── Asistencia ── */}
        <section className="notes-section" aria-labelledby="attendance-label">
          <div className="notes-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={15} />
              <span id="attendance-label">Asistencia al culto</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {savedTotal > 0 }
              <button
                className={`btn-icon${isAttendanceProjected ? ' notice-project-active' : ''}`}
                onClick={projectAttendance}
                title="Proyectar asistencia"
                aria-label="Proyectar asistencia"
                disabled={savedTotal === 0}
              >
                <Tv2 size={15} />
              </button>
            </div>
          </div>

          <div className="attendance-service-row">
            <label htmlFor="service-name" className="attendance-field-label">Nombre del culto</label>
            <input
              id="service-name"
              type="text"
              className="input"
              placeholder="Ej. Culto Dominical, Vigilia, Ayuno..."
              value={serviceName}
              onChange={e => setServiceName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveAttendance()}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {attendanceCategories.map((cat, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                <input
                  type="text"
                  className="input"
                  value={cat}
                  onChange={e => {
                    const newCats = [...attendanceCategories]
                    newCats[idx] = e.target.value
                    updateSettings({ attendanceCategories: newCats })
                  }}
                  placeholder="Nombre"
                  style={{ flex: 1, fontWeight: 600 }}
                />
                <input
                  id={`att-${idx}`}
                  type="number"
                  className="input"
                  min={0}
                  step={1}
                  placeholder="#"
                  style={{ width: 60, textAlign: "center" }}
                  value={att[idx] ?? ''}
                  onChange={e => { 
                    const newAtt = [...att]
                    newAtt[idx] = e.target.value
                    setAtt(newAtt)
                    setAttError('') 
                  }}
                  onKeyDown={e => e.key === 'Enter' && saveAttendance()}
                />
                <button
                  className="btn-icon"
                  onClick={() => {
                    const newCats = attendanceCategories.filter((_, i) => i !== idx)
                    updateSettings({ attendanceCategories: newCats })
                  }}
                  disabled={attendanceCategories.length <= 1}
                  title="Eliminar categoría"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              className="btn-ghost"
              onClick={() => {
                const newCat = `Categoría ${attendanceCategories.length + 1}`
                updateSettings({ attendanceCategories: [...attendanceCategories, newCat] })
              }}
              title="Agregar nueva categoría"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px dashed var(--border)" }}
            >
              <Plus size={14} />
              Agregar
            </button>
          </div>

          <div className="attendance-total-row">
            <span className="attendance-total-label">Total</span>
            <span className="attendance-total-value">
              {isLoadingAttendance
                ? <span style={{ opacity: 0.3 }}>–</span>
                : (att || []).reduce((sum: number, v: string) => sum + parseField(v), 0)
              }
            </span>
            <button className="btn-primary" onClick={saveAttendance} style={{ marginLeft: 'auto' }}>
              <Check size={14} />
              Guardar
            </button>
          </div>

          {attError && (
            <p className="field-error" role="alert" aria-live="polite">{attError}</p>
          )}
        </section>

        {/* ── Avisos ── */}
        <section className="notes-section" aria-labelledby="notices-label">
          <div className="notes-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Megaphone size={15} />
              <span id="notices-label">Avisos</span>
            </div>
            <button
              className="btn-ghost"
              onClick={() => { setShowAddForm(v => !v); setNewNoticeText(''); setNoticeError('') }}
              aria-expanded={showAddForm}
            >
              <Plus size={14} />
              Añadir
            </button>
          </div>

          {showAddForm && (
            <div className="notice-form">
              <label htmlFor="new-notice-input" className="sr-only">Texto del aviso</label>
              <textarea
                id="new-notice-input"
                className="input"
                rows={3}
                placeholder="Escribe el aviso..."
                value={newNoticeText}
                onChange={e => { setNewNoticeText(e.target.value); setNoticeError('') }}
                autoFocus
              />
              {noticeError && !editingNoticeId && (
                <p className="field-error" role="alert" aria-live="polite">{noticeError}</p>
              )}
              <div className="notice-form-actions">
                <button className="btn-ghost" onClick={() => { setShowAddForm(false); setNewNoticeText(''); setNoticeError('') }}>Cancelar</button>
                <button className="btn-primary" onClick={addNotice}><Check size={14} />Añadir</button>
              </div>
            </div>
          )}

          {churchNote?.notices && churchNote.notices.length > 0 && (
            <ul className="notice-list" aria-label="Lista de avisos">
              {churchNote.notices.map(notice => {
                const isProjected = projectionState.songTitle === 'Aviso' &&
                  projectionState.slides.some(s => s.lines.join('\n') === notice.text.split('\n').slice(0, 4).join('\n'))
                return (
                  <li key={notice.id} className={`notice-item${isProjected ? ' notice-item--projected' : ''}`}>
                    {editingNoticeId === notice.id ? (
                      <div className="notice-form" style={{ flex: 1 }}>
                        <label htmlFor={`edit-${notice.id}`} className="sr-only">Editar aviso</label>
                        <textarea
                          id={`edit-${notice.id}`}
                          className="input"
                          rows={3}
                          value={editingText}
                          onChange={e => { setEditingText(e.target.value); setNoticeError('') }}
                          autoFocus
                        />
                        {noticeError && editingNoticeId === notice.id && (
                          <p className="field-error" role="alert" aria-live="polite">{noticeError}</p>
                        )}
                        <div className="notice-form-actions">
                          <button className="btn-ghost" onClick={cancelEdit}>Cancelar</button>
                          <button className="btn-primary" onClick={confirmEditNotice}><Check size={14} />Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="notice-text">{notice.text}</p>
                        <div className="notice-actions">
                          <button className="btn-icon" onClick={() => startEdit(notice)} aria-label="Editar" title="Editar"><Pencil size={14} /></button>
                          <button
                            className={`btn-icon${isProjected ? ' notice-project-active' : ''}`}
                            onClick={() => projectNotice(notice)}
                            aria-label="Proyectar" title="Proyectar"
                          ><Tv2 size={14} /></button>
                          <button className="btn-icon danger" onClick={() => setDeletingNoticeId(notice.id)} aria-label="Eliminar" title="Eliminar"><Trash2 size={14} /></button>
                        </div>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {(!churchNote?.notices || churchNote.notices.length === 0) && !showAddForm && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
              No hay avisos para esta fecha
            </p>
          )}
        </section>
      </div>

      {/* ── Diálogo de confirmación de borrado de historial de asistencia  ── */}
      {showDeleteHistoryConfirm && (
        <ConfirmDialog
          message="¿Borrar todo el historial de asistencia? Esta acción no se puede deshacer."
          onConfirm={deleteAttendanceHistory}
          onCancel={() => setShowDeleteHistoryConfirm(false)}
          confirmLabel="Borrar todo"
          danger
        />
      )}

      {deletingNoticeId && (
        <ConfirmDialog
          message="¿Eliminar este aviso? Esta acción no se puede deshacer."
          onConfirm={confirmDeleteNotice}
          onCancel={() => setDeletingNoticeId(null)}
          confirmLabel="Eliminar"
          danger
        />
      )}

      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={20} color="var(--gold)" />
                Función Premium
              </h2>
              <button className="btn-icon" onClick={() => setShowExportModal(false)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'rgba(212, 175, 55, 0.1)', borderRadius: 8, border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                  <FileText size={32} color="var(--gold)" style={{ flexShrink: 0 }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Exportación de Reportes (PDF y CSV)
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Genera reportes detallados en formato PDF (con gráficos) y CSV con estadísticas completas
                    </p>
                  </div>
                </div>

                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 12px' }}>Con la exportación de reportes puedes:</p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li><strong>Descargar reportes profesionales en PDF con gráficos de tendencia</strong></li>
                    <li>Exportar todos tus registros de asistencia en formato CSV</li>
                    <li>Ver estadísticas generales (promedios, máximos, mínimos)</li>
                    <li>Analizar tendencias por categoría (Caballeros, Damas, Amigos, Niños)</li>
                    <li>Importar los datos en Excel, Google Sheets o cualquier herramienta de análisis</li>
                    <li>Crear presentaciones de crecimiento para tu liderazgo</li>
                  </ul>
                </div>

                <div style={{ padding: 12, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  💡 Actualiza a Premium para desbloquear esta función y muchas más
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={() => setShowExportModal(false)}>
                  Cerrar
                </button>
                <button className="btn-primary" onClick={() => setShowExportModal(false)}>
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
