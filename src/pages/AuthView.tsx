import { useState } from 'react'
import { supabase } from '@/services/supabase'
import { Loader2, Music2 } from 'lucide-react'

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
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } }
      })
      if (error) {
        setError(error.message)
        setGoogleLoading(false)
      }
    } catch {
      setError('No se pudo iniciar sesión con Google. Intenta de nuevo.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Music2 size={32} color="var(--gold, #c9a658)" />
            <span>Proclama <span>Pro</span></span>
          </div>
          <h1>Iniciar Sesión</h1>
          <p>Accede o crea tu cuenta con Google</p>
        </div>

        <button type="button" className="auth-btn-google" onClick={handleGoogleLogin} disabled={googleLoading} autoFocus>
          {googleLoading ? <Loader2 className="spin" size={18} /> : <GoogleIcon />}
          Continuar con Google
        </button>

        {error && <div className="auth-error" role="alert">{error}</div>}
      </div>

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
        color: var(--text-secondary);
        font-size: 14px;
        margin: 0;
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
