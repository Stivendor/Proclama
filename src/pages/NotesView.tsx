import { useState, useEffect, useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ClipboardEdit, Users, Megaphone, Plus, Pencil, Trash2,
  Check, Tv2, BarChart2, Download, Lock
} from 'lucide-react'
import { db } from '@/db'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import { supabase, upsertChurchNote, upsertAttendance } from '@/services/supabase'
import { parseLyrics } from '@/services/lyricsParser'
import { sendProjectionUpdate } from '@/services/projection'
import type { ChurchNote, Notice, AttendanceBreakdown, AttendanceRecord } from '@/types'
import ConfirmDialog from '@/components/ConfirmDialog'
import { usePlan } from '@/hooks/usePlan'

const SUPABASE_SYNC_TIMEOUT_MS = 60_000

async function requireAuthUid(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) {
    throw new Error('No hay sesión activa. Inicia sesión para sincronizar con la nube.')
  }
  return session.user.id
}

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
  return (a.caballeros || 0) + (a.damas || 0) + (a.amigos || 0) + (a.ninos || 0)
}

/** Solo para el gráfico / export (misma forma que antes con `ChurchNote`). */
function attendanceRecordToChartNote(r: AttendanceRecord): ChurchNote {
  return {
    userId: r.userId,
    date: r.date,
    serviceName: r.serviceName,
    attendance: {
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

function buildAttendanceLyrics(a: AttendanceBreakdown, date: string, name?: string): string {
  const total = totalAttendance(a)
  const title = name ? `${name}  ${formatDate(date)}` : `Asistencia  ${formatDate(date)}`
  return [
    title,
    `Caballeros  ${a.caballeros || 0}`,
    `Damas       ${a.damas || 0}`,
    `Amigos      ${a.amigos || 0}`,
    `Niños       ${a.ninos || 0}`,
    `Total       ${total}`,
  ].join('\n')
}

// ─── Mini bar chart (CSS only, no lib) ────────────────────────────────────────

function AttendanceChart({ records }: { records: AttendanceRecord[] }) {
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
    ...currentRecords.map(r =>
      totalAttendance({ caballeros: r.caballeros, damas: r.damas, amigos: r.amigos, ninos: r.ninos })
    ),
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
          const a: AttendanceBreakdown = {
            caballeros: r.caballeros,
            damas: r.damas,
            amigos: r.amigos,
            ninos: r.ninos,
          }
          const t = totalAttendance(a)
          const pct = Math.round((t / maxTotal) * 100)
          const cab = t > 0 ? Math.round(((a.caballeros || 0) / t) * 100) : 0
          const dam = t > 0 ? Math.round(((a.damas || 0) / t) * 100) : 0
          const ami = t > 0 ? Math.round(((a.amigos || 0) / t) * 100) : 0
          const nin = t > 0 ? Math.round(((a.ninos || 0) / t) * 100) : 0
          return (
            <div key={attendanceRowKey(r)} className="chart-col">
              <span className="chart-value">{t}</span>
              <div className="chart-bar-wrap">
                <div className="chart-bar" style={{ height: `${Math.max(pct, 4)}%` }}>
                  <div className="chart-bar-segment" style={{ height: `${nin}%`, background: '#a78bfa' }} />
                  <div className="chart-bar-segment" style={{ height: `${ami}%`, background: 'var(--green)' }} />
                  <div className="chart-bar-segment" style={{ height: `${dam}%`, background: 'var(--gold)' }} />
                  <div className="chart-bar-segment" style={{ height: `${cab}%`, background: 'var(--blue)' }} />
                </div>
              </div>
              <span className="chart-label">{r.date.slice(5)}</span>
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="chart-legend">
        <span><span className="legend-dot" style={{ background: 'var(--blue)' }} />Cab.</span>
        <span><span className="legend-dot" style={{ background: 'var(--gold)' }} />Damas</span>
        <span><span className="legend-dot" style={{ background: 'var(--green)' }} />Amigos</span>
        <span><span className="legend-dot" style={{ background: '#a78bfa' }} />Niños</span>
      </div>
      {/* Summary table */}
      <div className="chart-table">
        <div className="chart-table-header">
          <span>Fecha</span>
          <span>Cab.</span>
          <span>Damas</span>
          <span>Amigos</span>
          <span>Niños</span>
          <span>Total</span>
        </div>
        {currentRecords.map(r => {
          const a: AttendanceBreakdown = {
            caballeros: r.caballeros,
            damas: r.damas,
            amigos: r.amigos,
            ninos: r.ninos,
          }
          return (
            <div key={attendanceRowKey(r)} className="chart-table-row">
              <span>
                {r.serviceName
                  ? <><strong style={{ color: 'var(--text-primary)' }}>{r.serviceName}</strong><br /><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(r.date)}</span></>
                  : formatDate(r.date)
                }
              </span>
              <span>{a.caballeros || 0}</span>
              <span>{a.damas || 0}</span>
              <span>{a.amigos || 0}</span>
              <span>{a.ninos || 0}</span>
              <span className="chart-table-total">{totalAttendance(a)}</span>
            </div>
          )
        })}
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

  // Service name
  const [serviceName, setServiceName] = useState('')

  // Attendance breakdown inputs
  const [att, setAtt] = useState({ caballeros: '', damas: '', amigos: '', ninos: '' })
  const [attError, setAttError] = useState('')
  const [cloudSyncError, setCloudSyncError] = useState('')
  const [syncing, setSyncing] = useState(false)
  /** Evita solapar upserts de asistencia (p. ej. doble clic o guardar mientras otra petición sigue en vuelo). */
  const attendanceSyncQueueRef = useRef(Promise.resolve())

  // Notices
  const [newNoticeText, setNewNoticeText] = useState('')
  const [noticeError, setNoticeError] = useState('')
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const { user } = useAppStore(useShallow(s => ({ user: s.user })))
  const { loadSong, projectionState } = useProjectionStore(useShallow(s => ({
    loadSong: s.loadSong,
    projectionState: { songTitle: s.state.songTitle, slides: s.state.slides }
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
    setAtt({
      caballeros: a != null ? String(a.caballeros) : '',
      damas: a != null ? String(a.damas) : '',
      amigos: a != null ? String(a.amigos) : '',
      ninos: a != null ? String(a.ninos) : '',
    })
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

  // Persist avisos locally and sync church_notes to Supabase if authenticated
  async function persistNote(updated: ChurchNote) {
    const stripped: ChurchNote = {
      ...updated,
      attendance: undefined,
      serviceName: undefined,
    }
    const localResult = await db.church_notes.put(stripped)
    const localId = stripped.id ?? localResult

    if (user?.id && user.id !== 'guest') {
      setCloudSyncError('')
      setSyncing(true)
      try {
        const authUid = await requireAuthUid()
        const forSync = { ...stripped, userId: authUid }
        const syncResult = await runWithTimeout(upsertChurchNote(forSync), SUPABASE_SYNC_TIMEOUT_MS)
        if (syncResult.remoteId && localId) {
          await db.church_notes.update(localId, { remoteId: syncResult.remoteId })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al sincronizar avisos'
        setCloudSyncError(msg)
        console.warn('Failed to sync note to Supabase:', err)
      } finally {
        setSyncing(false)
      }
    }
  }

  // ─── Attendance ──────────────────────────────────────────────────────────────

  function parseField(v: string): number {
    const n = parseInt(v.trim() || '0', 10)
    return isNaN(n) || n < 0 ? 0 : n
  }

  async function runWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timeoutId: number | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error('Supabase request timed out')), ms)
    })
    try {
      return await Promise.race([promise, timeoutPromise]) as T
    } finally {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }

  async function saveAttendance() {
    const fields = [att.caballeros, att.damas, att.amigos, att.ninos]
    if (fields.some(f => !validateAttendance(f))) {
      setAttError('Introduce solo números enteros positivos (o deja en blanco)')
      return
    }
    setAttError('')
    const breakdown: AttendanceBreakdown = {
      caballeros: parseField(att.caballeros),
      damas: parseField(att.damas),
      amigos: parseField(att.amigos),
      ninos: parseField(att.ninos),
    }
    const now = new Date().toISOString()
    const existingAr = attendanceRecord
    const row: AttendanceRecord = {
      ...existingAr,
      userId,
      date: selectedDate,
      caballeros: breakdown.caballeros,
      damas: breakdown.damas,
      amigos: breakdown.amigos,
      ninos: breakdown.ninos,
      serviceName: serviceName.trim() || undefined,
      createdAt: existingAr?.createdAt ?? now,
      updatedAt: now,
    }
    const localResult = await db.attendance_records.put(row)
    const localId = row.id ?? (localResult as number)

    if (user?.id && user.id !== 'guest') {
      setCloudSyncError('')
      setSyncing(true)
      const syncTask = async () => {
        const authUid = await requireAuthUid()
        const syncResult = await runWithTimeout(
          upsertAttendance(
            authUid,
            selectedDate,
            breakdown,
            row.serviceName,
            existingAr?.remoteId
          ),
          SUPABASE_SYNC_TIMEOUT_MS
        )
        if (syncResult.remoteId && localId) {
          await db.attendance_records.update(localId, { remoteId: syncResult.remoteId })
        }
      }
      const queued = attendanceSyncQueueRef.current.then(syncTask)
      attendanceSyncQueueRef.current = queued.catch(() => undefined)
      try {
        await queued
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al sincronizar asistencia'
        setCloudSyncError(msg)
        console.warn('Failed to sync attendance to Supabase:', err)
      } finally {
        setSyncing(false)
      }
    }
  }

  function projectAttendance() {
    const a = attendanceRecord
      ? {
        caballeros: attendanceRecord.caballeros,
        damas: attendanceRecord.damas,
        amigos: attendanceRecord.amigos,
        ninos: attendanceRecord.ninos,
      }
      : { caballeros: 0, damas: 0, amigos: 0, ninos: 0 }
    const lyrics = buildAttendanceLyrics(a, selectedDate, attendanceRecord?.serviceName)
    // Use linesPerSlide=6 so all 6 lines stay in one slide
    const slides = parseLyrics(lyrics, 6)
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
    })
    useProjectionStore.getState().updateTheme({ maxFontSize: 80 })
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
    const maxTotal = Math.max(...totals)
    const minTotal = Math.min(...totals)

    const allCab = attendanceNotes.map(n => n.attendance!.caballeros || 0)
    const allDam = attendanceNotes.map(n => n.attendance!.damas || 0)
    const allAmi = attendanceNotes.map(n => n.attendance!.amigos || 0)
    const allNin = attendanceNotes.map(n => n.attendance!.ninos || 0)

    const avgCab = Math.round(allCab.reduce((a, b) => a + b, 0) / allCab.length)
    const avgDam = Math.round(allDam.reduce((a, b) => a + b, 0) / allDam.length)
    const avgAmi = Math.round(allAmi.reduce((a, b) => a + b, 0) / allAmi.length)
    const avgNin = Math.round(allNin.reduce((a, b) => a + b, 0) / allNin.length)

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
      ['Caballeros:', avgCab],
      ['Damas:', avgDam],
      ['Amigos:', avgAmi],
      ['Niños:', avgNin],
      [''],
      ['DETALLE DE ASISTENCIA'],
      ['Fecha', 'Nombre del Culto', 'Caballeros', 'Damas', 'Amigos', 'Niños', 'Total'],
      ...attendanceNotes.map(n => {
        const a = n.attendance!
        return [
          formatDate(n.date),
          n.serviceName || '-',
          a.caballeros || 0,
          a.damas || 0,
          a.amigos || 0,
          a.ninos || 0,
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
        {cloudSyncError && (
          <p
            className="field-error"
            role="alert"
            style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.35)' }}
          >
            <strong>No se guardó en la nube.</strong> {cloudSyncError}
          </p>
        )}

        {/* ── Dashboard ── */}
        {showDashboard && (
          <section className="notes-section">
            <div className="notes-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={15} />
                <span>Historial de asistencia</span>
              </div>
              <button
                className="btn-ghost"
                onClick={handleExportClick}
                title={!canExportReports ? 'Función premium — actualiza tu plan' : 'Exportar reporte detallado'}
              >
                <Download size={14} />
                Exportar CSV
                {!canExportReports && <Lock size={12} style={{ marginLeft: 4, opacity: 0.7 }} />}
              </button>
            </div>
            <AttendanceChart records={chartAttendanceRecords} />
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
              {savedTotal > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Total: <strong style={{ color: 'var(--text-primary)' }}>{savedTotal}</strong>
                </span>
              )}
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

          <div className="attendance-grid">
            {(['caballeros', 'damas', 'amigos', 'ninos'] as const).map(field => (
              <div key={field} className="attendance-field">
                <label htmlFor={`att-${field}`} className="attendance-field-label">
                  {field === 'ninos' ? 'Niños' : field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <input
                  id={`att-${field}`}
                  type="number"
                  className="input"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={att[field]}
                  onChange={e => { setAtt(prev => ({ ...prev, [field]: e.target.value })); setAttError('') }}
                  onKeyDown={e => e.key === 'Enter' && saveAttendance()}
                />
              </div>
            ))}
          </div>

          <div className="attendance-total-row">
            <span className="attendance-total-label">Total</span>
            <span className="attendance-total-value">
              {isLoadingAttendance
                ? <span style={{ opacity: 0.3 }}>–</span>
                : parseField(att.caballeros) + parseField(att.damas) + parseField(att.amigos) + parseField(att.ninos)
              }
            </span>
            <button className="btn-primary" onClick={saveAttendance} style={{ marginLeft: 'auto' }} disabled={syncing}>
              {syncing ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14, marginRight: 4 }} />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Guardar
                </>
              )}
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
                  <Download size={32} color="var(--gold)" style={{ flexShrink: 0 }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Exportación de Reportes
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Genera reportes detallados en formato CSV con estadísticas completas
                    </p>
                  </div>
                </div>

                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 12px' }}>Con la exportación de reportes puedes:</p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>Descargar todos tus registros de asistencia en formato CSV</li>
                    <li>Ver estadísticas generales (promedios, máximos, mínimos)</li>
                    <li>Analizar tendencias por categoría (Caballeros, Damas, Amigos, Niños)</li>
                    <li>Importar los datos en Excel, Google Sheets o cualquier herramienta de análisis</li>
                    <li>Crear gráficos personalizados y presentaciones</li>
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
    </div>
  )
}
