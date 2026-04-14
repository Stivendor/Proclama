import { useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ChevronRight, Cpu, FileSpreadsheet, Globe, Lock, Mail, Music2, Shield, Sparkles, Video, Zap } from 'lucide-react'
import AuthView from './AuthView'
import FeedbackModal from '@/components/FeedbackModal'
import TermsModal from '@/components/TermsModal'
import { useAppStore } from '@/stores'
import { CURRENT_TERMS_VERSION } from '@/constants/terms'
import { registerPremiumInterest } from '@/services/supabase'

export default function LandingView() {
  const { setGuestMode, acceptTerms, setActiveView } = useAppStore()
  const [showTermsForGuest, setShowTermsForGuest] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [interestEmail, setInterestEmail] = useState('')
  const [interestStatus, setInterestStatus] = useState<'idle' | 'loading' | 'success' | 'duplicate' | 'error'>('idle')
  const observerRef = useRef<IntersectionObserver | null>(null)

  const handleInterestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!interestEmail) return
    setInterestStatus('loading')
    const result = await registerPremiumInterest(interestEmail.trim().toLowerCase())
    if (!result.success) {
      setInterestStatus('error')
      return
    }
    setInterestStatus(result.alreadyRegistered ? 'duplicate' : 'success')
  }

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible')
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' })

    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
      observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  if (showAuth) {
    return (
      <div className="landing-auth">
        <button className="back-btn" onClick={() => setShowAuth(false)}>
          <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} /> Volver
        </button>
        <AuthView />
        <style>{`
          .landing-auth { position: fixed; inset: 0; background: #05070d; z-index: 3000; }
          .back-btn { position: absolute; top: 20px; left: 20px; z-index: 3001; display: flex; gap: 8px; align-items: center; color: white; font-weight: 700; }
        `}</style>
      </div>
    )
  }

  return (
    <div className="landing-root">
      <div className="landing-bg" aria-hidden="true" />

      <nav className="landing-nav animate-fade-down">
        <div className="landing-logo">
          <Music2 size={28} color="#c9a658" />
          <span>Proclama <span>Pro</span></span>
        </div>
        <div className="nav-links">
          <a href="#funciones">Funciones</a>
          <a href="#planes">Planes</a>
          <a href="#premium-interest">Pro</a>
        </div>
        <div className="nav-actions">
          <FeedbackModal />
          <button className="btn-line" onClick={() => setShowAuth(true)}>Acceder</button>
        </div>
      </nav>

      <main className="landing-main">
        <section className="hero">
          <div className="hero-copy">
            <div className="pill animate-fade-up" style={{ animationDelay: '0.08s' }}>
              <Zap size={14} color="#c9a658" /> Privacidad y velocidad local
            </div>
            <h1 className="animate-fade-up" style={{ animationDelay: '0.16s' }}>
              Abre y empieza.
              <br />
              <span>Todo corre en local.</span>
            </h1>
            <p className="animate-fade-up" style={{ animationDelay: '0.24s' }}>
              Setlists, notas y ajustes viven en tu equipo por defecto. La cuenta Pro queda reservada para búsqueda online y exportación de reportes CSV.
            </p>
            <div className="hero-actions animate-fade-up" style={{ animationDelay: '0.32s' }}>
              <button className="btn-primary" onClick={() => setShowTermsForGuest(true)}>
                Entrar como Invitado <ChevronRight size={18} />
              </button>
              <button className="btn-secondary" onClick={() => setShowAuth(true)}>
                Desbloquear Pro
              </button>
            </div>
          </div>

          <div className="hero-panel animate-pop-in" style={{ animationDelay: '0.4s' }}>
            <div className="hero-card hero-card-wide">
              <Cpu size={22} color="#c9a658" />
              <div>
                <strong>Arranque instantáneo</strong>
                <p>La app abre su interfaz principal sin esperar autenticación.</p>
              </div>
            </div>
            <div className="hero-card">
              <Shield size={20} color="#9ad3ff" />
              <div>
                <strong>100% local</strong>
                <p>Setlists, notas y ajustes persisten tras refrescar.</p>
              </div>
            </div>
            <div className="hero-card">
              <Globe size={20} color="#86efac" />
              <div>
                <strong>Pro opcional</strong>
                <p>Activa búsqueda online y exportación CSV solo cuando lo necesites.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="funciones" className="section">
          <div className="section-head animate-on-scroll">
            <h2>Local-first de verdad</h2>
            <p>El flujo principal ya no depende de la nube para servir con rapidez.</p>
          </div>
          <div className="feature-grid">
            <article className="feature-card animate-on-scroll delay-1">
              <Cpu size={28} color="#c9a658" />
              <h3>Velocidad local</h3>
              <p>La app responde de inmediato desde el navegador, incluso después de refrescar.</p>
            </article>
            <article className="feature-card animate-on-scroll delay-2">
              <Lock size={28} color="#c9a658" />
              <h3>Privacidad total</h3>
              <p>Tus datos centrales permanecen en tu dispositivo y no dependen de una sincronización remota.</p>
            </article>
            <article className="feature-card animate-on-scroll delay-3">
              <BookOpen size={28} color="#c9a658" />
              <h3>Biblia siempre lista</h3>
              <p>Consulta y proyecta pasajes con el mismo rendimiento aun cuando falle la conexión.</p>
            </article>
            <article className="feature-card animate-on-scroll delay-4">
              <Video size={28} color="#c9a658" />
              <h3>Proyección fluida</h3>
              <p>Fondos, videos y letras siguen corriendo desde la máquina local, con menos fricción.</p>
            </article>
          </div>
        </section>

        <section id="planes" className="section">
          <div className="section-head animate-on-scroll">
            <h2>Planes claros</h2>
            <p>Gratis para operar en local. Pro para buscar e informar mejor.</p>
          </div>
          <div className="plans-grid animate-on-scroll delay-2">
            <article className="plan-card">
              <span className="plan-badge">Free</span>
              <h3>$0 <span>/ siempre</span></h3>
              <ul>
                <li><Check size={16} /> Uso local ilimitado</li>
                <li><Check size={16} /> Proyección</li>
                <li><Check size={16} /> Biblioteca básica</li>
                <li><Check size={16} /> Biblia</li>
                <li><Check size={16} /> Setlists y notas locales</li>
                <li className="locked"><Lock size={14} /> Búsqueda online</li>
                <li className="locked"><Lock size={14} /> Exportación CSV</li>
              </ul>
              <button className="btn-secondary" onClick={() => setShowTermsForGuest(true)}>Entrar como Invitado</button>
            </article>
            <article className="plan-card plan-pro">
              <span className="plan-badge plan-badge-pro"><Sparkles size={12} /> Premium</span>
              <h3>Cuenta Pro</h3>
              <ul>
                <li><Check size={16} /> Todo lo del plan Free</li>
                <li><Check size={16} /> Búsqueda online (LRC Lib / nube)</li>
                <li><Check size={16} /> Exportación de reportes CSV</li>
                <li><Check size={16} /> Soporte prioritario</li>
              </ul>
              <button className="btn-primary" onClick={() => setShowAuth(true)}>Entrar con cuenta Pro</button>
            </article>
          </div>
        </section>

        <section id="premium-interest" className="section narrow animate-on-scroll">
          <div className="interest-card">
            <div className="pill"><Sparkles size={14} color="#c9a658" /> Mantente al tanto</div>
            <h2>Novedades de Pro</h2>
            <p>Te avisamos cuando haya mejoras en búsqueda online, exportación CSV y beneficios para equipos.</p>
            {interestStatus === 'success' ? (
              <div className="interest-state"><Check size={18} color="#27c93f" /> Listo. Te avisaremos pronto.</div>
            ) : interestStatus === 'duplicate' ? (
              <div className="interest-state"><Check size={18} color="#c9a658" /> Ya estás en la lista.</div>
            ) : (
              <form className="interest-form" onSubmit={handleInterestSubmit}>
                <div className="interest-input">
                  <Mail size={16} color="#8b98b0" />
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={interestEmail}
                    onChange={(e) => setInterestEmail(e.target.value)}
                    required
                    disabled={interestStatus === 'loading'}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={interestStatus === 'loading'}>
                  {interestStatus === 'loading' ? 'Enviando...' : 'Notificarme'}
                </button>
                {interestStatus === 'error' && <p className="error-line">Ocurrió un error. Intenta de nuevo.</p>}
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="landing-footer">© 2026 Proclama — local-first para servir con calma.</footer>

      {showTermsForGuest && (
        <TermsModal
          mode="required"
          onAccept={async () => {
            await acceptTerms(CURRENT_TERMS_VERSION)
            setActiveView('library')
            setGuestMode(true)
          }}
          onClose={() => setShowTermsForGuest(false)}
        />
      )}

      <style>{`
        .landing-root {
          height: 100vh;
          min-height: 100vh;
          background: #05070d;
          color: white;
          font-family: 'Outfit', sans-serif;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .landing-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at top right, rgba(201, 166, 88, 0.16), transparent 28%),
            radial-gradient(circle at bottom left, rgba(52, 152, 219, 0.12), transparent 26%),
            linear-gradient(180deg, #05070d, #0a0e17);
        }
        .landing-nav,
        .landing-main,
        .landing-footer { position: relative; z-index: 1; }
        .landing-nav {
          max-width: 1180px;
          margin: 0 auto;
          padding: 24px 5%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }
        .landing-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'Cinzel', serif;
          font-size: 24px;
          font-weight: 600;
        }
        .landing-logo span span { color: #c9a658; }
        .nav-links { display: none; gap: 24px; }
        .nav-links a { color: #9aa6bb; text-decoration: none; font-size: 14px; }
        .nav-actions { display: flex; align-items: center; gap: 12px; }
        .btn-line, .btn-secondary, .btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          font-weight: 700;
          transition: 0.2s ease;
        }
        .btn-line, .btn-secondary {
          padding: 12px 20px;
          border: 1px solid rgba(255,255,255,0.14);
          color: white;
          background: transparent;
        }
        .btn-primary {
          padding: 14px 24px;
          border: none;
          color: #05070d;
          background: linear-gradient(135deg, #d5b164, #bc933b);
          box-shadow: 0 16px 40px rgba(201, 166, 88, 0.22);
        }
        .btn-line:hover, .btn-secondary:hover { background: rgba(255,255,255,0.05); }
        .btn-primary:hover { transform: translateY(-2px); }
        .landing-main { max-width: 1180px; margin: 0 auto; padding: 24px 5% 96px; }
        .hero {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 32px;
          align-items: center;
          min-height: 78vh;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(201, 166, 88, 0.28);
          background: rgba(201, 166, 88, 0.08);
          color: #e7edf8;
          font-size: 13px;
          font-weight: 600;
        }
        .hero-copy h1 {
          margin: 20px 0 16px;
          font-family: 'Cinzel', serif;
          font-size: clamp(42px, 5vw, 68px);
          line-height: 1.04;
        }
        .hero-copy h1 span {
          background: linear-gradient(90deg, #fff, #c9a658);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-copy p,
        .section-head p,
        .hero-card p,
        .feature-card p,
        .interest-card p { color: #9aa6bb; line-height: 1.7; }
        .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 28px; }
        .hero-panel {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          padding: 24px;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(150deg, rgba(14, 18, 28, 0.92), rgba(7, 10, 16, 0.82));
          box-shadow: 0 34px 90px rgba(0,0,0,0.42);
        }
        .hero-card {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 18px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .hero-card-wide { grid-column: span 2; }
        .hero-card strong, .feature-card h3 { display: block; margin-bottom: 6px; }
        .section { padding-top: 82px; }
        .section.narrow { max-width: 760px; margin: 0 auto; }
        .section-head { text-align: center; margin-bottom: 42px; }
        .section-head h2, .interest-card h2 {
          margin: 0 0 12px;
          font-family: 'Cinzel', serif;
          font-size: clamp(30px, 4vw, 40px);
        }
        .feature-grid, .plans-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        .feature-card, .plan-card, .interest-card {
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015));
        }
        .feature-card {
          padding: 26px;
        }
        .plan-card {
          padding: 30px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .plan-pro { border-color: rgba(201, 166, 88, 0.22); }
        .plan-badge {
          width: fit-content;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          color: #d1dae8;
          font-size: 12px;
          font-weight: 700;
        }
        .plan-badge-pro {
          display: inline-flex;
          gap: 6px;
          align-items: center;
          background: rgba(201, 166, 88, 0.14);
          color: #f0dfb6;
        }
        .plan-card h3 {
          margin: 0;
          font-size: 36px;
        }
        .plan-card h3 span { color: #9aa6bb; font-size: 16px; }
        .plan-card ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .plan-card li {
          display: flex;
          gap: 10px;
          align-items: center;
          color: #d5dce7;
        }
        .plan-card .locked { color: #778398; }
        .interest-card { padding: 34px; text-align: center; }
        .interest-form { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
        .interest-input {
          min-width: 220px;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 16px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
        }
        .interest-input input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: white;
          padding: 15px 0;
        }
        .interest-state {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          padding: 14px 18px;
          border-radius: 14px;
          background: rgba(255,255,255,0.05);
        }
        .error-line { width: 100%; color: #fca5a5; font-size: 13px; }
        .landing-footer {
          position: relative;
          z-index: 1;
          padding: 28px;
          text-align: center;
          color: #748197;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .animate-fade-up { opacity: 0; transform: translateY(18px); animation: fadeUp 0.7s ease forwards; }
        .animate-fade-down { opacity: 0; transform: translateY(-10px); animation: fadeDown 0.6s ease forwards; }
        .animate-pop-in { opacity: 0; transform: scale(0.97); animation: popIn 0.8s ease forwards; }
        .animate-on-scroll { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .animate-on-scroll.is-visible { opacity: 1; transform: translateY(0); }
        .delay-1 { transition-delay: 0.08s; }
        .delay-2 { transition-delay: 0.16s; }
        .delay-3 { transition-delay: 0.24s; }
        .delay-4 { transition-delay: 0.32s; }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeDown { to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { to { opacity: 1; transform: scale(1); } }
        @media (min-width: 860px) { .nav-links { display: flex; } }
        @media (max-width: 920px) {
          .hero, .feature-grid, .plans-grid { grid-template-columns: 1fr; }
          .hero-copy { text-align: center; }
          .hero-actions { justify-content: center; }
          .hero-card-wide { grid-column: span 1; }
          .hero-panel { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
