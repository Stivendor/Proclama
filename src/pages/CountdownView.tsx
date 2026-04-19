import { useEffect, useState } from 'react'
import { Play, Pause, RotateCcw, Menu, Image as ImageIcon, Film, Sliders, CheckCircle } from 'lucide-react'
import { useAppStore, useProjectionStore } from '@/stores'
import { useShallow } from 'zustand/react/shallow'
import { useCountdownStore } from '@/stores/countdown'

export default function CountdownView() {
  const { isSidebarOpen, toggleSidebar, backgrounds, fetchBackgrounds } = useAppStore(useShallow(s => ({
    isSidebarOpen: s.isSidebarOpen, toggleSidebar: s.toggleSidebar, backgrounds: s.backgrounds, fetchBackgrounds: s.fetchBackgrounds
  })))
  const { config, status, remainingTime, updateConfig, updateTheme, start, pause, reset } = useCountdownStore(useShallow(s => ({
    config: s.config, status: s.status, remainingTime: s.remainingTime, updateConfig: s.updateConfig, 
    updateTheme: s.updateTheme, start: s.start, pause: s.pause, reset: s.reset
  })))
  const { media } = useProjectionStore(useShallow(s => ({
    media: s.state.media
  })))

  useEffect(() => {
    fetchBackgrounds()
  }, [])

  const FONTS = [
    'Montserrat, sans-serif',
    'Outfit, sans-serif',
    'Rubik, sans-serif',
    'Lexend, sans-serif',
    'Kanit, sans-serif',
    'Urbanist, sans-serif',
    'Nunito, sans-serif',
    'Inter, sans-serif',
    'Playfair Display, serif',
    'Lora, serif',
    'Verdana, sans-serif'
  ]

  // Formatear tiempo para el preview
  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="countdown-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
          )}
          <h1>Contador Regresivo</h1>
        </div>
        <div className="countdown-controls">
          <button 
            className="btn-icon" 
            title="Reiniciar"
            onClick={reset}
          >
            <RotateCcw size={18} />
          </button>
          {status === 'running' ? (
            <button className="btn-primary" onClick={pause} style={{ backgroundColor: 'var(--red)', borderColor: 'var(--red)', color: 'white' }}>
              <Pause size={16} fill="currentColor" /> Pausar
            </button>
          ) : (
            <button className="btn-primary" onClick={start} disabled={config.durationMinutes === 0 && config.durationSeconds === 0}>
              <Play size={16} fill="currentColor" /> {status === 'paused' ? 'Reanudar' : 'Iniciar'}
            </button>
          )}
        </div>
      </div>

      <div className="countdown-body">
        
        <div className="countdown-settings-col">
          <section className="settings-section">
            <h2>Configuración del Tiempo</h2>
            <div className="form-group">
              <label>Título a mostrar (opcional)</label>
              <input 
                type="text" 
                placeholder="Ej: El servicio comienza en"
                value={config.title}
                onChange={e => updateConfig({ title: e.target.value })}
              />
            </div>
            <div className="form-row duration-row">
              <div className="form-group">
                <label>Minutos</label>
                <input 
                  type="number" 
                  min="0" 
                  max="99" 
                  value={config.durationMinutes}
                  onChange={e => updateConfig({ durationMinutes: parseInt(e.target.value) || 0 })}
                  disabled={status !== 'idle'}
                />
              </div>
              <div className="form-group">
                <label>Segundos</label>
                <input 
                  type="number" 
                  min="0" 
                  max="59" 
                  value={config.durationSeconds}
                  onChange={e => updateConfig({ durationSeconds: parseInt(e.target.value) || 0 })}
                  disabled={status !== 'idle'}
                />
              </div>
            </div>
          </section>

        <section className="settings-section">
          <h2><Sliders size={15} /> Tema Visual</h2>
          <div className="form-group">
            <label>Tipo de Fondo</label>
            <div className="segmented-control">
              <button 
                className={(!config.theme.backgroundType || config.theme.backgroundType === 'color') ? 'active' : ''}
                onClick={() => updateTheme({ backgroundType: 'color' })}
              >
                <Sliders size={14} /> Color
              </button>
              <button 
                className={config.theme.backgroundType === 'image' ? 'active' : ''}
                onClick={() => updateTheme({ backgroundType: 'image' })}
              >
                <ImageIcon size={14} /> Imagen
              </button>
              <button 
                className={config.theme.backgroundType === 'video' ? 'active' : ''}
                onClick={() => updateTheme({ backgroundType: 'video' })}
              >
                <Film size={14} /> Video
              </button>
            </div>
          </div>

          <div className="background-options">
            {config.theme.backgroundType === 'image' && (
              <div className="gallery-container">
                <label><ImageIcon size={14} /> Galería de Imagenes</label>
                <div className="backgrounds-gallery">
                  {backgrounds.map(bg => (
                    <div 
                      key={bg.id} 
                      className={`gallery-item ${config.theme.backgroundImageUrl === bg.url ? 'active' : ''}`}
                      onClick={() => updateTheme({ 
                        backgroundType: 'image', 
                        backgroundImageUrl: bg.url,
                        backgroundThumbnail: bg.thumbnailUrl 
                      })}
                    >
                      <img 
                        src={bg.thumbnailUrl || bg.url} 
                        alt="background" 
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (target.src !== bg.url) {
                            target.src = bg.url;
                          }
                        }}
                      />
                      {config.theme.backgroundImageUrl === bg.url && <div className="active-overlay"><CheckCircle size={14} /></div>}
                    </div>
                  ))}
                </div>
                
                
              </div>
            )}

            {config.theme.backgroundType === 'video' && (
              <div className="form-group">
                <label><Film size={14} /> URL del Video (MP4)</label>
                <input 
                  type="text" 
                  placeholder="https://...fondo.mp4" 
                  value={config.theme.backgroundVideoUrl || ''} 
                  onChange={e => updateTheme({ backgroundVideoUrl: e.target.value })} 
                />
              </div>
            )}

            {(config.theme.backgroundType === 'color' || !config.theme.backgroundType) && (
              <div className="form-group">
                <label>Color de fondo</label>
                <div className="color-input-row">
                  <input type="color" value={config.theme.background.startsWith('#') ? config.theme.background : '#0a0a0f'}
                    onChange={e => updateTheme({ background: e.target.value })} />
                  <input type="text" value={config.theme.background} onChange={e => updateTheme({ background: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Color del Título</label>
              <div className="color-input-row">
                <input type="color" value={config.theme.textColor} onChange={e => updateTheme({ textColor: e.target.value })} />
                <input type="text" value={config.theme.textColor} onChange={e => updateTheme({ textColor: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Color del Contador</label>
              <div className="color-input-row">
                <input type="color" value={config.theme.timerColor || config.theme.textColor || '#ffffff'} onChange={e => updateTheme({ timerColor: e.target.value })} />
                <input type="text" value={config.theme.timerColor || config.theme.textColor || '#ffffff'} onChange={e => updateTheme({ timerColor: e.target.value })} />
              </div>
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Fuente Global</label>
              <select value={config.theme.fontFamily} onChange={e => updateTheme({ fontFamily: e.target.value })}>
                {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0]}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 20 }}>
            <div className="form-group checkboxes" style={{ alignSelf: 'center', marginTop: 0 }}>
              <label className="checkbox-label" style={{ padding: '0 8px' }}>
                <input type="checkbox" checked={config.theme.textShadow}
                  onChange={e => updateTheme({ textShadow: e.target.checked })} />
                Sombra intensa en el texto
              </label>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 20 }}>
            <div className="form-group">
              <label>Desenfoque de Fondo ({config.theme.backgroundBlur || 0}px)</label>
              <input 
                type="range" min="0" max="20" step="1"
                value={config.theme.backgroundBlur || 0}
                onChange={e => updateTheme({ backgroundBlur: parseInt(e.target.value) })}
                className="proclama-range"
              />
            </div>
            <div className="form-group">
              <label>Filtro Oscuro ({Math.round((config.theme.backgroundOverlayOpacity || 0) * 100)}%)</label>
              <input 
                type="range" min="0" max="1" step="0.05"
                value={config.theme.backgroundOverlayOpacity ?? 0.3}
                onChange={e => updateTheme({ backgroundOverlayOpacity: parseFloat(e.target.value) })}
                className="proclama-range"
              />
            </div>
          </div>
        </section>
        </div>

        <div className="countdown-preview-col">
          {/* Vista previa en tiempo real */}
          <section className="settings-section preview-section">
            <h2>Vista Previa en Vivo</h2>
            <div className="theme-preview">
              <div className="preview-background-layer" style={{ 
                position: 'absolute', inset: 0,
                filter: `blur(${config.theme.backgroundBlur || 0}px)`,
                transform: 'scale(1.1)',
                background: config.theme.backgroundType === 'image' && config.theme.backgroundImageUrl
                  ? `url(${config.theme.backgroundImageUrl}) center/cover no-repeat`
                  : (config.theme.backgroundType === 'color' || !config.theme.backgroundType)
                    ? config.theme.background 
                    : '#000'
              }}>
                {config.theme.backgroundType === 'video' && config.theme.backgroundVideoUrl && (
                  <video 
                    key={config.theme.backgroundVideoUrl}
                    src={config.theme.backgroundVideoUrl} 
                    autoPlay muted loop 
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                )}
              </div>

              {/* Proyección de Media (Fondo Dinámico) en la vista previa del contador */}
              {media && (
                <div 
                  className="preview-media-layer" 
                  style={{ 
                    position: 'absolute', inset: 0, 
                    zIndex: media.isBackgroundMode ? 2 : 20, 
                    background: media.isBackgroundMode ? 'transparent' : '#000',
                    filter: media.isBackgroundMode ? `blur(${config.theme.backgroundBlur || 0}px)` : 'none',
                    transform: media.isBackgroundMode && config.theme.backgroundBlur ? 'scale(1.1)' : 'scale(1)'
                  }}
                >
                  {media.type === 'video' ? (
                    <video 
                      autoPlay 
                      loop 
                      muted
                      style={{ width: '100%', height: '100%', objectFit: media.isBackgroundMode ? 'cover' : 'contain' }}
                      src={media.url}
                    />
                  ) : (
                    <img 
                      src={media.url} 
                      style={{ width: '100%', height: '100%', objectFit: media.isBackgroundMode ? 'cover' : 'contain' }} 
                    />
                  )}
                </div>
              )}
              
              <div style={{ 
                position: 'absolute', inset: 0, 
                backgroundColor: `rgba(0,0,0,${config.theme.backgroundOverlayOpacity ?? 0.3})`,
                zIndex: 5 
              }} />

              <div className="preview-content" style={{
                fontFamily: config.theme.fontFamily,
                color: config.theme.textColor,
                textShadow: config.theme.textShadow ? '0 4px 20px rgba(0,0,0,0.8)' : 'none',
                textAlign: 'center', lineHeight: 1.1, padding: '20px', position: 'relative', zIndex: 10,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: '100%', height: '100%',
                fontSize: `${(config.theme.fontSize || 160) / 8}cqmin`
              }}>
                {config.title && (
                  <div style={{ opacity: 0.8, fontSize: '0.35em', marginBottom: '3cqh', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 500 }}>
                    {config.title}
                  </div>
                )}
                <div style={{ fontSize: '1em', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold', lineHeight: 1, color: config.theme.timerColor || config.theme.textColor }}>
                  {formatTime(status === 'idle' ? (config.durationMinutes * 60 + config.durationSeconds) : remainingTime)}
                </div>
              </div>
              
              {status !== 'idle' && (
                <div className="status-badge">
                  <div className={`status-dot ${status}`}></div>
                  {status === 'running' ? 'En proyeción (Corriendo)' : status === 'paused' ? 'Pausado' : 'Finalizado'}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .countdown-view {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--bg-default);
          overflow: hidden;
        }

        .countdown-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px 32px;
          display: grid;
          grid-template-columns: 1fr 450px;
          gap: 40px;
          padding-bottom: 60px;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .countdown-body {
            grid-template-columns: 1fr;
          }
        }

        .countdown-settings-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .countdown-preview-col {
          position: sticky;
          top: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .countdown-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .preview-section {
          padding: 0;
          background: transparent;
          border: none;
        }
        
        .preview-section h2 { padding: 0 4px 12px 4px; border-bottom: none; margin: 0; font-size: 14px; color: var(--gold); }

        .theme-preview {
          aspect-ratio: 16/7;
          border-radius: 16px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08);
          background: #000;
          container-type: size;
        }

        .status-badge {
          position: absolute;
          top: 16px; left: 16px;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(8px);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          color: white;
          border: 1px solid rgba(255,255,255,0.1);
          z-index: 10;
        }
        
        .status-dot {
          width: 8px; height: 8px; border-radius: 50%;
        }
        .status-dot.running { background: var(--green, #10b981); box-shadow: 0 0 8px var(--green, #10b981); animation: pulse 2s infinite; }
        .status-dot.paused { background: var(--yellow, #f59e0b); }
        .status-dot.finished { background: var(--red, #ef4444); }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .duration-row { margin-top: 12px; }
        .duration-row input { font-size: 24px; font-weight: 600; text-align: center; font-variant-numeric: tabular-nums; }
        
        /* Reused styles from settings */
        .segmented-control {
          display: flex;
          background: rgba(255,255,255,0.05);
          padding: 4px;
          border-radius: 8px;
          gap: 4px;
        }
        .segmented-control button {
          flex: 1;
          border: none;
          background: none;
          color: var(--text-muted);
          padding: 8px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .segmented-control button:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }
        .segmented-control button.active {
          background: var(--gold);
          color: black;
          box-shadow: 0 2px 8px rgba(212, 175, 55, 0.3);
        }

        .background-options { margin-top: 20px; border-top: 1px solid var(--border); padding-top: 20px; }
        .gallery-container { display: flex; flex-direction: column; gap: 12px; }
        .gallery-container label { display: flex; alignItems: center; gap: 6px; font-weight: 600; font-size: 13px; }
        .backgrounds-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
          max-height: 240px;
          overflow-y: auto;
          padding: 4px;
        }
        .gallery-item {
          aspect-ratio: 16/9;
          border-radius: 6px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all 0.2s;
          position: relative;
          background: #000;
        }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; opacity: 0.8; }
        .gallery-item:hover img { opacity: 1; transform: scale(1.05); }
        .gallery-item.active { border-color: var(--gold); }
        .gallery-item.active img { opacity: 1; }
        .active-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center; color: var(--gold);
        }
        .input-tip { font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block; }
      `}</style>
    </div>
  )
}
