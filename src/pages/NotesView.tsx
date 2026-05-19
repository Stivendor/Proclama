import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ClipboardEdit, Users, Megaphone, Plus, Pencil, Trash2,
  Check, Tv2, BarChart2, Download, Lock, X, FileText, RefreshCw
} from 'lucide-react'
import { db } from '@/db'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import { parseLyrics } from '@/services/lyricsParser'
import { sendProjectionUpdate, openProjectionWindow } from '@/services/projection'
import { syncAttendanceRecords, getPendingCount } from '@/services/attendanceSync'
import type { ChurchNote, Notice } from '@/types'
import ConfirmDialog from '@/components/ConfirmDialog'
import { usePlan } from '@/hooks/usePlan'

import { useAttendance } from '@/features/attendance/hooks/useAttendance'
import AttendanceHistory from '@/features/attendance/components/AttendanceHistory'
import ServiceNameSelector from '@/features/attendance/components/ServiceNameSelector'
import AttendanceForm from '@/features/attendance/components/AttendanceForm'
import PremiumFeatureModal from '@/components/PremiumFeatureModal'
import { exportAttendanceCSV, exportAttendancePDF } from '@/features/attendance/utils/pdf'
import { validateNoticeText, todayISO, formatDate, resolveValues } from '@/features/attendance/utils/validation'

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

