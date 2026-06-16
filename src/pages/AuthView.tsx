import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/services/supabase'
import { Loader2, Music2, ChevronRight, ChevronLeft, Church, User, Mail, Lock, Eye, EyeOff, Check, Globe } from 'lucide-react'
import { useAppStore } from '@/stores'
import { CURRENT_TERMS_VERSION } from '@/constants/terms'
import TermsModal from '@/components/terms/TermsModal'
import { LATAM_COUNTRIES } from '@/constants/latamLocations'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function getEmailSuggestion(email: string): string | null {
  const emailRegex = /^([^@]+)@([^@]+)$/;
  const match = email.trim().toLowerCase().match(emailRegex);
  if (!match) return null;

  const [_, localPart, domain] = match;

  const typoMap: Record<string, string> = {
    'gamil.com': 'gmail.com',
    'gamil.co': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gamil.net': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gmeil.com': 'gmail.com',
    
    'hotamil.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'hotmal.com': 'hotmail.com',
    'hormail.com': 'hotmail.com',
    'hotamil.es': 'hotmail.es',
    'hotmial.es': 'hotmail.es',
    
    'outlok.com': 'outlook.com',
    'outlok.es': 'outlook.es',
    'outlook.co': 'outlook.com',
    
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'yahoo.co': 'yahoo.com',
  };

  if (typoMap[domain]) {
    return `${localPart}@${typoMap[domain]}`;
  }

  return null;
}

type AuthMode = 'login' | 'register'
type RegisterStep = 1 | 2

