import { useState } from 'react'
import { supabase } from '@/services/supabase'
import { LogIn, UserPlus, Mail, Lock, Loader2, Music2 } from 'lucide-react'

export default function AuthView() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccess(true)
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

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label><Mail size={14} /> Correo Electrónico</label>
            <input 
              type="email" 
              required 
              placeholder="tu@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label><Lock size={14} /> Contraseña</label>
            <input 
              type="password" 
              required 
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="btn-primary large" type="submit" disabled={loading}>
            {loading ? <Loader2 className="spin" size={20} /> : (isLogin ? <LogIn size={18} /> : <UserPlus size={18} />)}
            {isLogin ? 'Entrar' : 'Registrarse'}
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
      `}</style>
    </div>
  )
}
