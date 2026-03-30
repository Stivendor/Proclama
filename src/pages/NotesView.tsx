import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ClipboardEdit, Users, Megaphone, Plus, Pencil, Trash2,
  Check, X, AlertCircle, Tv2, BarChart2
} from 'lucide-react'
import { db } from '@/db'
import { useAppStore, useProjectionStore } from '@/stores'
import { upsertAttendance } from '@/services/supabase'
import { parseLyrics } from '@/services/lyricsParser'
import { sendProjectionUpdate } from '@/services/projection'
import type { ChurchNote, Notice, AttendanceBreakdown } from '@/types'
import ConfirmDialog from '@/components/ConfirmDialog'

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

function AttendanceChart({ notes }: { notes: ChurchNote[] }) {
  const sorted = [...notes]
    .filter(n => n.attendance)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12)

  if (sorted.length === 0) return (
    <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
      Registra asistencia en varios cultos para ver el historial
    </p>
  )

  const maxTotal = Math.max(...sorted.map(n => totalAttendance(n.attendance)), 1)

  return (
    <div className="attendance-chart">
      {/* Bar chart */}
      <div className="chart-bars-row">
        {sorted.map(n => {
          const t = totalAttendance(n.attendance)
          const pct = Math.round((t / maxTotal) * 100)
          const a = n.attendance!
          const cab  = t > 0 ? Math.round(((a.caballeros||0)/t)*100) : 0
          const dam  = t > 0 ? Math.round(((a.damas||0)/t)*100) : 0
          const ami  = t > 0 ? Math.round(((a.amigos||0)/t)*100) : 0
          const nin  = t > 0 ? Math.round(((a.ninos||0)/t)*100) : 0
          return (
            <div key={n.date} className="chart-col">
              <span className="chart-value">{t}</span>
              <div className="chart-bar-wrap">
                <div className="chart-bar" style={{ height: `${Math.max(pct, 4)}%` }}>
                  <div className="chart-bar-segment" style={{ height: `${nin}%`,  background: '#a78bfa' }} />
                  <div className="chart-bar-segment" style={{ height: `${ami}%`,  background: 'var(--green)' }} />
                  <div className="chart-bar-segment" style={{ height: `${dam}%`,  background: 'var(--gold)' }} />
                  <div className="chart-bar-segment" style={{ height: `${cab}%`,  background: 'var(--blue)' }} />
                </div>
              </div>
              <span className="chart-label">{n.date.slice(5)}</span>
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
        {[...sorted].reverse().map(n => {
          const a = n.attendance!
          return (
            <div key={n.date} className="chart-table-row">
              <span>
                {n.serviceName
                  ? <><strong style={{ color: 'var(--text-primary)' }}>{n.serviceName}</strong><br /><span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(n.date)}</span></>
                  : formatDate(n.date)
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
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotesView() {
  const [selectedDate, setSelectedDate] = useState<string>(todayISO())
  const [syncError, setSyncError] = useState(false)
  const [syncOk, setSyncOk] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)

  // Service name
  const [serviceName, setServiceName] = useState('')

  // Attendance breakdown inputs
  const [att, setAtt] = useState({ caballeros: '', damas: '', amigos: '', ninos: '' })
  const [attError, setAttError] = useState('')

  // Notices
  const [newNoticeText, setNewNoticeText] = useState('')
  const [noticeError, setNoticeError] = useState('')
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const { user } = useAppStore()
  const { loadSong, state: projectionState } = useProjectionStore()
  const userId = user?.id ?? 'guest'

  const note = useLiveQuery(
    () => db.church_notes.where({ date: selectedDate, userId }).first(),
    [selectedDate, userId]
  )

  // All notes for dashboard
  const allNotes = useLiveQuery(
    () => db.church_notes.where('userId').equals(userId).toArray(),
    [userId]
  )

  // Sync attendance inputs when note changes
  useEffect(() => {
    const a = note?.attendance
    setServiceName(note?.serviceName ?? '')
    setAtt({
      caballeros: a?.caballeros != null ? String(a.caballeros) : '',
      damas:      a?.damas      != null ? String(a.damas)      : '',
      amigos:     a?.amigos     != null ? String(a.amigos)     : '',
      ninos:      a?.ninos      != null ? String(a.ninos)      : '',
    })
    setAttError('')
  }, [note, selectedDate])

  useEffect(() => {
    if (!syncError) return
    const t = setTimeout(() => setSyncError(false), 5000)
    return () => clearTimeout(t)
  }, [syncError])

  useEffect(() => {
    if (!syncOk) return
    const t = setTimeout(() => setSyncOk(false), 3000)
    return () => clearTimeout(t)
  }, [syncOk])

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function buildNote(overrides: Partial<ChurchNote>): ChurchNote {
    const now = new Date().toISOString()
    return {
      ...(note ?? { userId, date: selectedDate, notices: [], createdAt: now }),
      updatedAt: now,
      ...overrides,
    } as ChurchNote
  }

  // Persist locally only (notices are local-only)
  async function persistNote(updated: ChurchNote) {
    await db.church_notes.put(updated)
  }

  // ─── Attendance ──────────────────────────────────────────────────────────────

  function parseField(v: string): number {
    const n = parseInt(v.trim() || '0', 10)
    return isNaN(n) || n < 0 ? 0 : n
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
      damas:      parseField(att.damas),
      amigos:     parseField(att.amigos),
      ninos:      parseField(att.ninos),
    }
    // Save locally
    await persistNote(buildNote({ attendance: breakdown, serviceName: serviceName.trim() || undefined }))
    // Sync attendance to Supabase if authenticated
    if (user) {
      const ok = await upsertAttendance(user.id, selectedDate, breakdown, serviceName.trim() || undefined)
      if (ok) setSyncOk(true)
      else setSyncError(true)
    }
  }

  function projectAttendance() {
    const a = note?.attendance ?? { caballeros: 0, damas: 0, amigos: 0, ninos: 0 }
    const lyrics = buildAttendanceLyrics(a, selectedDate, note?.serviceName)
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
      theme: { ...currentState.theme, maxFontSize: 64 },
    }
    useProjectionStore.setState({ state: newState })
    sendProjectionUpdate(newState)
  }

  const isAttendanceProjected = projectionState.songTitle === 'Asistencia'
  const total = totalAttendance(note?.attendance)

  // ─── Notices ─────────────────────────────────────────────────────────────────

  async function addNotice() {
    if (!validateNoticeText(newNoticeText)) {
      setNoticeError('El aviso no puede estar vacío')
      return
    }
    setNoticeError('')
    const now = new Date().toISOString()
    const newNotice: Notice = { id: crypto.randomUUID(), text: newNoticeText.trim(), createdAt: now, updatedAt: now }
    await persistNote(buildNote({ notices: [...(note?.notices ?? []), newNotice] }))
    setNewNoticeText('')
    setShowAddForm(false)
  }

  async function confirmDeleteNotice() {
    if (!deletingNoticeId) return
    await persistNote(buildNote({ notices: (note?.notices ?? []).filter(n => n.id !== deletingNoticeId) }))
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
    await persistNote(buildNote({
      notices: (note?.notices ?? []).map(n =>
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
            </div>
            <AttendanceChart notes={allNotes ?? []} />
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
              {total > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Total: <strong style={{ color: 'var(--text-primary)' }}>{total}</strong>
                </span>
              )}
              <button
                className={`btn-icon${isAttendanceProjected ? ' notice-project-active' : ''}`}
                onClick={projectAttendance}
                title="Proyectar asistencia"
                aria-label="Proyectar asistencia"
                disabled={!note?.attendance && total === 0}
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
              {parseField(att.caballeros) + parseField(att.damas) + parseField(att.amigos) + parseField(att.ninos)}
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

          {note?.notices && note.notices.length > 0 && (
            <ul className="notice-list" aria-label="Lista de avisos">
              {note.notices.map(notice => {
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

          {(!note?.notices || note.notices.length === 0) && !showAddForm && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
              No hay avisos para esta fecha
            </p>
          )}
        </section>
      </div>

      {syncOk && (
        <div className="sync-ok-toast" role="status" aria-live="polite">
          <Check size={14} />
          <span>Asistencia sincronizada correctamente</span>
        </div>
      )}

      {syncError && (
        <div className="sync-error-toast" role="alert" aria-live="polite">
          <AlertCircle size={14} />
          <span style={{ flex: 1 }}>Error al sincronizar. Los datos se guardaron localmente.</span>
          <button className="btn-icon" onClick={() => setSyncError(false)} aria-label="Cerrar" style={{ minWidth: 'unset', minHeight: 'unset' }}>
            <X size={14} />
          </button>
        </div>
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
    </div>
  )
}
