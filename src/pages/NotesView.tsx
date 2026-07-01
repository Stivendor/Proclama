import { useState, useEffect, useRef } from 'react'
import {
  Users, Tv2, BarChart2, Download, Lock, X, FileText, Trash2, CalendarDays
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import { parseLyrics } from '@/services/lyricsParser'
import { sendProjectionUpdate, openProjectionWindow } from '@/services/projection'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { usePlan } from '@/hooks/usePlan'

import { useAttendance } from '@/features/attendance/hooks/useAttendance'
import AttendanceHistory from '@/features/attendance/components/AttendanceHistory'
import AttendanceStats from '@/features/attendance/components/AttendanceStats'
import ServiceNameSelector from '@/features/attendance/components/ServiceNameSelector'
import TemplateCombobox from '@/features/attendance/components/TemplateCombobox'
import AttendanceForm from '@/features/attendance/components/AttendanceForm'
import { exportAttendanceCSV, exportAttendancePDF } from '@/features/attendance/utils/pdf'
import { todayISO, formatDate, resolveValues } from '@/features/attendance/utils/validation'

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
  const { user, settings, updateSettings, fetchCloudSettings, setToast } = useAppStore(useShallow(s => ({
    user: s.user,
    settings: s.settings,
    updateSettings: s.updateSettings,
    fetchCloudSettings: s.fetchCloudSettings,
    setToast: s.setToast
  })))

  useEffect(() => {
    if (user?.id) {
      fetchCloudSettings()
    }
  }, [user?.id, fetchCloudSettings])
  const userId = user?.id ?? 'guest'

  const attendanceCategories = settings.attendanceCategories || ['Caballeros', 'Damas', 'Amigos', 'Niños']
  const serviceNameTemplates = settings.serviceNameTemplates || []
  const preacherTemplates = settings.preacherTemplates || []

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

  const [showExportModal, setShowExportModal] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

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
  const [serviceTime, setServiceTime] = useState('')
  const [preacher, setPreacher] = useState('')
  const [topic, setTopic] = useState('')
  const [att, setAtt] = useState<string[]>([])

  // Sync attendance inputs when the saved record changes
  useEffect(() => {
    if (attendanceRecord) {
      setServiceName(attendanceRecord.serviceName ?? '')
      setServiceTime(attendanceRecord.time ?? '')
      setPreacher(attendanceRecord.preacher ?? '')
      setTopic(attendanceRecord.topic ?? '')
      setAtt(resolveValues(attendanceRecord).map(String))
    } else {
      setServiceTime('')
      setPreacher('')
      setTopic('')
    }
    setAttError('')
  }, [attendanceRecord, selectedDate, setAttError])

  const { projectionSongTitle, projectionWindow, setProjectionWindow } = useProjectionStore(useShallow(s => ({
    projectionSongTitle: s.state.songTitle,
    projectionWindow: s.projectionWindow,
    setProjectionWindow: s.setProjectionWindow,
  })))

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

  const isAttendanceProjected = projectionSongTitle === 'Asistencia'
  const savedTotal = attendanceRecord ? resolveValues(attendanceRecord).reduce((a, b) => a + b, 0) : 0

  async function handleSave() {
    const ok = await saveAttendance(att, serviceName, serviceTime, attendanceCategories, preacher, topic)
    if (ok) setToast('Asistencia guardada')
  }

  // ─── Delete History ─────────────────────────────────────────────────────────────────
  const [showDeleteHistoryConfirm, setShowDeleteHistoryConfirm] = useState(false)

  const isToday = selectedDate === todayISO()

  return (
    <div className="notes-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={20} color="var(--gold)" />
          <h1>Asistencia</h1>
        </div>
      </div>

      <div className="notes-body">
        {/* ── Historial: siempre visible, debajo de la captura vía order (notes-body es flex column) ── */}
        {/* ponytail: reorden por CSS order; el DOM deja el historial antes del form, aceptable para esta vista */}
          <section className="notes-section" style={{ order: 1 }}>
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

            <AttendanceStats records={historyRecords} />

            <AttendanceHistory
              records={historyRecords}
              categories={attendanceCategories}
              onEdit={(date, serviceName) => {
                setSelectedDate(date)
                setSelectedServiceName(serviceName)
              }}
              onDelete={async (r) => {
                if (window.confirm(`¿Estás seguro de que deseas eliminar el registro del ${formatDate(r.date)}?`)) {
                  await deleteRecord(r)
                }
              }}
            />
          </section>

        {/* ── Asistencia ── */}
        <section className="notes-section" aria-labelledby="attendance-label">
          <div className="notes-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={15} />
              <span id="attendance-label">Asistencia al culto</span>
            </div>
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

          <div
            className="attendance-when"
            role="button"
            tabIndex={0}
            aria-label="Abrir selector de fecha y hora"
            onClick={() => { try { dateInputRef.current?.showPicker() } catch { /* no soportado */ } }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                try { dateInputRef.current?.showPicker() } catch { /* no soportado */ }
              }
            }}
          >
            <CalendarDays size={16} color="var(--text-secondary)" />
            <input
              ref={dateInputRef}
              type="datetime-local"
              className={`input${attError === 'Debes seleccionar una fecha válida' ? ' input--error' : ''}`}
              value={selectedDate ? `${selectedDate}T${serviceTime || '00:00'}` : ''}
              onChange={e => {
                const [date, time] = e.target.value.split('T')
                if (date) { setSelectedDate(date); setServiceTime(time || '') }
              }}
              aria-label="Seleccionar fecha y hora"
            />
            {isToday && <span className="date-today-badge">Hoy</span>}
          </div>

          <div className="attendance-fields">
          <div className="attendance-service-row">
            <label htmlFor="service-name-manual" className="attendance-field-label">Nombre del culto</label>
            <ServiceNameSelector
              serviceName={serviceName}
              setServiceName={setServiceName}
              serviceNameTemplates={serviceNameTemplates}
              onAddTemplate={(name) => updateSettings({ serviceNameTemplates: [...serviceNameTemplates, name] })}
              onDeleteTemplate={(name) => updateSettings({ serviceNameTemplates: serviceNameTemplates.filter(t => t !== name) })}
              onEnter={handleSave}
              error={hasServiceNameError ? attError : undefined}
              onClearError={() => attError && setAttError('')}
            />
          </div>

          <div className="attendance-service-row">
            <label htmlFor="preacher-manual" className="attendance-field-label">Predicador</label>
            <TemplateCombobox
              id="preacher-manual"
              value={preacher}
              onChange={setPreacher}
              templates={preacherTemplates}
              onAddTemplate={(name) => updateSettings({ preacherTemplates: [...preacherTemplates, name] })}
              onDeleteTemplate={(name) => updateSettings({ preacherTemplates: preacherTemplates.filter(t => t !== name) })}
              placeholder="Selecciona o escribe un predicador..."
            />
          </div>

          <div className="attendance-service-row">
            <label htmlFor="topic-manual" className="attendance-field-label">Tema (opcional)</label>
            <input
              id="topic-manual"
              type="text"
              className="input"
              placeholder="Tema de la predicación..."
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>
          </div>

          <AttendanceForm
            categories={attendanceCategories}
            onUpdateCategories={(newCats) => updateSettings({ attendanceCategories: newCats })}
            values={att}
            onChangeValues={setAtt}
            onSave={handleSave}
            isLoading={isLoadingAttendance}
            error={attError}
            onClearError={() => setAttError('')}
          />
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
