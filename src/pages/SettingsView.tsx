import { useState } from 'react'
import { Save, Eye, EyeOff, ExternalLink, Sliders, LogIn, LogOut, CheckCircle } from 'lucide-react'
import { useAppStore, useProjectionStore, DEFAULT_THEME } from '@/stores'
import { supabase } from '@/services/supabase'

export default function SettingsView() {
  const { settings, updateSettings } = useAppStore()
  const { updateTheme, state } = useProjectionStore()
  const [showSecret, setShowSecret] = useState(false)
  const [showGeniusToken, setShowGeniusToken] = useState(false)
  const [saved, setSaved] = useState(false)

  // Auth states
  const { user } = useAppStore()
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
        <h1>Ajustes</h1>
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

        {/* Iglesia */}
        <section className="settings-section">
          <h2>Información de la Iglesia</h2>
          <div className="form-group">
            <label>Nombre de la Iglesia</label>
            <input type="text" value={settings.churchName} onChange={e => set('churchName', e.target.value)} />
          </div>
          <div className="form-group">
            <label>URL del Logo (imagen)</label>
            <input type="text" placeholder="https://..." value={settings.churchLogoUrl ?? ''} onChange={e => set('churchLogoUrl', e.target.value)} />
          </div>
        </section>

        {/* ACRCloud */}
        <section className="settings-section">
          <h2>
            ACRCloud — Reconocimiento de Audio
            <a href="https://console.acrcloud.com" target="_blank" rel="noreferrer" className="settings-link">
              <ExternalLink size={13} /> Registrarse gratis
            </a>
          </h2>
          <div className="settings-info">
            Tier gratuito: 100 solicitudes/día. Con X32 conectada al PC obtendrás alta precisión.
          </div>
          <div className="form-group">
            <label>Host</label>
            <input type="text" placeholder="identify-eu-west-1.acrcloud.com" value={settings.acrcloudHost} onChange={e => set('acrcloudHost', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Access Key</label>
            <input type="text" value={settings.acrcloudAccessKey} onChange={e => set('acrcloudAccessKey', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Access Secret</label>
            <div className="input-with-icon">
              <input
                type={showSecret ? 'text' : 'password'}
                value={settings.acrcloudAccessSecret}
                onChange={e => set('acrcloudAccessSecret', e.target.value)}
              />
              <button className="btn-icon" onClick={() => setShowSecret(s => !s)}>
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Modo de reconocimiento</label>
              <select value={settings.recognitionMode} onChange={e => set('recognitionMode', e.target.value)}>
                <option value="assisted">Asistido (confirmación manual)</option>
                <option value="automatic">Automático (sin confirmación)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Umbral de confianza (%)</label>
              <input
                type="number" min="50" max="100" step="5"
                value={settings.recognitionConfidenceThreshold}
                onChange={e => set('recognitionConfidenceThreshold', Number(e.target.value))}
              />
            </div>
          </div>
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
          <div className="form-row">
            <div className="form-group">
              <label>Color de fondo</label>
              <div className="color-input-row">
                <input type="color" value={state.theme.background.startsWith('#') ? state.theme.background : '#0a0a0f'}
                  onChange={e => updateTheme({ background: e.target.value })} />
                <input type="text" value={state.theme.background} onChange={e => updateTheme({ background: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Color de texto</label>
              <div className="color-input-row">
                <input type="color" value={state.theme.textColor} onChange={e => updateTheme({ textColor: e.target.value })} />
                <input type="text" value={state.theme.textColor} onChange={e => updateTheme({ textColor: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fuente</label>
              <select value={state.theme.fontFamily} onChange={e => updateTheme({ fontFamily: e.target.value })}>
                {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Tamaño de texto ({state.theme.fontSize}px)</label>
              <input type="range" min="40" max="120" step="4"
                value={state.theme.fontSize}
                onChange={e => updateTheme({ fontSize: Number(e.target.value) })} />
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

          {/* Preview del tema */}
          <div className="theme-preview" style={{ background: state.theme.background }}>
            <div style={{
              fontFamily: state.theme.fontFamily,
              fontSize: `${Math.round(state.theme.fontSize * 0.4)}px`,
              color: state.theme.textColor,
              textShadow: state.theme.textShadow ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
              textAlign: 'center', lineHeight: 1.5, padding: '20px'
            }}>
              <div style={{ opacity: 0.5, fontSize: `${Math.round(state.theme.fontSize * 0.18)}px`, marginBottom: 8 }}>
                {state.theme.showTitle ? 'Cuán Grande Es Él' : ''}
              </div>
              <div>Señor mi Dios</div>
              <div>al contemplar los cielos</div>
              <div>El firmamento</div>
              <div>y las estrellas mil</div>
            </div>
          </div>
        </section>

        <button className="btn-primary large" onClick={handleSave}>
          <Save size={16} /> {saved ? '¡Cambios guardados!' : 'Guardar todos los ajustes'}
        </button>
      </div>
    </div>
  )
}