export default function NotesView() {
  const { canExportReports } = usePlan()
  const { user, userPlan, userRole, settings, updateSettings, fetchCloudSettings } = useAppStore(useShallow(s => ({ 
    user: s.user, 
    userPlan: s.userPlan,
    userRole: s.userRole,
    settings: s.settings, 
    updateSettings: s.updateSettings,
    fetchCloudSettings: s.fetchCloudSettings
  })))

  useEffect(() => {
    if (user?.id) {
      fetchCloudSettings()
    }
  }, [user?.id, fetchCloudSettings])
  const userId = user?.id ?? 'guest'

  const attendanceCategories = settings.attendanceCategories || ['Caballeros', 'Damas', 'Amigos', 'Niños']
  const serviceNameTemplates = settings.serviceNameTemplates || []

  // Attendance hook
  const {
    selectedDate,
    setSelectedDate,
    attendanceRecord,
    historyRecords,
    isLoading: isLoadingAttendance,
    error: attError,
    setError: setAttError,
    saveAttendance,
    deleteRecord,
    deleteHistory,
    setSelectedServiceName,
    hasServiceNameError
  } = useAttendance(userId)

  const [showDashboard, setShowDashboard] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Local state for the form
  const [serviceName, setServiceName] = useState('')
  const [att, setAtt] = useState<string[]>([])

  // Sync attendance inputs when the saved record changes
  useEffect(() => {
    if (attendanceRecord) {
      setServiceName(attendanceRecord.serviceName ?? '')
      setAtt(resolveValues(attendanceRecord).map(String))
    }
    setAttError('')
  }, [attendanceRecord, selectedDate, setAttError])

  // Notices
  const [newNoticeText, setNewNoticeText] = useState('')
  const [noticeError, setNoticeError] = useState('')
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')

  useEffect(() => {
    if (!syncError) return
    const t = setTimeout(() => setSyncError(''), 6000)
    return () => clearTimeout(t)
  }, [syncError])

  const pendingSyncCount = useLiveQuery(
    async () => {
      if (!user?.id) return 0
      return getPendingCount(user.id)
    },
    [user?.id]
  )

  const handleManualSync = async () => {
    if (!user?.id || isSyncing) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    setIsSyncing(true)
    setSyncError('')
    try {
      const result = await syncAttendanceRecords(user.id, undefined, controller.signal)
      if (result.failed > 0) {
        setSyncError(`${result.failed} registro(s) no se pudieron sincronizar`)
      } else if (result.synced > 0) {
        setSyncError('')
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setSyncError('La conexión con el servidor tardó demasiado. Intenta de nuevo.')
      } else {
        setSyncError('Error al sincronizar. Revisa tu conexión.')
      }
    } finally {
      clearTimeout(timer)
      setIsSyncing(false)
    }
  }

  const { loadSong, projectionState, projectionWindow, setProjectionWindow } = useProjectionStore(useShallow(s => ({
    loadSong: s.loadSong,
    projectionState: { songTitle: s.state.songTitle, slides: s.state.slides },
    projectionWindow: s.projectionWindow,
    setProjectionWindow: s.setProjectionWindow,
  })))

  const churchNote = useLiveQuery(
    () => db.church_notes.where({ date: selectedDate, userId }).first(),
    [selectedDate, userId]
  )

  // ─── Helpers ────────────────────────────────────────────────────────────────
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

  async function persistNote(updated: ChurchNote) {
    const stripped: ChurchNote = {
      ...updated,
      attendance: undefined,
      serviceName: undefined,
    }
    await db.church_notes.put(stripped)
  }

  // ─── Project Attendance ──────────────────────────────────────────────────────
  function projectAttendance() {
    const values = attendanceRecord ? resolveValues(attendanceRecord) : []
    const lyrics = buildAttendanceLyrics(values, attendanceCategories, selectedDate, attendanceRecord?.serviceName)
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
  const savedTotal = attendanceRecord ? resolveValues(attendanceRecord).reduce((a, b) => a + b, 0) : 0

  // ─── Delete History ─────────────────────────────────────────────────────────────────
  const [showDeleteHistoryConfirm, setShowDeleteHistoryConfirm] = useState(false)

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
          
          {user && (userPlan === 'premium' || userRole === 'admin') && (
            <button
              className={`btn-ghost${isSyncing ? ' loading' : ''}`}
              onClick={handleManualSync}
              disabled={isSyncing}
              style={{ position: 'relative' }}
              title="Sincronizar ahora"
            >
              <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              {pendingSyncCount ? (
                <span style={{
                  position: 'absolute', top: -5, right: -5,
                  background: 'var(--red)', color: 'white',
                  fontSize: 10, padding: '2px 5px', borderRadius: 10,
                  fontWeight: 700, minWidth: 16, textAlign: 'center'
                }}>
                  {pendingSyncCount}
                </span>
              ) : null}
            </button>
          )}
          {syncError && (
            <span style={{
              fontSize: 12, color: 'var(--red)', marginLeft: 8,
              background: 'rgba(224, 85, 85, 0.1)', padding: '4px 10px',
              borderRadius: 6, border: '1px solid rgba(224, 85, 85, 0.3)',
              maxWidth: 280
            }}>
              {syncError}
            </span>
          )}

          <input
            type="date"
            className={`input${attError === 'Debes seleccionar una fecha válida' ? ' input--error' : ''}`}
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
                        !canExportReports ? setShowExportModal(true) : exportAttendancePDF(historyRecords, attendanceCategories)
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
                        !canExportReports ? setShowExportModal(true) : exportAttendanceCSV(historyRecords, attendanceCategories)
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

            <AttendanceHistory
              records={historyRecords}
              categories={attendanceCategories}
              onEdit={(date, serviceName) => {
                setSelectedDate(date)
                setSelectedServiceName(serviceName)
                setShowDashboard(false)
              }}
              onDelete={async (r) => {
                if (window.confirm(`¿Estás seguro de que deseas eliminar el registro del ${formatDate(r.date)}?`)) {
                  await deleteRecord(r)
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
              {savedTotal > 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total: {savedTotal}</span>}
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
            <label htmlFor="service-name-manual" className="attendance-field-label">Nombre del culto</label>
            <ServiceNameSelector
              serviceName={serviceName}
              setServiceName={setServiceName}
              serviceNameTemplates={serviceNameTemplates}
              onAddTemplate={(name) => updateSettings({ serviceNameTemplates: [...serviceNameTemplates, name] })}
              onDeleteTemplate={(name) => updateSettings({ serviceNameTemplates: serviceNameTemplates.filter(t => t !== name) })}
              onEnter={() => saveAttendance(att, serviceName, attendanceCategories)}
              error={hasServiceNameError ? attError : undefined}
              onClearError={() => attError && setAttError('')}
            />
          </div>

          <AttendanceForm
            categories={attendanceCategories}
            onUpdateCategories={(newCats) => updateSettings({ attendanceCategories: newCats })}
            values={att}
            onChangeValues={setAtt}
            onSave={() => saveAttendance(att, serviceName, attendanceCategories)}
            isLoading={isLoadingAttendance}
            error={attError}
            onClearError={() => setAttError('')}
          />
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

      {showDeleteHistoryConfirm && (
        <ConfirmDialog
          message="¿Borrar todo el historial de asistencia? Esta acción no se puede deshacer."
          onConfirm={async () => {
            await deleteHistory()
            setShowDeleteHistoryConfirm(false)
          }}
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
