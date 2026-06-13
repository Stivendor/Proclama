import { Play, Pause, RotateCcw, Menu } from 'lucide-react'
import { useAppStore, useProjectionStore } from '@/stores'
import { useShallow } from 'zustand/react/shallow'
import { useCountdownStore } from '@/features/countdown'

export default function CountdownView() {
  const { isSidebarOpen, toggleSidebar, settings } = useAppStore(useShallow(s => ({
    isSidebarOpen: s.isSidebarOpen, toggleSidebar: s.toggleSidebar, settings: s.settings
  })))
  const { config, status, remainingTime, updateConfig, start, pause, reset } = useCountdownStore(useShallow(s => ({
    config: s.config, status: s.status, remainingTime: s.remainingTime, 
    updateConfig: s.updateConfig, start: s.start, pause: s.pause, reset: s.reset
  })))
  
  const projectionTheme = useProjectionStore(s => s.state.theme)
  const theme = projectionTheme // Use current projection theme for preview

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const getBackgroundStyle = () => {
    if (theme.backgroundType === 'image' && theme.backgroundImageUrl) {
      return { background: `url(${theme.backgroundImageUrl}) center/cover no-repeat` }
    }
    return { background: theme.backgroundType === 'color' || !theme.backgroundType ? theme.background : '#000' }
  }

  return (
    <div className="countdown-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
          )}
          <h1>Contador</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" title="Reiniciar" onClick={reset}>
            <RotateCcw size={18} />
          </button>
          {status === 'running' ? (
            <button className="btn-primary" onClick={pause} style={{ background: 'var(--red)', borderColor: 'var(--red)', color: 'white' }}>
              <Pause size={16} /> Pausar
            </button>
          ) : (
            <button className="btn-primary" onClick={start} disabled={config.durationMinutes === 0 && config.durationSeconds === 0}>
              <Play size={16} /> {status === 'paused' ? 'Reanudar' : 'Iniciar'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, padding: '24px 32px', flex: 1 }}>
        {/* Configuración */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 24 }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: 16, color: 'var(--gold)' }}>Tiempo</h2>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Título</label>
              <input
                type="text"
                className="input"
                placeholder="El servicio comienza en..."
                value={config.title}
                onChange={e => updateConfig({ title: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Minutos</label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  max={99}
                  value={config.durationMinutes}
                  onChange={e => updateConfig({ durationMinutes: parseInt(e.target.value) || 0 })}
                  disabled={status !== 'idle'}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Segundos</label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  max={59}
                  value={config.durationSeconds}
                  onChange={e => updateConfig({ durationSeconds: parseInt(e.target.value) || 0 })}
                  disabled={status !== 'idle'}
                />
              </div>
            </div>
          </section>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            El fondo se configura en Ajustes → Tema de Proyección
          </p>
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 14, color: 'var(--gold)', margin: 0 }}>Vista Previa</h2>
          
          <div style={{
            aspectRatio: '16/9',
            borderRadius: 16,
            overflow: 'hidden',
            position: 'relative',
            ...getBackgroundStyle()
          }}>
            {/* Blur effect */}
            <div style={{
              position: 'absolute', inset: 0,
              filter: `blur(${theme.backgroundBlur || 0}px)`,
              transform: 'scale(1.1)'
            }} />
            
            {/* Video bg */}
            {theme.backgroundType === 'video' && theme.backgroundVideoUrl && (
              <video
                key={theme.backgroundVideoUrl}
                src={theme.backgroundVideoUrl}
                autoPlay muted loop
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}

            {/* Overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `rgba(0,0,0,${theme.backgroundOverlayOpacity ?? 0.3})`
            }} />

            {/* Content */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontFamily: theme.fontFamily,
              color: theme.textColor,
              textShadow: theme.textShadow ? '0 4px 20px rgba(0,0,0,0.8)' : 'none',
              padding: 20
            }}>
              {config.title && (
                <div style={{ 
                  opacity: 0.8, 
                  fontSize: '0.3em', 
                  textTransform: 'uppercase', 
                  letterSpacing: 2,
                  marginBottom: '1cqh'
                }}>
                  {config.title}
                </div>
              )}
              <div style={{ fontSize: '1em', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold' }}>
                {formatTime(status === 'idle' ? config.durationMinutes * 60 + config.durationSeconds : remainingTime)}
              </div>
            </div>
          </div>

          {/* Status badge */}
          {status !== 'idle' && (
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: 8, 
              justifyContent: 'center', padding: 8 
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: status === 'running' ? 'var(--green)' : status === 'paused' ? 'var(--gold)' : 'var(--text-muted)'
              }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {status === 'running' ? 'En proyección' : status === 'paused' ? 'Pausado' : 'Finalizado'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}