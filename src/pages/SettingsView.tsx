import { useEffect, useState } from 'react'
import { Save, Eye, EyeOff, Sliders, LogIn, LogOut, CheckCircle, Menu, Image as ImageIcon, Film, UserPlus, Cloud, Loader2, FileText } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore, DEFAULT_THEME, CANVAS_SIZE, useAppStore as useStore } from '@/stores'
import { supabase } from '@/services/supabase'
import TermsModal from '@/components/TermsModal'
import { CURRENT_TERMS_VERSION } from '@/constants/terms'

export default function SettingsView() {
  const { settings, updateSettings, isSidebarOpen, toggleSidebar, user, backgrounds, fetchBackgrounds, acceptTerms, setActiveView } = useAppStore(useShallow(s => ({
    settings: s.settings, updateSettings: s.updateSettings, isSidebarOpen: s.isSidebarOpen, 
    toggleSidebar: s.toggleSidebar, user: s.user, backgrounds: s.backgrounds, fetchBackgrounds: s.fetchBackgrounds,
    acceptTerms: s.acceptTerms, setActiveView: s.setActiveView
  })))
  const { updateTheme, theme, media } = useProjectionStore(useShallow(s => ({
    updateTheme: s.updateTheme, theme: s.state.theme, media: s.state.media
  })))
  const state = { theme, media } // Polyfill to avoid modifying all 'state.theme' accesses
  const [showSecret, setShowSecret] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showTermsForSignup, setShowTermsForSignup] = useState(false)
  const [pendingSignup, setPendingSignup] = useState<(() => void) | null>(null)

  useEffect(() => {
    fetchBackgrounds()
  }, [])

  // Auth states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [loadingAuth, setLoadingAuth] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(true)

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setAuthError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) {
      setAuthError(error.message)
      setGoogleLoading(false)
    }
  }

  const set = (key: string, value: any) => updateSettings({ [key]: value } as any)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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
    'Cinzel, serif',
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
              
              <button
                type="button"
                className="btn-google-settings"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
              >
                {googleLoading ? <Loader2 className="spin" size={16} /> : (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continuar con Google
              </button>

              <div className="auth-divider-settings"><span>o</span></div>

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
                    setPendingSignup(() => async () => {
                      setLoadingAuth(true)
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
                      setLoadingAuth(false)
                    })
                    setShowTermsForSignup(true)
                    setLoadingAuth(false)
                    return
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
                  : <>¡Gratis! Al crear una cuenta aceptas nuestros{' '}
                    <button 
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}
                      onClick={() => setActiveView('terms')}
                    >
                      Términos y Condiciones
                    </button>.</>
                }
              </p>
            </div>
          ) : (
            <div className="session-card">
              <div className="session-profile">
                <div className="session-avatar">
                  {user.email?.[0].toUpperCase() ?? 'U'}
                </div>
                <div className="session-details">
                  <div className="session-email">{user.email}</div>
                  <div className="session-status">
                    <Cloud size={12} />
                    <span>Sincronización activa</span>
                    <span className="status-divider">•</span>
                    <span className="status-plan">Plan Escritura</span>
                  </div>
                </div>
              </div>
              
              <div className="session-actions-grid">
                <button className="btn-session logout" onClick={() => {
                  supabase.auth.signOut()
                  useAppStore.getState().setGuestMode(false)
                }}>
                  <LogOut size={16} />
                  <span>Cerrar Sesión</span>
                </button>
                
                <button className="btn-session terms" onClick={() => setActiveView('terms')}>
                  <FileText size={16} />
                  <span>Términos y condiciones</span>
                </button>
              </div>
            </div>
          )}
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
              <label>Posición Cita Bíblica</label>
              <select 
                value={state.theme.verseReferencePosition || 'top'} 
                onChange={e => updateTheme({ verseReferencePosition: e.target.value as any })}
              >
                <option value="top">Arriba</option>
                <option value="bottom">Abajo</option>
              </select>
            </div>
            <div className="form-group">
              <label>Transición</label>
              <select value={state.theme.transition} onChange={e => updateTheme({ transition: e.target.value as any })}>
                {TRANSITIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group checkboxes">
            <label className="checkbox-label">
              <input type="checkbox" checked={state.theme.textShadow}
                onChange={e => updateTheme({ textShadow: e.target.checked })} />
              Sombra en el texto
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={state.theme.textUppercase || false}
                onChange={e => updateTheme({ textUppercase: e.target.checked })} />
              Texto en mayúsculas
            </label>
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
              {(() => {
                const bgFilter = `blur(${state.theme.backgroundBlur || 0}px) brightness(${1 - (state.theme.backgroundOverlayOpacity ?? 0.3)})`
                const bgTransform = state.theme.backgroundBlur ? 'scale(1.1)' : 'none'
                
                return (
                  <>
                    <div className="preview-background-layer" style={{ 
                      position: 'absolute', inset: 0,
                      filter: bgFilter,
                      transform: bgTransform,
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

                    {/* Proyección de Media (Fondo Dinámico) en la vista previa */}
                    {state.media && (
                      <div 
                        className="preview-media-layer" 
                        style={{ 
                          position: 'absolute', inset: 0, 
                          zIndex: state.media.isBackgroundMode ? 2 : 20, 
                          background: state.media.isBackgroundMode ? 'transparent' : '#000',
                          filter: state.media.isBackgroundMode ? bgFilter : 'none',
                          transform: state.media.isBackgroundMode ? bgTransform : 'none'
                        }}
                      >
                        {state.media.type === 'video' ? (
                          <video 
                            autoPlay 
                            loop 
                            muted
                            style={{ width: '100%', height: '100%', objectFit: state.media.isBackgroundMode ? 'cover' : 'contain' }}
                            src={state.media.url}
                          />
                        ) : (
                          <img 
                            src={state.media.url} 
                            style={{ width: '100%', height: '100%', objectFit: state.media.isBackgroundMode ? 'cover' : 'contain' }} 
                          />
                        )}
                      </div>
                    )}
                  </>
                )
              })()}
              
              {/* Capa de oscurecimiento */}
              <div style={{ 
                position: 'absolute', inset: 0, 
                backgroundColor: `rgba(0,0,0,${state.theme.backgroundOverlayOpacity ?? 0.3})`,
                zIndex: 5 
              }} />

              <div className="preview-content" style={{
                fontFamily: state.theme.fontFamily,
                fontSize: '26px',
                color: state.theme.textColor,
                textShadow: state.theme.textShadow ? '0 2px 10px rgba(0,0,0,0.8)' : 'none',
                textTransform: state.theme.textUppercase ? 'uppercase' : 'none',
                textAlign: 'center', lineHeight: 1.15, padding: '12px', position: 'relative', zIndex: 10,
                display: 'flex', flexDirection: 'column', gap: '2px',
                width: '100%',
                fontWeight: 900,
                maxWidth: '100%',
                maxHeight: '100%',
                wordBreak: 'break-word',
                overflow: 'hidden',
                justifyContent: 'center'
              }}>
                {(state.theme.verseReferencePosition !== 'bottom') && (
                  <div style={{ opacity: 0.7, fontSize: '0.85em', marginBottom: 2 }}>
                    Salmos 19:1
                  </div>
                )}
                
                <div style={{ width: '100%' }}>
                  <div>Señor mi Dios</div>
                  <div>al contemplar los cielos</div>
                  <div>El firmamento</div>
                  <div>y las estrellas mil</div>
                </div>

                {(state.theme.verseReferencePosition === 'bottom') && (
                  <div style={{ opacity: 0.7, fontSize: '0.85em', marginTop: 2 }}>
                    Salmos 19:1
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

      {showTermsForSignup && (
        <TermsModal
          mode="optional"
          onAccept={async () => {
            await acceptTerms(CURRENT_TERMS_VERSION)
            setShowTermsForSignup(false)
            pendingSignup?.()
            setPendingSignup(null)
          }}
          onClose={() => {
            setShowTermsForSignup(false)
            setPendingSignup(null)
          }}
        />
      )}

      <style>{`
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
        .btn-google-settings {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 10px 16px;
          background: #fff;
          color: #3c4043;
          border: 1px solid #dadce0;
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 4px;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .btn-google-settings:hover:not(:disabled) {
          background: #f8f9fa;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .btn-google-settings:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-divider-settings {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-muted);
          font-size: 11px;
          margin: 8px 0;
        }
        .auth-divider-settings::before,
        .auth-divider-settings::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        /* Session Active Card */
        .session-card {
          background: linear-gradient(145deg, var(--bg-elevated), var(--bg-base));
          border: 1px solid var(--border-light);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .session-profile {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .session-avatar {
          width: 48px;
          height: 48px;
          background: var(--gold);
          color: black;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-weight: 700;
          font-size: 20px;
          box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
        }
        .session-email {
          font-weight: 600;
          font-size: 15px;
          color: var(--text-primary);
          margin-bottom: 2px;
          word-break: break-all;
        }
        .session-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .session-status svg {
          color: var(--green);
        }
        .status-divider {
          color: var(--border);
        }
        .status-plan {
          color: var(--gold);
          font-weight: 600;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.5px;
        }
        .session-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .btn-session {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          color: var(--text-secondary);
        }
        .btn-session:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-light);
          transform: translateY(-1px);
        }
        .btn-session.logout:hover {
          background: rgba(224, 85, 85, 0.1);
          color: var(--red);
          border-color: var(--red-dim);
        }
        
        @media (max-width: 480px) {
          .session-actions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