export default function AuthView() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [step, setStep] = useState<RegisterStep>(1)
  const [showTermsModal, setShowTermsModal] = useState(false)

  // Step 1 fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  // Step 2 fields
  const [churchName, setChurchName] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [customCountry, setCustomCountry] = useState('')
  const [customCity, setCustomCity] = useState('')

  // State
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)

  const handleEmailChange = (val: string) => {
    setEmail(val)
    const suggestion = getEmailSuggestion(val)
    setEmailSuggestion(suggestion)
  }

  const acceptSuggestion = () => {
    if (emailSuggestion) {
      setEmail(emailSuggestion)
      setEmailSuggestion(null)
    }
  }

  useEffect(() => {
    cardRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    setEmailSuggestion(null)
  }, [mode, step])

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } }
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return setError('Completa todos los campos.')
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes('Invalid login')) {
          setError('Correo o contraseña incorrectos.')
        } else if (error.message.includes('Email not confirmed')) {
          setError('Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.')
        } else {
          setError(error.message)
        }
      }
    } catch (err: any) {
      console.error('Login exception occurred:', err)
      setError(err?.message || 'Error de conexión. Por favor intenta de nuevo en unos momentos.')
    } finally {
      setLoading(false)
    }
  }

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!fullName.trim()) return setError('Ingresa tu nombre.')
    if (!email.trim()) return setError('Ingresa tu correo.')
    if (!password || password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (!termsAccepted) return setError('Debes aceptar los Términos y Condiciones.')
    setStep(2)
  }

  const handleRegister = async (skipChurch = false) => {
    setLoading(true)
    setError(null)

    const finalCountry = skipChurch
      ? ''
      : country === 'OTHER'
      ? customCountry.trim()
      : country;
    const finalCity = skipChurch
      ? ''
      : city === 'OTHER'
      ? customCity.trim()
      : city;

    try {
      const metadata: Record<string, string> = {
        full_name: fullName.trim(),
      }
      if (!skipChurch && churchName.trim()) {
        metadata.church_name = churchName.trim()
      }
      if (!skipChurch && finalCountry) {
        metadata.country = finalCountry
      }
      if (!skipChurch && finalCity) {
        metadata.city = finalCity
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: metadata,
        }
      })

      if (signUpError) {
        let msg = signUpError.message
        if (msg === '{}' || !msg || msg.trim() === '') {
          msg = 'Error de Servidor (SMTP/504). El servidor de correo de Supabase tardó demasiado en responder. Por favor, ve a tu panel de Supabase -> Auth -> Email Providers y desactiva la opción "Confirm email" para registrarte sin problemas.'
        }
        if (msg.includes('already registered')) {
          setError('Este correo ya está registrado. Intenta iniciar sesión.')
        } else {
          setError(msg)
        }
        setLoading(false)
        return
      }

      // Accept terms securely to prevent any terms sync errors from hanging the signup loading state
      try {
        const { acceptTerms } = useAppStore.getState()
        await acceptTerms(CURRENT_TERMS_VERSION)
      } catch (termsErr) {
        console.warn('Accept terms failed during registration, but continuing:', termsErr)
      }

      // If user needs email confirmation
      if (data.user && !data.session) {
        setSuccessMessage('¡Cuenta creada! Revisa tu correo para confirmar tu cuenta.')
        setLoading(false)
        return
      }

      // If auto-confirmed (e.g. in dev/prod with email confirm off), update profile and redirect immediately
      if (data.user && data.session) {
        try {
          const settingsUpdate: Record<string, any> = {
            onboardingComplete: true, // Mark onboarding complete immediately to prevent redundant popups
          }
          if (!skipChurch && churchName.trim()) settingsUpdate.churchName = churchName.trim()
          if (!skipChurch && finalCountry) settingsUpdate.country = finalCountry
          if (!skipChurch && finalCity) settingsUpdate.city = finalCity

          await supabase.from('profiles').update({
            full_name: fullName.trim(),
            settings: settingsUpdate,
          }).eq('id', data.user.id)
        } catch (err) {
          console.warn('Profile update after signup failed:', err)
        }

        // ── MANUALLY UPDATE STORE TO REDIRECT LOGGED IN USERS IMMEDIATELY ──
        try {
          const store = useAppStore.getState()
          store.setUser(data.user)
          store.setForceLanding(false)
          store.setAuthStatus('authenticated')
        } catch (storeErr) {
          console.warn('Manual store update failed:', storeErr)
        }
      }
    } catch (err: any) {
      console.error('Signup exception occurred:', err)
      let msg = err?.message || ''
      if (msg === '{}' || !msg || msg.trim() === '') {
        msg = 'Error de conexión (Timeout 504). El servidor de correo de Supabase no responde. Desactiva "Confirm email" en tu consola de Supabase para poder registrarte.'
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (successMessage) {
    return (
      <div className="auth-overlay">
        <div className="auth-card" ref={cardRef}>
          <div className="auth-header">
            <div className="auth-logo">
              <Music2 size={32} color="var(--gold, #c9a658)" />
              <span>Proclama <span>Pro</span></span>
            </div>
            <div className="auth-success-icon">
              <Check size={32} />
            </div>
            <h1>¡Cuenta Creada!</h1>
            <p>{successMessage}</p>
          </div>
          <button
            type="button"
            className="auth-btn-primary"
            onClick={() => {
              setSuccessMessage(null)
              setMode('login')
              setStep(1)
              setPassword('')
            }}
          >
            Ir a Iniciar Sesión
          </button>
        </div>
        <AuthStyles />
      </div>
    )
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card" ref={cardRef}>
        <div className="auth-header">
          <div className="auth-logo">
            <Music2 size={32} color="var(--gold, #c9a658)" />
            <span>Proclama <span>Pro</span></span>
          </div>

          {mode === 'login' ? (
            <>
              <h1>Iniciar Sesión</h1>
              <p>Accede a tus listas y ajustes personales</p>
            </>
          ) : (
            <>
              <h1>Crear Cuenta</h1>
              <div className="step-indicator">
                <div className={`step-dot ${step >= 1 ? 'active' : ''}`}><span>1</span></div>
                <div className="step-line"><div className={`step-line-fill ${step >= 2 ? 'filled' : ''}`} /></div>
                <div className={`step-dot ${step >= 2 ? 'active' : ''}`}><span>2</span></div>
              </div>
              <p>{step === 1 ? 'Datos de tu cuenta' : 'Datos de tu iglesia (opcional)'}</p>
            </>
          )}
        </div>

        {/* ─── LOGIN MODE ─── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-input-group">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {emailSuggestion && (
              <div className="auth-email-suggestion">
                ¿Quisiste decir <button type="button" onClick={acceptSuggestion}>{emailSuggestion}</button>?
              </div>
            )}
            <div className="auth-input-group">
              <Lock size={16} className="auth-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button type="submit" className="auth-btn-primary" disabled={loading}>
              {loading ? <Loader2 className="spin" size={18} /> : 'Iniciar Sesión'}
            </button>

            <div className="auth-divider"><span>o</span></div>

            <button type="button" className="auth-btn-google" onClick={handleGoogleLogin} disabled={googleLoading}>
              {googleLoading ? <Loader2 className="spin" size={18} /> : <GoogleIcon />}
              Continuar con Google
            </button>
          </form>
        )}

        {/* ─── REGISTER STEP 1 ─── */}
        {mode === 'register' && step === 1 && (
          <form onSubmit={handleStep1Next} className="auth-form">
            <div className="auth-input-group">
              <User size={16} className="auth-input-icon" />
              <input
                type="text"
                placeholder="Nombre completo"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className="auth-input-group">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {emailSuggestion && (
              <div className="auth-email-suggestion">
                ¿Quisiste decir <button type="button" onClick={acceptSuggestion}>{emailSuggestion}</button>?
              </div>
            )}
            <div className="auth-input-group">
              <Lock size={16} className="auth-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña (mín. 6 caracteres)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <label className="auth-checkbox-label">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
              />
              <span>
                Acepto los{' '}
                <button type="button" className="auth-terms-link" onClick={() => setShowTermsModal(true)}>
                  Términos y Condiciones
                </button>
              </span>
            </label>

            <button type="submit" className="auth-btn-primary">
              Siguiente <ChevronRight size={18} />
            </button>

            <div className="auth-divider"><span>o</span></div>

            <button type="button" className="auth-btn-google" onClick={handleGoogleLogin} disabled={googleLoading}>
              {googleLoading ? <Loader2 className="spin" size={18} /> : <GoogleIcon />}
              Registrarse con Google
            </button>
          </form>
        )}

        {/* ─── REGISTER STEP 2 (OPTIONAL) ─── */}
        {mode === 'register' && step === 2 && (
          <div className="auth-form">
            <div className="auth-step2-header">
              <Church size={28} color="var(--gold, #c9a658)" />
              <p className="auth-step2-hint">Puedes completar estos datos después si lo prefieres.</p>
            </div>

            <div className="auth-input-group">
              <Church size={16} className="auth-input-icon" />
              <input
                type="text"
                placeholder="Nombre de tu iglesia"
                value={churchName}
                onChange={e => setChurchName(e.target.value)}
                autoComplete="organization"
              />
            </div>

            {/* Selector de País */}
            <div className="auth-input-group">
              <Globe size={16} className="auth-input-icon" />
              <select
                value={country}
                onChange={e => {
                  setCountry(e.target.value)
                  setCity('')
                }}
                className="auth-select"
              >
                <option value="" disabled>Selecciona tu país</option>
                {LATAM_COUNTRIES.map(c => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
                <option value="OTHER">Otro / No listado</option>
              </select>
            </div>

            {/* Input manual de País */}
            {country === 'OTHER' && (
              <div className="auth-input-group">
                <Globe size={16} className="auth-input-icon" />
                <input
                  type="text"
                  placeholder="Escribe tu país"
                  value={customCountry}
                  onChange={e => setCustomCountry(e.target.value)}
                />
              </div>
            )}

            {/* Selector de Ciudad (filtrado por País) */}
            {country && country !== 'OTHER' && (
              <div className="auth-input-group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="auth-input-icon"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="auth-select"
                >
                  <option value="" disabled>Selecciona tu ciudad</option>
                  {LATAM_COUNTRIES.find(c => c.name === country)?.cities.map(ct => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                  <option value="OTHER">Otra ciudad / No listada</option>
                </select>
              </div>
            )}

            {/* Input manual de Ciudad */}
            {(city === 'OTHER' || country === 'OTHER') && (
              <div className="auth-input-group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="auth-input-icon"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <input
                  type="text"
                  placeholder="Escribe tu ciudad"
                  value={customCity}
                  onChange={e => setCustomCity(e.target.value)}
                />
              </div>
            )}

            <button
              type="button"
              className="auth-btn-primary"
              onClick={() => handleRegister(false)}
              disabled={loading}
            >
              {loading ? <Loader2 className="spin" size={18} /> : 'Completar Registro'}
            </button>

            <button
              type="button"
              className="auth-btn-secondary"
              onClick={() => handleRegister(true)}
              disabled={loading}
            >
              Omitir por ahora
            </button>

            <button
              type="button"
              className="auth-back-btn"
              onClick={() => { setStep(1); setError(null) }}
            >
              <ChevronLeft size={16} /> Volver al paso anterior
            </button>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-toggle">
          {mode === 'login' ? (
            <p>¿No tienes cuenta? <button type="button" onClick={() => { setMode('register'); setStep(1); setError(null) }}>Crear cuenta</button></p>
          ) : (
            <p>¿Ya tienes cuenta? <button type="button" onClick={() => { setMode('login'); setStep(1); setError(null) }}>Iniciar sesión</button></p>
          )}
        </div>
      </div>

      {showTermsModal && (
        <TermsModal
          mode="optional"
          onAccept={() => {
            setTermsAccepted(true)
            setShowTermsModal(false)
          }}
          onClose={() => setShowTermsModal(false)}
        />
      )}

      <AuthStyles />
    </div>
  )
}

function AuthStyles() {
  return (
    <style>{`
      .auth-overlay {
        position: fixed;
        inset: 0;
        background: #05070d;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 3000;
      }
      .auth-card {
        background: #0f131c;
        border-radius: 20px;
        border: 1px solid rgba(201, 166, 88, 0.12);
        padding: 40px 32px;
        max-width: 420px;
        width: 100%;
        box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 80px rgba(201, 166, 88, 0.04);
        animation: authCardIn 0.35s ease-out;
      }
      @keyframes authCardIn {
        from { opacity: 0; transform: translateY(20px) scale(0.97); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .auth-header {
        text-align: center;
        margin-bottom: 28px;
      }
      .auth-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        margin-bottom: 20px;
      }
      .auth-logo span {
        font-family: 'Montserrat', sans-serif;
        font-size: 24px;
        font-weight: 600;
        color: white;
      }
      .auth-logo span span {
        color: #c9a658;
      }
      .auth-header h1 {
        font-family: 'Montserrat', sans-serif;
        font-size: 24px;
        color: white;
        margin: 0 0 8px;
        font-weight: 700;
      }
      .auth-header p {
        color: #8b98b0;
        font-size: 14px;
        margin: 0;
      }

      /* ── Step indicator ── */
      .step-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0;
        margin: 16px auto 12px;
        max-width: 140px;
      }
      .step-dot {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid rgba(201, 166, 88, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.35s ease;
        background: transparent;
        flex-shrink: 0;
      }
      .step-dot span {
        font-size: 12px;
        font-weight: 700;
        color: rgba(201, 166, 88, 0.4);
        transition: color 0.35s ease;
      }
      .step-dot.active {
        border-color: #c9a658;
        background: rgba(201, 166, 88, 0.12);
        box-shadow: 0 0 12px rgba(201, 166, 88, 0.2);
      }
      .step-dot.active span {
        color: #c9a658;
      }
      .step-line {
        flex: 1;
        height: 2px;
        background: rgba(201, 166, 88, 0.15);
        position: relative;
        overflow: hidden;
      }
      .step-line-fill {
        position: absolute;
        inset: 0;
        background: #c9a658;
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.4s ease;
      }
      .step-line-fill.filled {
        transform: scaleX(1);
      }

      /* ── Form ── */
      .auth-form {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .auth-input-group {
        position: relative;
        display: flex;
        align-items: center;
      }
      .auth-input-icon {
        position: absolute;
        left: 14px;
        color: #5a6577;
        pointer-events: none;
        z-index: 1;
        flex-shrink: 0;
      }
      .auth-input-group input {
        width: 100%;
        padding: 14px 14px 14px 42px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        color: white;
        font-size: 14px;
        transition: border-color 0.2s, box-shadow 0.2s;
        outline: none;
      }
      .auth-input-group input:focus {
        border-color: rgba(201, 166, 88, 0.5);
        box-shadow: 0 0 0 3px rgba(201, 166, 88, 0.08);
      }
      .auth-select {
        width: 100%;
        padding: 14px 14px 14px 42px;
        background: #0f131c;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        color: white;
        font-size: 14px;
        transition: border-color 0.2s, box-shadow 0.2s;
        outline: none;
        cursor: pointer;
      }
      .auth-select:focus {
        border-color: rgba(201, 166, 88, 0.5);
        box-shadow: 0 0 0 3px rgba(201, 166, 88, 0.08);
      }
      .auth-select option {
        background: #0f131c;
        color: white;
      }
      .auth-input-group input::placeholder {
        color: #5a6577;
      }
      .auth-email-suggestion {
        font-size: 12px;
        color: #8b98b0;
        margin-top: -6px;
        margin-bottom: 2px;
        padding-left: 4px;
        animation: authEmailFadeIn 0.2s ease-out;
      }
      .auth-email-suggestion button {
        background: none;
        border: none;
        color: #c9a658;
        font-weight: 600;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
        font-size: 12px;
        outline: none;
      }
      .auth-email-suggestion button:hover {
        color: #d4b164;
      }
      @keyframes authEmailFadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .auth-eye-btn {
        position: absolute;
        right: 12px;
        background: none;
        border: none;
        color: #5a6577;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
      }
      .auth-eye-btn:hover { color: #8b98b0; }

      /* ── Checkbox ── */
      .auth-checkbox-label {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 13px;
        color: #8b98b0;
        cursor: pointer;
        padding: 2px 0;
      }
      .auth-checkbox-label input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: #c9a658;
        margin-top: 1px;
        flex-shrink: 0;
        cursor: pointer;
      }
      .auth-terms-link {
        background: none;
        border: none;
        color: #c9a658;
        text-decoration: underline;
        cursor: pointer;
        font-size: 13px;
        padding: 0;
      }
      .auth-terms-link:hover { color: #d4b164; }

      /* ── Buttons ── */
      .auth-btn-primary {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 14px 20px;
        border-radius: 12px;
        border: none;
        background: linear-gradient(135deg, #d5b164, #bc933b);
        color: #05070d;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 8px 24px rgba(201, 166, 88, 0.2);
      }
      .auth-btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 12px 32px rgba(201, 166, 88, 0.3);
      }
      .auth-btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .auth-btn-secondary {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 12px 20px;
        border-radius: 12px;
        border: 1px solid rgba(201, 166, 88, 0.3);
        background: transparent;
        color: #c9a658;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
      }
      .auth-btn-secondary:hover:not(:disabled) {
        background: rgba(201, 166, 88, 0.06);
        border-color: rgba(201, 166, 88, 0.5);
      }
      .auth-btn-secondary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .auth-btn-google {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 13px 20px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.12);
        background: white;
        color: #333;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s, box-shadow 0.2s;
      }
      .auth-btn-google:hover:not(:disabled) {
        background: #f5f5f5;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      .auth-btn-google:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .auth-back-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: none;
        border: none;
        color: #6b7a90;
        font-size: 13px;
        cursor: pointer;
        padding: 8px 0;
        margin-top: 4px;
      }
      .auth-back-btn:hover { color: #9aa6bb; }

      /* ── Divider ── */
      .auth-divider {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #4a5568;
        font-size: 12px;
        margin: 2px 0;
      }
      .auth-divider::before,
      .auth-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: rgba(255,255,255,0.06);
      }

      /* ── Step 2 header ── */
      .auth-step2-header {
        text-align: center;
        margin-bottom: 4px;
      }
      .auth-step2-hint {
        color: #6b7a90;
        font-size: 13px;
        margin: 10px 0 0;
      }

      /* ── Error ── */
      .auth-error {
        margin-top: 8px;
        padding: 12px 16px;
        border-radius: 10px;
        background: rgba(252, 129, 129, 0.1);
        border: 1px solid rgba(252, 129, 129, 0.2);
        color: #fca5a5;
        font-size: 13px;
        text-align: center;
      }

      /* ── Success ── */
      .auth-success-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(201, 166, 88, 0.12);
        border: 2px solid #c9a658;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        color: #c9a658;
      }

      /* ── Toggle ── */
      .auth-toggle {
        text-align: center;
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid rgba(255,255,255,0.05);
      }
      .auth-toggle p {
        color: #6b7a90;
        font-size: 13px;
        margin: 0;
      }
      .auth-toggle button {
        background: none;
        border: none;
        color: #c9a658;
        font-weight: 700;
        cursor: pointer;
        font-size: 13px;
        padding: 0;
      }
      .auth-toggle button:hover { color: #d4b164; }

      /* ── Spinner ── */
      .spin {
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @media (max-width: 480px) {
        .auth-card {
          padding: 32px 20px;
          border-radius: 16px;
        }
      }
    `}</style>
  )
}