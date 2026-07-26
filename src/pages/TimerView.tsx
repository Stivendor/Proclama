import { useState } from 'react'
import { Play, Pause, RotateCcw, Menu, Clock } from 'lucide-react'
import { useAppStore, useProjectionStore } from '@/stores'
import { useShallow } from 'zustand/react/shallow'
import { useCountdownStore } from '@/features/countdown'
import { openProjectionWindow } from '@/services/projection'
import Segmented from '@/components/ui/Segmented'

export default function TimerView() {
  const { isSidebarOpen, toggleSidebar } = useAppStore(useShallow(s => ({
    isSidebarOpen: s.isSidebarOpen, toggleSidebar: s.toggleSidebar
  })))
  const { config, status, remainingTime, updateConfig, start, pause, reset, showClock } = useCountdownStore(useShallow(s => ({
    config: s.config, status: s.status, remainingTime: s.remainingTime,
    updateConfig: s.updateConfig, start: s.start, pause: s.pause, reset: s.reset, showClock: s.showClock
  })))
  const { projectionWindow, setProjectionWindow } = useProjectionStore(useShallow(s => ({
    projectionWindow: s.projectionWindow,
    setProjectionWindow: s.setProjectionWindow,
  })))

  const isClock = status === 'clock'
  const [mode, setMode] = useState<'timer' | 'clock'>(status === 'clock' ? 'clock' : 'timer')

  function ensureProjection() {
    if (!projectionWindow || projectionWindow.closed) setProjectionWindow(openProjectionWindow())
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

  return (
    <div className="notes-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar} aria-label="Abrir menú">
              <Menu size={20} />
            </button>
          )}
          <h1>Temporizador</h1>
        </div>
      </div>

      <div className="notes-body">
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

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Cuenta atrás o reloj en la pantalla de proyección.
          </p>

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
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Cuenta atrás hasta que empieza el servicio. Al iniciar se abre la ventana de proyección.
              </p>
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
      </div>
    </div>
  )
}
