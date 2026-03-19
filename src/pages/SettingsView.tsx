import { useEffect, useState } from 'react'
import { Save, Eye, EyeOff, ExternalLink, Sliders, LogIn, LogOut, CheckCircle, Menu, Image as ImageIcon, Film } from 'lucide-react'
import { useAppStore, useProjectionStore, DEFAULT_THEME } from '@/stores'
import { supabase } from '@/services/supabase'

export default function SettingsView() {
  const { settings, updateSettings, isSidebarOpen, toggleSidebar, user, backgrounds, fetchBackgrounds } = useAppStore()
  const { updateTheme, state } = useProjectionStore()
  const [showSecret, setShowSecret] = useState(false)
  const [showGeniusToken, setShowGeniusToken] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchBackgrounds()
  }, [])

  // Auth states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [loadingAuth, setLoadingAuth] = useState(false)

  const set = (key: string, value: any) => updateSettings({ [key]: value } as any)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const FONTS = [
    'Lora, Georgia, serif',
    'Playfair Display, Georgia, serif',
    'Cinzel, Georgia, serif',
    'Montserrat, sans-serif',
    'Raleway, sans-serif',
    '"Open Sans", sans-serif',
    'Georgia, serif',
    'Verdana, sans-serif'
  ]

  const TRANSITIONS = [
    { value: 'fade', label: 'Fade (suave)' },
    { value: 'slide', label: 'Slide (deslizar)' },
    { value: 'instant', label: 'Instantáneo' },
  ]

  return (
    <div className="settings-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
          )}
          <h1>Ajustes</h1>
        </div>
        <button className="btn-primary" onClick={handleSave}>
          <Save size={15} /> {saved ? '¡Guardado!' : 'Guardar'}
        </button>
      </div>

      <div className="settings-body">
        {/* Cuenta y Seguridad */}
        <section className="settings-section">
          <h2>Cuenta y Base de Datos (Seguridad)</h2>
          {!user ? (
            <div className="auth-card">
              <div className="settings-info" style={{ marginBottom: 16 }}>
                Inicia sesión para poder editar, añadir o borrar canciones (Permisos de Escritura).
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Correo Electrónico</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
                </div>
                <div className="form-group">
                  <label>Contraseña</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
              {authError && <div style={{ color: '#ff4d4f', fontSize: 13, marginBottom: 12 }}>{authError}</div>}
              <button 
                className="btn-primary" 
                disabled={loadingAuth || !email || !password}
                onClick={async () => {
                  setLoadingAuth(true)
                  setAuthError('')
                  const { error } = await supabase.auth.signInWithPassword({ email, password })
                  if (error) setAuthError(error.message)
                  setLoadingAuth(false)
                }}
              >
                <LogIn size={15} /> {loadingAuth ? 'Iniciando...' : 'Iniciar Sesión'}
              </button>
            </div>
          ) : (
            <div className="auth-card success">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <CheckCircle color="var(--gold)" size={20} />
                <div>
                  <div style={{ fontWeight: 600 }}>Autenticado como:</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.email} (Escritura habilitada)</div>
                </div>
              </div>
              <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>
                <LogOut size={15} /> Cerrar Sesión
              </button>
            </div>
          )}
        </section>



        {/* Genius */}
        <section className="settings-section">
          <h2>
            Genius API — Letras Online
            <a href="https://genius.com/api-clients" target="_blank" rel="noreferrer" className="settings-link">
              <ExternalLink size={13} /> Obtener token
            </a>
          </h2>
          <div className="form-group">
            <label>Token de acceso</label>
            <div className="input-with-icon">
              <input
                type={showGeniusToken ? 'text' : 'password'}
                placeholder="Client Access Token"
                value={settings.geniusToken}
                onChange={e => set('geniusToken', e.target.value)}
              />
              <button className="btn-icon" onClick={() => setShowGeniusToken(s => !s)}>
                {showGeniusToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </section>

        {/* Proyección */}
        <section className="settings-section">
          <h2><Sliders size={15} /> Proyección — Tema por Defecto</h2>
          <div className="form-group">
            <label>Tipo de Fondo</label>
            <div className="segmented-control">
              <button 
                className={(!state.theme.backgroundType || state.theme.backgroundType === 'color') ? 'active' : ''}
                onClick={() => updateTheme({ backgroundType: 'color' })}
              >
                <Sliders size={14} /> Color
              </button>
              <button 
                className={state.theme.backgroundType === 'image' ? 'active' : ''}
                onClick={() => updateTheme({ backgroundType: 'image' })}
              >
                <ImageIcon size={14} /> Imagen
              </button>
              <button 
                className={state.theme.backgroundType === 'video' ? 'active' : ''}
                onClick={() => updateTheme({ backgroundType: 'video' })}
              >
                <Film size={14} /> Video
              </button>
            </div>
          </div>

          <div className="background-options">
            {state.theme.backgroundType === 'image' && (
              <div className="gallery-container">
                <label><ImageIcon size={14} /> Galería de Imagenes</label>
                <div className="backgrounds-gallery">
                  {backgrounds.map(bg => (
                    <div 
                      key={bg.id} 
                      className={`gallery-item ${state.theme.backgroundImageUrl === bg.url ? 'active' : ''}`}
                      onClick={() => updateTheme({ 
                        backgroundType: 'image', 
                        backgroundImageUrl: bg.url,
                        backgroundThumbnail: bg.thumbnailUrl 
                      })}
                    >
                      <img src={bg.thumbnailUrl} alt="background" />
                      {state.theme.backgroundImageUrl === bg.url && <div className="active-overlay"><CheckCircle size={14} /></div>}
                    </div>
                  ))}
                </div>
                
                <div className="form-group" style={{ marginTop: 20 }}>
                  <label>URL de Imagen Personalizada</label>
                  <input 
                    type="text" 
                    placeholder="https://...imagen.jpg" 
                    value={state.theme.backgroundImageUrl || ''} 
                    onChange={e => updateTheme({ backgroundImageUrl: e.target.value })} 
                  />
                  <span className="input-tip">Pega aquí el enlace de cualquier imagen para usarla de fondo.</span>
                </div>
              </div>
            )}

            {state.theme.backgroundType === 'video' && (
              <div className="form-group">
                <label><Film size={14} /> URL del Video (MP4)</label>
                <input 
                  type="text" 
                  placeholder="https://...fondo.mp4" 
                  value={state.theme.backgroundVideoUrl || ''} 
                  onChange={e => updateTheme({ backgroundVideoUrl: e.target.value })} 
                />
              </div>
            )}

            {(state.theme.backgroundType === 'color' || !state.theme.backgroundType) && (
              <div className="form-group">
                <label>Color de fondo</label>
                <div className="color-input-row">
                  <input type="color" value={state.theme.background.startsWith('#') ? state.theme.background : '#0a0a0f'}
                    onChange={e => updateTheme({ background: e.target.value })} />
                  <input type="text" value={state.theme.background} onChange={e => updateTheme({ background: e.target.value })} />
                </div>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Color de texto</label>
              <div className="color-input-row">
                <input type="color" value={state.theme.textColor} onChange={e => updateTheme({ textColor: e.target.value })} />
                <input type="text" value={state.theme.textColor} onChange={e => updateTheme({ textColor: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Fuente</label>
              <select value={state.theme.fontFamily} onChange={e => updateTheme({ fontFamily: e.target.value })}>
                {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0]}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Transición</label>
              <select value={state.theme.transition} onChange={e => updateTheme({ transition: e.target.value as any })}>
                {TRANSITIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group checkboxes">
              <label className="checkbox-label">
                <input type="checkbox" checked={state.theme.textShadow}
                  onChange={e => updateTheme({ textShadow: e.target.checked })} />
                Sombra en el texto
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={state.theme.showTitle}
                  onChange={e => updateTheme({ showTitle: e.target.checked })} />
                Mostrar título de canción
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={state.theme.showVerseLabel}
                  onChange={e => updateTheme({ showVerseLabel: e.target.checked })} />
                Mostrar etiqueta de verso
              </label>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 20 }}>
            <div className="form-group">
              <label>Desenfoque de Fondo ({state.theme.backgroundBlur || 0}px)</label>
              <input 
                type="range" min="0" max="20" step="1"
                value={state.theme.backgroundBlur || 0}
                onChange={e => updateTheme({ backgroundBlur: parseInt(e.target.value) })}
                className="proclama-range"
              />
            </div>
            <div className="form-group">
              <label>Filtro Oscuro ({Math.round((state.theme.backgroundOverlayOpacity || 0) * 100)}%)</label>
              <input 
                type="range" min="0" max="1" step="0.05"
                value={state.theme.backgroundOverlayOpacity ?? 0.3}
                onChange={e => updateTheme({ backgroundOverlayOpacity: parseFloat(e.target.value) })}
                className="proclama-range"
              />
            </div>
          </div>

          {/* Preview del tema */}
          <div className="theme-preview-container">
            <div className="theme-preview-header">Vista Previa de Proyección</div>
            <div className="theme-preview">
              <div className="preview-background-layer" style={{ 
                position: 'absolute', inset: 0,
                filter: `blur(${state.theme.backgroundBlur || 0}px)`,
                transform: 'scale(1.1)', // Evitar bordes blancos al blurear
                background: state.theme.backgroundType === 'image' && state.theme.backgroundImageUrl
                  ? `url(${state.theme.backgroundImageUrl}) center/cover no-repeat`
                  : (state.theme.backgroundType === 'color' || !state.theme.backgroundType)
                    ? state.theme.background 
                    : '#000'
              }}>
                {state.theme.backgroundType === 'video' && state.theme.backgroundVideoUrl && (
                  <video 
                    key={state.theme.backgroundVideoUrl}
                    src={state.theme.backgroundVideoUrl} 
                    autoPlay muted loop 
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                )}
              </div>
              
              {/* Capa de oscurecimiento */}
              <div style={{ 
                position: 'absolute', inset: 0, 
                backgroundColor: `rgba(0,0,0,${state.theme.backgroundOverlayOpacity ?? 0.3})`,
                zIndex: 1 
              }} />

              <div className="preview-content" style={{
                fontFamily: state.theme.fontFamily,
                fontSize: `${Math.round(state.theme.fontSize * 0.35)}px`,
                color: state.theme.textColor,
                textShadow: state.theme.textShadow ? '0 2px 10px rgba(0,0,0,0.8)' : 'none',
                textAlign: 'center', lineHeight: 1.4, padding: '20px', position: 'relative', zIndex: 2
              }}>
                <div style={{ opacity: 0.5, fontSize: `${Math.round(state.theme.fontSize * 0.15)}px`, marginBottom: 8 }}>
                  {state.theme.showTitle ? 'CUÁN GRANDE ES ÉL' : ''}
                </div>
                <div>Señor mi Dios</div>
                <div>al contemplar los cielos</div>
                <div>El firmamento</div>
                <div>y las estrellas mil</div>
              </div>
            </div>
          </div>
        </section>

        <button className="btn-primary large" onClick={handleSave}>
          <Save size={16} /> {saved ? '¡Cambios guardados!' : 'Guardar todos los ajustes'}
        </button>
      </div>

      <style>{`
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

        .theme-preview-container { margin-top: 32px; display: flex; flex-direction: column; gap: 12px; }
        .theme-preview-header { font-size: 12px; font-weight: 600; color: var(--gold); text-transform: uppercase; letter-spacing: 1px; }
        .theme-preview {
          aspect-ratio: 16/9;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
          border: 4px solid var(--bg-elevated);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .preview-content { width: 100%; transition: all 0.3s; }

        .background-options { margin-top: 20px; border-top: 1px solid var(--border); padding-top: 20px; }
        .gallery-container { display: flex; flex-direction: column; gap: 12px; }
        .gallery-container label { display: flex; alignItems: center; gap: 6px; font-weight: 600; font-size: 13px; }
        .backgrounds-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
          max-height: 300px;
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
