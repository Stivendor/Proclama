import { useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ChevronRight, Cpu, Download, FileSpreadsheet, Globe, Lock, LogOut, Mail, Music2, Shield, Sparkles, User, Video, Zap } from 'lucide-react'
import AuthView from './AuthView'
import FeedbackModal from '@/components/FeedbackModal'
import TermsModal from '@/components/TermsModal'
import { useAppStore } from '@/stores'
import { supabase } from '@/services/supabase'
import { CURRENT_TERMS_VERSION } from '@/constants/terms'
import { registerPremiumInterest } from '@/services/supabase'
import { useMercadoPagoCheckout } from '@/components/MercadoPagoCheckout'
import { PREMIUM_FOR_EVERYONE, usePlan } from '@/hooks/usePlan'

declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent
  }
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  prompt(): Promise<void>
}

export default function LandingView() {
  const { setGuestMode, acceptTerms, setActiveView, setForceLanding, user } = useAppStore()
  const { isPremium } = usePlan()
  const { openCheckout } = useMercadoPagoCheckout()
  const [showTermsForGuest, setShowTermsForGuest] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  
  const [interestEmail, setInterestEmail] = useState('')
  const [interestStatus, setInterestStatus] = useState<'idle' | 'loading' | 'success' | 'duplicate' | 'error'>('idle')
  const [canInstall, setCanInstall] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const handleSignOut = async () => {
    const store = useAppStore.getState()
    store.logout()
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn(e)
    }
    window.location.href = '/'
  }

  const userEmail = user?.email
  const userName = userEmail ? userEmail.split('@')[0] : null

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      window.deferredPrompt = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!window.deferredPrompt) return
    await window.deferredPrompt.prompt()
    const { outcome } = await window.deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setCanInstall(false)
    }
    window.deferredPrompt = undefined
  }

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

  const handleBuyPro = () => {
    if (isPremium) {
      setShowTermsForGuest(true)
      return
    }
    if (!user?.id) {
      setShowAuth(true)
      return
    }
    openCheckout({
      userId: user.id,
      userEmail: user.email || undefined
    })
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
          {user ? (
            <div className="user-signed-in">
              <span className="user-name">{userName || userEmail?.split('@')[0]}</span>
              <button 
                className="signout-btn" 
                onClick={handleSignOut}
              >
                <LogOut size={14} /> Salir
              </button>
            </div>
          ) : (
            <button className="landing-btn-line" onClick={() => setShowAuth(true)}>Acceder</button>
          )}
        </div>
      </nav>

      <main className="landing-main">
        <section className="hero">
          <div className="hero-copy">
            <h1 className="animate-fade-up" style={{ animationDelay: '0.08s' }}>
              Sin esperas, sin interrupciones.
              <br />
              <span>Tu contenido siempre listo para proyectar.</span>
            </h1>
            <p className="animate-fade-up" style={{ animationDelay: '0.16s' }}>
              Entra directo a la acción. Gestiona tus setlists y accede a una biblioteca masiva al instante, con una interfaz diseñada para responder aunque no tengas conexión.
            </p>
            <div className="hero-actions animate-fade-up" style={{ animationDelay: '0.24s' }}>
              <button className="landing-btn-primary" onClick={() => setShowTermsForGuest(true)}>
                Entrar a Proclama <ChevronRight size={18} />
              </button>
              <button className="landing-btn-secondary" onClick={() => document.getElementById('funciones')?.scrollIntoView({ behavior: 'smooth' })}>
                Ver funciones Pro
              </button>
              {canInstall && (
                <button className="landing-btn-download" onClick={handleInstall}>
                  <Download size={16} /> Descargar App
                </button>
              )}
            </div>
          </div>

          <div className="hero-panel animate-pop-in" style={{ animationDelay: '0.4s' }}>
            <div className="hero-card hero-card-wide">
              <Cpu size={22} color="#c9a658" />
              <div>
                <strong>Arranque instantáneo</strong>
                <p>Abre la interfaz y empieza a trabajar al segundo.</p>
              </div>
            </div>
            <div className="hero-card">
              <BookOpen size={20} color="#9ad3ff" />
              <div>
                <strong>Biblioteca integrada</strong>
                <p>Más de 3,000 canciones listas para buscar y proyectar.</p>
              </div>
            </div>
            <div className="hero-card">
              <Shield size={20} color="#86efac" />
              <div>
                <strong>Confiabilidad total</strong>
                <p>Si el internet falla, tu proyección no se detiene.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="funciones" className="section">
          <div className="section-head animate-on-scroll">
            <h2>¿Por qué usar la app?</h2>
          </div>
          <div className="feature-grid">
            <article className="feature-card animate-on-scroll delay-1">
              <Cpu size={28} color="#c9a658" />
              <h3>Arranque inmediato</h3>
              <p>Abre la interfaz y empieza a trabajar al segundo. Sin registros obligatorios ni pantallas de carga lentas.</p>
            </article>
            <article className="feature-card animate-on-scroll delay-2">
              <BookOpen size={28} color="#c9a658" />
              <h3>Biblioteca integrada</h3>
              <p>Más de 3,000 canciones listas para buscar y proyectar desde el primer momento, sin configurar nada.</p>
            </article>
            <article className="feature-card animate-on-scroll delay-3">
              <Shield size={28} color="#c9a658" />
              <h3>Confiabilidad total</h3>
              <p>Tus setlists y notas viven en tu navegador. Si el internet falla, tu proyección no se detiene; todo sigue funcionando localmente.</p>
            </article>
            <article className="feature-card animate-on-scroll delay-4">
              <Globe size={28} color="#c9a658" />
              <h3>Biblia multilingüe</h3>
              <p>Consulta y proyecta pasajes en múltiples versiones: Reina Valera 1960, NVI, PDT, LBLA, NTV (español) y KJV, ESV, WEB, NASB, NET (inglés).</p>
            </article>
          </div>
        </section>

        <section id="planes" className="section pricing-section">
          <div className="section-head animate-on-scroll">
            <h2>Elige tu plan</h2>
            <p>Durante el lanzamiento: todos los beneficios Pro disponibles.</p>
          </div>

          <div className="urgency-banner animate-on-scroll delay-1">
            <div className="urgency-col urgency-now">
              <span className="urgency-label">Precio de lanzamiento</span>
              <div className="urgency-price">$49,900</div>
              <span className="urgency-sub">pago único · acceso de por vida</span>
              <span className="urgency-badge-active">Activo ahora</span>
            </div>
            <div className="urgency-separator">→</div>
            <div className="urgency-col urgency-later">
              <span className="urgency-label">Precio regular (desde mes 3)</span>
              <div className="urgency-price-later">$39,900</div>
              <span className="urgency-sub">por año</span>
              <span className="urgency-badge-later">Próximamente</span>
            </div>
            <p className="urgency-note">Este precio no vuelve. Quienes entren ahora conservan su licencia de por vida.</p>
          </div>

          <div className="plans-grid animate-on-scroll delay-2">
            <article className="plan-card">
              <span className="plan-badge">Gratis</span>
              <h3>Plan Básico</h3>
              <div className="plan-price">$0 <span>/ siempre</span></div>
              <ul>
                <li><Check size={16} /> Proyección de alto rendimiento</li>
                <li><Check size={16} /> Gestión de Setlists y Notas</li>
                <li><Check size={16} /> Fondos de video e imágenes</li>
                <li><Check size={16} /> Uso local ilimitado y fluido</li>
                <li className="locked"><Lock size={14} /> Biblioteca de 3,000+ canciones completas</li>
                <li className="locked"><Lock size={14} /> Búsqueda global extendida (LRC Lib)</li>
                <li className="locked"><Lock size={14} /> Exportación de reportes CSV</li>
                <li className="locked"><Lock size={14} /> Sin límite de canciones propias</li>
              </ul>
              <button className="landing-btn-secondary plan-btn-outline" onClick={() => setShowTermsForGuest(true)}>Usar Gratis</button>
            </article>
            <article className="plan-card plan-pro">
              <span className="plan-badge plan-badge-pro"><Sparkles size={12} /> {PREMIUM_FOR_EVERYONE ? 'Pro · Gratis ahora' : 'Pro'}</span>
              <h3>Pro License</h3>
              <div className="plan-price-pro">{PREMIUM_FOR_EVERYONE ? '$0' : '$49,900'} <span>/ {PREMIUM_FOR_EVERYONE ? 'ahora' : 'pago único'}</span></div>
              {PREMIUM_FOR_EVERYONE ? (
                <>
                  <span className="plan-sub-badge">Pago único — acceso de por vida</span>
                  <span className="plan-future-price">Después: $39,900/año</span>
                </>
              ) : (
                <span className="plan-sub-badge">Acceso de por vida</span>
              )}
              <ul>
                <li><Check size={16} /> Biblioteca de 3,000+ canciones completas</li>
                <li><Check size={16} /> Búsqueda global extendida (LRC Lib)</li>
                <li><Check size={16} /> Exportación de reportes CSV</li>
                <li><Check size={16} /> Sin límite de canciones propias</li>
                <li><Check size={16} /> Proyección de alto rendimiento</li>
                <li><Check size={16} /> Gestión de Setlists y Notas</li>
                <li><Check size={16} /> Fondos de video e imágenes</li>
                <li><Check size={16} /> Uso local ilimitado y fluido</li>
              </ul>
              <button className="landing-btn-primary" onClick={handleBuyPro}>
                <Sparkles size={16} /> {PREMIUM_FOR_EVERYONE ? 'Obtener Pro Gratis' : 'Actualizar a Pro'}
              </button>
            </article>
          </div>
        </section>

        <section id="interest-form" className="section narrow animate-on-scroll">
          <div className="interest-card">
            <div className="pill"><Mail size={14} color="#c9a658" /> ¿Aún no decides?</div>
            <h2>Recibe actualizaciones</h2>
            <p>Déjanos tu correo para enterarte de las novedades y mejoras que vengan pronto.</p> 
            {interestStatus === 'success' ? (
              <div className="interest-state"><Check size={18} color="#27c93f" /> Listo. Te avisaremos pronto.</div>
            ) : interestStatus === 'duplicate' ? (
              <div className="interest-state"><Check size={18} color="#c9a658" /> Ya estás en la lista.</div>
            ) : (
              <form className="interest-form" onSubmit={handleInterestSubmit}>
                <div className="interest-input">
                  <Mail size={16} color="#8b98b0" />
                  <label htmlFor="interest-email" className="sr-only">Correo electrónico</label>
                  <input
                    id="interest-email"
                    type="email"
                    placeholder="tu@correo.com…"
                    value={interestEmail}
                    onChange={(e) => setInterestEmail(e.target.value)}
                    required
                    disabled={interestStatus === 'loading'}
                    autoComplete="email"
                  />
                </div>
                <button type="submit" className="landing-btn-primary" disabled={interestStatus === 'loading'}>
                  {interestStatus === 'loading' ? 'Enviando…' : 'Notificarme'}
                </button>
                {interestStatus === 'error' && <p className="error-line">Ocurrió un error. Intenta de nuevo.</p>}
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="landing-footer">© 2026 Proclama</footer>

      {showTermsForGuest && (
        <TermsModal
          mode="required"
          onAccept={async () => {
            await acceptTerms(CURRENT_TERMS_VERSION)
            setForceLanding(false)
            setActiveView('library')
            setGuestMode(true)
          }}
          onClose={() => setShowTermsForGuest(false)}
        />
      )}

      <style>{`
        /* ── Landing Design System ───────────────────────────────── */
        /* Prefijo landing- para aislar estilos del sistema global   */

        .landing-root {
          height: 100vh;
          min-height: 100vh;
          background: #05070d;
          color: white;
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        /* Forzar fuente Outfit en todos los hijos de la landing,
           excluyendo el modal overlay que usa el design system global */
        .landing-root > *:not(.modal-overlay) *,
        .landing-root > nav button,
        .landing-root > main button,
        .landing-root > footer {
          font-family: 'Outfit', sans-serif;
        }
        /* Clase de accesibilidad para labels invisibles */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border: 0;
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
        .nav-links a { color: #9aa6bb; text-decoration: none; font-size: 14px; font-family: 'Outfit', sans-serif; }
        .nav-links a:hover { color: #e7edf8; }
        .nav-actions { display: flex; align-items: center; gap: 12px; }

        /* ── Botones de la landing (clases únicas, sin conflicto) ── */
        .landing-btn-line,
        .landing-btn-secondary,
        .landing-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          font-family: 'Outfit', sans-serif;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .landing-btn-line,
        .landing-btn-secondary {
          padding: 12px 22px;
          border: 1px solid rgba(255,255,255,0.14);
          color: white;
          background: transparent;
        }
        .landing-btn-line:hover,
        .landing-btn-secondary:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.22); }
        .landing-btn-primary {
          padding: 14px 28px;
          border: none;
          color: #05070d;
          background: linear-gradient(135deg, #d5b164, #bc933b);
          box-shadow: 0 16px 40px rgba(201, 166, 88, 0.22);
        }
        .landing-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 48px rgba(201, 166, 88, 0.32); }
        .landing-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .landing-btn-download {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 22px;
          border: 1px solid rgba(212, 175, 55, 0.4);
          border-radius: 999px;
          font-family: 'Outfit', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #d4af55;
          background: rgba(212, 175, 55, 0.08);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }
        .landing-btn-download:hover {
          background: rgba(212, 175, 55, 0.15);
          border-color: rgba(212, 175, 55, 0.6);
          transform: translateY(-2px);
        }
        .landing-btn-line:focus-visible,
        .landing-btn-secondary:focus-visible,
        .landing-btn-primary:focus-visible,
        .landing-btn-download:focus-visible {
          outline: 2px solid #c9a658;
          outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-btn-primary:hover { transform: none; }
          .animate-fade-up, .animate-fade-down, .animate-pop-in { animation: none; opacity: 1; transform: none; }
          .animate-on-scroll { transition: none; opacity: 1; transform: none; }
        }

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
          text-wrap: balance;
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
        .interest-card p { color: #9aa6bb; line-height: 1.7; font-size: 16px; }
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
        .hero-card strong { display: block; margin-bottom: 6px; font-size: 15px; font-weight: 700; }
        .feature-card h3 { display: block; margin-bottom: 6px; font-size: 17px; font-weight: 700; }
        .section { padding-top: 82px; }
        .section.narrow { max-width: 760px; margin: 0 auto; }
        .section-head { text-align: center; margin-bottom: 42px; }
        .section-head h2, .interest-card h2 {
          margin: 0 0 12px;
          font-family: 'Cinzel', serif;
          font-size: clamp(30px, 4vw, 40px);
          text-wrap: balance;
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
        .feature-card { padding: 26px; }
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
          font-family: 'Outfit', sans-serif;
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
          font-size: 20px;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
          line-height: 1.3;
        }
        .plan-card h3 span { color: #9aa6bb; font-size: 16px; font-weight: 400; }
        .plan-price {
          font-size: 36px;
          font-weight: 700;
          color: #f0dfb6;
        }
        .plan-price span { color: #9aa6bb; font-size: 16px; font-weight: 400; }
        .plan-soon {
          display: inline-block;
          padding: 6px 14px;
          background: rgba(201, 166, 88, 0.12);
          color: #f0dfb6;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
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
          font-size: 15px;
        }
        .plan-card .locked { color: #778398; }
        .interest-card { padding: 34px; text-align: center; }
        .interest-form { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
        .interest-input {
          min-width: 220px;
          min-height: 52px;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 16px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          transition: border-color 0.2s ease;
        }
        .interest-input:focus-within { border-color: rgba(201, 166, 88, 0.5); }
        .interest-input input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: white;
          padding: 15px 0;
          font-family: 'Outfit', sans-serif;
          font-size: 15px;
        }
        .interest-state {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
          padding: 14px 18px;
          border-radius: 14px;
          background: rgba(255,255,255,0.05);
          font-size: 15px;
        }
        .error-line { width: 100%; color: #fca5a5; font-size: 13px; }
        .procta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-top: 24px;
        }
        .procta-note {
          font-size: 13px;
          color: #748197;
          margin: 0;
        }
        .landing-footer {
          position: relative;
          z-index: 1;
          padding: 28px;
          text-align: center;
          color: #748197;
          font-size: 14px;
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
        /* ── Pricing Section ─────────────────────────────────────── */
        .pricing-section { 
          padding-top: 82px;
          padding-bottom: 48px;
        }
        .urgency-banner {
          max-width: 680px;
          margin: 0 auto 42px;
          padding: 28px 32px;
          border-radius: 20px;
          border: 1px solid rgba(201, 166, 88, 0.3);
          background: #0f1219;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .urgency-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;
        }
        .urgency-label {
          font-size: 12px;
          color: #9aa6bb;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .urgency-price {
          font-size: 42px;
          font-weight: 700;
          color: #d4a017;
          line-height: 1.1;
        }
        .urgency-price-later {
          font-size: 42px;
          font-weight: 700;
          color: #778398;
          line-height: 1.1;
        }
        .urgency-sub {
          font-size: 13px;
          color: #9aa6bb;
        }
        .urgency-separator {
          font-size: 24px;
          color: #555;
          padding: 0 8px;
        }
        .urgency-badge-active {
          display: inline-block;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(39, 201, 63, 0.15);
          color: #4ade80;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .urgency-badge-later {
          display: inline-block;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          color: #9aa6bb;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .urgency-note {
          width: 100%;
          margin: 16px 0 0;
          font-size: 13px;
          color: #9aa6bb;
          font-style: italic;
          text-align: center;
        }
        .plan-price-pro {
          font-size: 42px;
          font-weight: 700;
          color: #f0dfb6;
        }
        .plan-price-pro span {
          font-size: 18px;
          color: #9aa6bb;
          font-weight: 400;
        }
        .plan-sub-badge {
          display: inline-block;
          padding: 6px 14px;
          background: rgba(201, 166, 88, 0.12);
          color: #d4a017;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        .plan-future-price {
          font-size: 13px;
          color: #778398;
        }
        .plan-btn-outline {
          width: 100%;
          margin-top: auto;
        }

        @media (min-width: 860px) { .nav-links { display: flex; } }
        @media (max-width: 920px) {
          .hero, .feature-grid, .plans-grid { grid-template-columns: 1fr; }
          .hero-copy { text-align: center; }
          .hero-actions { justify-content: center; }
          .hero-card-wide { grid-column: span 1; }
          .hero-panel { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .urgency-banner {
            flex-direction: column;
            gap: 20px;
            padding: 24px 20px;
          }
          .urgency-separator {
            transform: rotate(90deg);
            padding: 8px 0;
          }
          .urgency-price, .urgency-price-later {
            font-size: 32px;
          }
          .urgency-note {
            font-size: 12px;
          }
        }
        /* User signed in */
        .user-signed-in {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .user-name {
          color: #c9a658;
          font-size: 14px;
          font-weight: 600;
        }
        .signout-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: transparent;
          color: #9aa6bb;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .signout-btn:hover {
          background: rgba(255,255,255,0.06);
          color: #fca5a5;
          border-color: rgba(252, 165, 165, 0.3);
        }
      `}</style>
    </div>
  )
}
