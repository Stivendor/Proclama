import { useState, useEffect, type ReactNode } from 'react'
import { Play, Pause, RotateCcw, Menu, Megaphone, Plus, Pencil, Trash2, Tv2, Check, Clock, ScrollText, PanelTop, PanelBottom } from 'lucide-react'
import { useAppStore, useProjectionStore } from '@/stores'
import { useShallow } from 'zustand/react/shallow'
import { useCountdownStore } from '@/features/countdown'
import { openProjectionWindow, sendTickerUpdate, onMessage } from '@/services/projection'
import { useNotices } from '@/features/notices/useNotices'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { Notice } from '@/types'

// Selector segmentado: dos+ opciones mutuamente excluyentes en un solo control
function Segmented<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
}) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 3 }}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
              borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              background: active ? 'var(--bg-hover)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'background .15s, color .15s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 42, height: 24, borderRadius: 999, border: 'none', flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        background: checked ? 'var(--green)' : 'var(--bg-hover)', position: 'relative',
        transition: 'background .15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 20 : 2, width: 20, height: 20, borderRadius: '50%',
        background: '#fff', transition: 'left .15s',
      }} />
    </button>
  )
}

export default function CountdownView() {
  const { isSidebarOpen, toggleSidebar } = useAppStore(useShallow(s => ({
    isSidebarOpen: s.isSidebarOpen, toggleSidebar: s.toggleSidebar
  })))
  const { config, status, remainingTime, updateConfig, start, pause, reset, showClock } = useCountdownStore(useShallow(s => ({
    config: s.config, status: s.status, remainingTime: s.remainingTime,
    updateConfig: s.updateConfig, start: s.start, pause: s.pause, reset: s.reset, showClock: s.showClock
  })))

  const isClock = status === 'clock'
  const [mode, setMode] = useState<'timer' | 'clock'>(status === 'clock' ? 'clock' : 'timer')

  // ─── Avisos (localStorage, sin fecha) ─────────────────────────────────────────
  const { notices, add, update, remove } = useNotices()
  const { loadSong, projectedTitle, projectedSlides, projectionWindow, setProjectionWindow } = useProjectionStore(useShallow(s => ({
    loadSong: s.loadSong,
    projectedTitle: s.state.songTitle,
    projectedSlides: s.state.slides,
    projectionWindow: s.projectionWindow,
    setProjectionWindow: s.setProjectionWindow,
  })))
  const [showAddForm, setShowAddForm] = useState(false)
  const [newNoticeText, setNewNoticeText] = useState('')
  const [noticeError, setNoticeError] = useState('')
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null)

  // ─── Banda deslizante (ticker) ────────────────────────────────────────────────
  const [band, setBand] = useState<{ active: boolean; position: 'top' | 'bottom' }>(() => {
    try {
      const raw = localStorage.getItem('proclama-ticker')
      return raw ? JSON.parse(raw) : { active: false, position: 'bottom' }
    } catch { return { active: false, position: 'bottom' } }
  })
  const tickerText = notices.map(n => n.text).join('       •       ')

  useEffect(() => { localStorage.setItem('proclama-ticker', JSON.stringify(band)) }, [band])

  // Emite el ticker a la proyección cuando cambia el estado o los avisos
  useEffect(() => {
    sendTickerUpdate({ active: band.active, position: band.position, text: band.active ? tickerText : '' })
  }, [band.active, band.position, tickerText])

  // Reemite la banda cuando una ventana de proyección recién abierta lo solicita
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.type === 'PROJECTION_READY' && band.active) {
        sendTickerUpdate({ active: true, position: band.position, text: tickerText })
      }
    })
  }, [band.active, band.position, tickerText])

  function ensureProjection() {
    if (!projectionWindow || projectionWindow.closed) setProjectionWindow(openProjectionWindow())
  }

  function toggleBand() {
    setBand(b => {
      const next = { ...b, active: !b.active }
      if (next.active) ensureProjection()
      return next
    })
  }

  function addNotice() {
    if (!newNoticeText.trim()) { setNoticeError('El aviso no puede estar vacío'); return }
    add(newNoticeText)
    setNewNoticeText('')
    setNoticeError('')
    setShowAddForm(false)
  }

  function confirmEditNotice() {
    if (!editingNoticeId || !editingText.trim()) { setNoticeError('El aviso no puede estar vacío'); return }
    update(editingNoticeId, editingText)
    setEditingNoticeId(null)
    setEditingText('')
    setNoticeError('')
  }

  function projectNotice(notice: Notice) {
    loadSong({
      id: undefined, title: 'Aviso', artist: '',
      lyrics: notice.text, key: '', tags: [], language: 'Español',
      usageCount: 0, isPublic: false, isVerified: false,
      createdAt: new Date(), updatedAt: new Date(),
    }, false, 0)
    ensureProjection()
  }

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Estado real en pantalla (independiente de la pestaña que se esté editando)
  const onScreen =
    status === 'running' ? { dot: 'var(--green)', label: `En pantalla · ${formatTime(remainingTime)}` }
      : status === 'paused' ? { dot: 'var(--gold)', label: `Pausado · ${formatTime(remainingTime)}` }
        : status === 'clock' ? { dot: 'var(--green)', label: 'Reloj en pantalla' }
          : status === 'finished' ? { dot: 'var(--text-muted)', label: 'Finalizado' }
            : null

  const noNotices = notices.length === 0

  return (
    <div className="notes-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar} aria-label="Abrir menú">
              <Menu size={20} />
            </button>
          )}
          <h1>Notas y más</h1>
        </div>
      </div>

      <div className="notes-body">
        {/* ── Tiempo en pantalla ── */}
        <section className="notes-section" aria-labelledby="time-label">
          <div className="notes-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} />
              <span id="time-label">Tiempo en pantalla</span>
            </div>
            {onScreen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: onScreen.dot }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  {onScreen.label}
                </span>
              </div>
            )}
          </div>

          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'timer', label: <><Play size={13} /> Temporizador</> },
              { value: 'clock', label: <><Clock size={13} /> Reloj</> },
            ]}
          />

          {mode === 'timer' ? (
            <>
              <div>
                <label htmlFor="cd-title" style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Título</label>
                <input
                  id="cd-title"
                  type="text"
                  className="input"
                  placeholder="El servicio comienza en..."
                  value={config.title}
                  onChange={e => updateConfig({ title: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="cd-min" style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Minutos</label>
                  <input
                    id="cd-min"
                    type="number"
                    className="input"
                    min={0}
                    max={99}
                    value={config.durationMinutes}
                    onChange={e => updateConfig({ durationMinutes: parseInt(e.target.value) || 0 })}
                    disabled={status === 'running' || status === 'paused'}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="cd-sec" style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Segundos</label>
                  <input
                    id="cd-sec"
                    type="number"
                    className="input"
                    min={0}
                    max={59}
                    value={config.durationSeconds}
                    onChange={e => updateConfig({ durationSeconds: parseInt(e.target.value) || 0 })}
                    disabled={status === 'running' || status === 'paused'}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {status === 'running' ? (
                  <button className="btn-primary" onClick={pause} style={{ background: 'var(--red)', borderColor: 'var(--red)', color: 'white' }}>
                    <Pause size={16} /> Pausar
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => { start(); ensureProjection() }} disabled={config.durationMinutes === 0 && config.durationSeconds === 0}>
                    <Play size={16} /> {status === 'paused' ? 'Reanudar' : 'Iniciar'}
                  </button>
                )}
                <button className="btn-ghost" onClick={reset} disabled={status === 'idle'}>
                  <RotateCcw size={15} /> Reiniciar
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, maxWidth: 360, lineHeight: 1.5 }}>
                Muestra la hora actual en la pantalla de proyección, en formato 12&nbsp;horas.
              </p>
              <button
                className="btn-primary"
                onClick={() => { if (isClock) { reset() } else { showClock(); ensureProjection() } }}
                style={isClock ? { background: 'var(--red)', borderColor: 'var(--red)', color: 'white' } : undefined}
              >
                <Clock size={16} /> {isClock ? 'Ocultar reloj' : 'Mostrar la hora'}
              </button>
            </div>
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
              Nuevo aviso
            </button>
          </div>

          {/* Control de banda */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ScrollText size={16} color="var(--gold)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Banda en pantalla</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {noNotices ? 'Agrega un aviso para activarla' : 'Muestra los avisos como cinta deslizante'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {band.active && !noNotices && (
                <Segmented
                  value={band.position}
                  onChange={pos => setBand(b => ({ ...b, position: pos }))}
                  options={[
                    { value: 'top', label: <><PanelTop size={14} /> Arriba</> },
                    { value: 'bottom', label: <><PanelBottom size={14} /> Abajo</> },
                  ]}
                />
              )}
              <Switch checked={band.active} disabled={noNotices} onChange={toggleBand} />
            </div>
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

          {notices.length > 0 && (
            <ul className="notice-list" aria-label="Lista de avisos">
              {notices.map(notice => {
                const isProjected = projectedTitle === 'Aviso' &&
                  projectedSlides.some(s => s.lines.join('\n') === notice.text.split('\n').slice(0, 4).join('\n'))
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
                          <button className="btn-ghost" onClick={() => { setEditingNoticeId(null); setEditingText(''); setNoticeError('') }}>Cancelar</button>
                          <button className="btn-primary" onClick={confirmEditNotice}><Check size={14} />Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="notice-text">{notice.text}</p>
                        <div className="notice-actions">
                          <button className="btn-icon" onClick={() => { setEditingNoticeId(notice.id); setEditingText(notice.text); setNoticeError('') }} aria-label="Editar" title="Editar"><Pencil size={14} /></button>
                          <button
                            className={`btn-icon${isProjected ? ' notice-project-active' : ''}`}
                            onClick={() => projectNotice(notice)}
                            aria-label="Proyectar a pantalla completa" title="Proyectar a pantalla completa"
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

          {noNotices && !showAddForm && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
              Aún no hay avisos. Crea uno para mostrarlo en pantalla.
            </p>
          )}
        </section>
      </div>

      {deletingNoticeId && (
        <ConfirmDialog
          message="¿Eliminar este aviso? Esta acción no se puede deshacer."
          onConfirm={() => { remove(deletingNoticeId); setDeletingNoticeId(null) }}
          onCancel={() => setDeletingNoticeId(null)}
          confirmLabel="Eliminar"
          danger
        />
      )}
    </div>
  )
}
