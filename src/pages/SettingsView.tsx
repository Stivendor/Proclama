import { useEffect, useState } from 'react'
import { Save, Eye, EyeOff, ExternalLink, Sliders, LogIn, LogOut, CheckCircle, Menu, Image as ImageIcon, Film, UserPlus, Cloud, CloudOff } from 'lucide-react'
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
  const [isLoginMode, setIsLoginMode] = useState(true)

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
          <button className="btn-primary" onClick={handleSave} aria-label="Guardar todos los ajustes">
            <Save size={15} /> {saved ? '¡Guardado!' : 'Guardar'}
          </button>
      </div>

      <div className="settings-body">
        <div className="settings-config-col">
        {/* Cuenta y Sincronización */}
        <section className="settings-section">
          <h2>Sincronización en la Nube</h2>
          {!user ? (
            <div className="auth-card">
              <div className="sync-benefits">
                <div className="sync-benefit-item">
                  <Cloud size={16} />
                  <span>Sincroniza tus setlists en todos tus dispositivos</span>
                </div>
                <div className="sync-benefit-item">
                  <Cloud size={16} />
                  <span>Respaldo automático de tu biblioteca de canciones</span>
                </div>
                <div className="sync-benefit-item">
                  <Cloud size={16} />
                  <span>Comparte y accede desde cualquier lugar</span>
                </div>
              </div>
              
              <div className="auth-toggle">
                <button 
                  className={`toggle-btn ${isLoginMode ? 'active' : ''}`}
                  onClick={() => setIsLoginMode(true)}
                >
                  Iniciar Sesión
                </button>
                <button 
                  className={`toggle-btn ${!isLoginMode ? 'active' : ''}`}
                  onClick={() => setIsLoginMode(false)}
                >
                  Crear Cuenta
                </button>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Correo Electrónico</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" autoComplete="email" />
                </div>
                <div className="form-group">
                  <label>Contraseña</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isLoginMode ? '••••••••' : 'Mínimo 6 caracteres'} autoComplete={isLoginMode ? 'current-password' : 'new-password'} />
                </div>
              </div>
              {authError && <div style={{ color: '#ff4d4f', fontSize: 13, marginBottom: 12 }}>{authError}</div>}
              <button 
                className="btn-primary" 
                disabled={loadingAuth || !email || !password}
                onClick={async () => {
                  setLoadingAuth(true)
                  setAuthError('')
                  
                  if (isLoginMode) {
                    const { error } = await supabase.auth.signInWithPassword({ email, password })
                    if (error) setAuthError(error.message)
                  } else {
                    const { error } = await supabase.auth.signUp({ 
                      email, 
                      password,
                      options: {
                        data: { email }
                      }
                    })
                    if (error) {
                      setAuthError(error.message)
                    } else {
                      setAuthError('')
                    }
                  }
                  setLoadingAuth(false)
                }}
              >
                {isLoginMode ? <LogIn size={15} /> : <UserPlus size={15} />}
                {loadingAuth ? 'Cargando…' : (isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta')}
              </button>
              <p className="auth-hint">
                {isLoginMode 
                  ? '¿No tienes cuenta? Usa "Crear Cuenta" para registrarte.' 
                  : '¡Gratis! Solo necesitas un correo y contraseña.'}
              </p>
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
              <button className="btn-secondary" onClick={() => {
                supabase.auth.signOut()
                useAppStore.getState().setGuestMode(false)
              }}>
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
              <label>Tamaño de Letra</label>
              <div className="segmented-control">
                <button 
                  className={!state.theme.fontSizeMax ? 'active' : ''}
                  onClick={() => updateTheme({ fontSizeMax: false })}
                >
                  Manual
                </button>
                <button 
                  className={state.theme.fontSizeMax ? 'active' : ''}
                  onClick={() => updateTheme({ fontSizeMax: true })}
                >
                  Máximo
                </button>
              </div>
            </div>
            {!state.theme.fontSizeMax && (
              <div className="form-group">
                <label>Tamaño ({state.theme.fontSize}px)</label>
                <input 
                  type="range" min="20" max="200" step="2"
                  value={state.theme.fontSize}
                  onChange={e => updateTheme({ fontSize: parseInt(e.target.value) })}
                  className="proclama-range"
                />
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
              <label>Posición Título</label>
              <select 
                value={state.theme.titlePosition || 'top'} 
                onChange={e => updateTheme({ titlePosition: e.target.value as any })}
              >
                <option value="top">Arriba</option>
                <option value="bottom">Abajo</option>
                <option value="none">Oculto</option>
              </select>
            </div>
            <div className="form-group">
              <label>Posición Cita Bíblica</label>
              <select 
                value={state.theme.verseReferencePosition || 'top'} 
                onChange={e => updateTheme({ verseReferencePosition: e.target.value as any })}
              >
                <option value="top">Arriba</option>
                <option value="bottom">Abajo</option>
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

        </section>
        </div>

        {/* Columna Derecha de Preview */}
        <div className="settings-preview-col">
          <section className="settings-section preview-section">
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
                fontSize: state.theme.fontSizeMax ? '26px' : `${Math.min(32, Math.round(state.theme.fontSize * 0.15))}px`,
                color: state.theme.textColor,
                textShadow: state.theme.textShadow ? '0 2px 10px rgba(0,0,0,0.8)' : 'none',
                textAlign: 'center', lineHeight: 1.2, padding: '12px', position: 'relative', zIndex: 2,
                display: 'flex', flexDirection: 'column', gap: '2px',
                width: '100%',
                maxWidth: '100%',
                maxHeight: '100%',
                wordBreak: 'break-word',
                overflow: 'hidden',
                justifyContent: 'center'
              }}>
                {(state.theme.titlePosition === 'top' && state.theme.showTitle) && (
                  <div style={{ opacity: 0.5, fontSize: '0.4em', marginBottom: 2 }}>
                    CUÁN GRANDE ES ÉL
                  </div>
                )}
                
                <div style={{ width: '100%' }}>
                  <div>Señor mi Dios</div>
                  <div>al contemplar los cielos</div>
                  <div>El firmamento</div>
                  <div>y las estrellas mil</div>
                </div>

                {(state.theme.titlePosition === 'bottom' && state.theme.showTitle) && (
                  <div style={{ opacity: 0.5, fontSize: '0.4em', marginTop: 2 }}>
                    CUÁN GRANDE ES ÉL
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ marginTop: '24px' }}>
              <button className="btn-primary large" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSave}>
                <Save size={16} /> {saved ? '¡Cambios guardados!' : 'Guardar todos los ajustes'}
              </button>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .settings-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px 32px;
          display: grid;
          grid-template-columns: 1fr 450px;
          gap: 40px;
          align-items: start;
          padding-bottom: 60px;
        }

        @media (max-width: 1024px) {
          .settings-body {
            grid-template-columns: 1fr;
          }
        }

        .settings-config-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .settings-preview-col {
          position: sticky;
          top: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .preview-section {
          padding: 0;
          background: var(--bg-default);
          border: none;
          position: sticky;
          top: -24px;
          z-index: 50;
          padding-top: 24px;
          margin-top: -24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }

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
        .sync-benefits {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
          padding: 16px;
          background: rgba(212, 175, 55, 0.05);
          border-radius: 8px;
          border: 1px solid rgba(212, 175, 55, 0.15);
        }
        .sync-benefit-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .sync-benefit-item svg { color: var(--gold); flex-shrink: 0; }
        .auth-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }
        .toggle-btn {
          flex: 1;
          padding: 10px 16px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .toggle-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .toggle-btn.active {
          background: var(--gold);
          border-color: var(--gold);
          color: black;
        }
        .auth-hint {
          text-align: center;
          margin-top: 12px;
          font-size: 12px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  )
}
