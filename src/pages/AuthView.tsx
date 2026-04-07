import { useState } from 'react'
import { supabase } from '@/services/supabase'
import { LogIn, UserPlus, Mail, Lock, Loader2, Music2 } from 'lucide-react'

// Icono SVG de Google (no está en lucide)
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

export default function AuthView() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string>('')
  const [mfaCode, setMfaCode] = useState('')

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mfaRequired) {
        // Verify MFA code
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: mfaCode,
          type: 'mfa'
        })
        if (error) throw error
        setMfaRequired(false)
        setMfaCode('')
      } else {
        if (isLogin) {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
          if (data.user && data.session && data.session.access_token) {
            // Check if MFA is required
            const factors = data.user.factors || []
            if (factors.length > 0) {
              setMfaRequired(true)
              setMfaFactorId(factors[0].id)
            }
          }
        } else {
          const { error } = await supabase.auth.signUp({ email, password })
          if (error) throw error
          setSuccess(true)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-overlay">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="success-icon" style={{ color: 'var(--green)', fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
          <h2>¡Registro exitoso!</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Hemos enviado un correo de confirmación. Por favor verifica tu bandeja para continuar.
          </p>
          <button className="btn-primary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => setIsLogin(true)}>
            Ir al Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Music2 size={32} color="var(--gold)" />
            <span>Proclama <span>Pro</span></span>
          </div>
          <h1>{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h1>
          <p>{isLogin ? 'Accede a tus listas y ajustes personales' : 'Únete a la comunidad de Proclama'}</p>
        </div>

        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          aria-label="Continuar con Google"
        >
          {googleLoading ? <Loader2 className="spin" size={18} /> : <GoogleIcon />}
          Continuar con Google
        </button>

        <div className="auth-divider"><span>o</span></div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label><Mail size={14} aria-hidden="true" /> Correo Electrónico</label>
            <input 
              type="email" 
              required 
              placeholder="tu@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label><Lock size={14} aria-hidden="true" /> Contraseña</label>
            <input 
              type="password" 
              required 
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {mfaRequired && (
            <div className="form-group">
              <label>Código MFA</label>
              <input 
                type="text" 
                required 
                placeholder="123456"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value)}
              />
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button className="btn-primary large" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" size={20} /> : (mfaRequired ? <CheckCircle size={18} /> : (isLogin ? <LogIn size={18} /> : <UserPlus size={18} />))}
            {mfaRequired ? 'Verificar MFA' : (isLogin ? 'Entrar' : 'Registrarse')}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin ? (
            <p>¿No tienes cuenta? <button onClick={() => setIsLogin(false)}>Regístrate</button></p>
          ) : (
            <p>¿Ya tienes cuenta? <button onClick={() => setIsLogin(true)}>Inicia sesión</button></p>
          )}
        </div>
      </div>

      <style>{`
        .auth-overlay {
          position: fixed; inset: 0;
          background: #060810;
          display: flex; align-items: center; justify-content: center;
          z-index: 2000;
          padding: 20px;
        }
        .auth-card {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 40px;
          max-width: 440px;
          width: 100%;
          box-shadow: 0 30px 60px rgba(0,0,0,0.5);
        }
        .auth-header { text-align: center; margin-bottom: 30px; }
        .auth-logo { 
          display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px;
          font-family: var(--font-display); font-size: 24px; font-weight: 600; color: var(--text-primary);
        }
        .auth-logo span span { color: var(--gold); }
        .auth-header h1 { font-family: var(--font-display); font-size: 24px; margin-bottom: 8px; }
        .auth-header p { color: var(--text-secondary); font-size: 14px; }
        .auth-form { display: flex; flex-direction: column; gap: 20px; }
        .auth-error { 
           padding: 10px; border-radius: var(--radius-sm); 
           background: rgba(224, 85, 85, 0.1); color: var(--red); 
           font-size: 13px; border: 1px solid var(--red-dim);
        }
        .auth-footer { text-align: center; margin-top: 24px; color: var(--text-muted); font-size: 13px; }
        .auth-footer button { color: var(--gold); font-weight: 600; margin-left: 5px; }
        .auth-footer button:hover { text-decoration: underline; }
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
        .btn-google {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 11px 16px;
          background: #fff;
          color: #3c4043;
          border: 1px solid #dadce0;
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
        }
        .btn-google:hover:not(:disabled) {
          background: #f8f9fa;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .btn-google:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-muted);
          font-size: 12px;
          margin: 4px 0;
        }
        .auth-divider::before,
        .auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }
      `}</style>
    </div>
  )
}
