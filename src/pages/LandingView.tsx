import { useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ChevronRight, Cpu, Download, FileSpreadsheet, Globe, LogOut, Mail, Music2, Search, Shield, Sparkles, User, Video, Zap, Instagram } from 'lucide-react'

const TikTokIcon = ({ size = 24, color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
)
import AuthView from './AuthView'
import TermsModal from '@/components/terms/TermsModal'
import { useAppStore } from '@/stores'
import { supabase } from '@/services/supabase'
import { CURRENT_TERMS_VERSION } from '@/constants/terms'
import { registerPremiumInterest } from '@/services/supabase'
import { t } from '@/i18n'

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
  const { acceptTerms, setActiveView, setForceLanding, forceLandingSection, user, landingShowAuth, setLandingShowAuth, language, setLanguage } = useAppStore()
  const [showTermsForGuest, setShowTermsForGuest] = useState(false)
  
  const [interestEmail, setInterestEmail] = useState('')
  const [interestStatus, setInterestStatus] = useState<'idle' | 'loading' | 'success' | 'duplicate' | 'error'>('idle')
  const [canInstall, setCanInstall] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Handle section scrolling
  useEffect(() => {
    if (forceLandingSection) {
      const timer = setTimeout(() => {
        const el = document.getElementById(forceLandingSection)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' })
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [forceLandingSection])

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
    const params = new URLSearchParams(window.location.search);
    const scrollTo = params.get('scroll');
    if (scrollTo) {
      setTimeout(() => {
        const el = document.getElementById(scrollTo);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
    
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



  if (landingShowAuth) {
    return (
      <div className="landing-auth">
        <button className="back-btn" onClick={() => setLandingShowAuth(false)}>
          <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} /> {t(language, 'nav.back')}
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
        <div className="landing-nav-container">
          <div className="landing-logo">
            <Music2 size={28} color="#c9a658" />
            <span>Proclama <span>Pro</span></span>
          </div>
          <div className="nav-links">
            <a href="#funciones">{t(language, 'nav.features')}</a>
            <a href="#showcase">{t(language, 'nav.showcase')}</a>
          </div>
          <div className="nav-actions">
            {user ? (
              <div className="user-signed-in" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="user-name">{userName || userEmail?.split('@')[0]}</span>
                <button 
                  className="landing-btn-line" 
                  onClick={() => setForceLanding(false)}
                  style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {t(language, 'nav.goToApp')}
                </button>
                <button 
                  className="signout-btn" 
                  onClick={handleSignOut}
                >
                  <LogOut size={14} /> {t(language, 'nav.signOut')}
                </button>
              </div>
            ) : (
              <button className="landing-btn-line" onClick={() => setLandingShowAuth(true)}>{t(language, 'nav.signIn')}</button>
            )}
            <button
              className="lang-toggle"
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              aria-label={language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              <Globe size={16} />
              <span>{language === 'es' ? 'EN' : 'ES'}</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="landing-main">
        <section className="hero">
          <div className="hero-copy">
            <h1 className="animate-fade-up" style={{ animationDelay: '0.08s' }}>
              {t(language, 'landing.hero.title')}
              <br />
              <span>{t(language, 'landing.hero.titleHighlight')}</span>
            </h1>
            <p className="animate-fade-up" style={{ animationDelay: '0.16s' }}>
              {t(language, 'landing.hero.subtitle')}
            </p>
            <div className="hero-actions animate-fade-up" style={{ animationDelay: '0.24s' }}>
              <button className="landing-btn-primary" onClick={() => {
                if (user) {
                  setForceLanding(false)
                } else {
                  setLandingShowAuth(true)
                }
              }}>
                {user ? t(language, 'landing.hero.ctaAuthenticated') : t(language, 'landing.hero.ctaGuest')} <ChevronRight size={18} />
              </button>
              <button className="landing-btn-secondary" onClick={() => document.getElementById('funciones')?.scrollIntoView({ behavior: 'smooth' })}>
                {t(language, 'landing.hero.viewFeatures')}
              </button>
              {canInstall && (
                <button className="landing-btn-download" onClick={handleInstall}>
                  <Download size={16} /> {t(language, 'landing.hero.downloadApp')}
                </button>
              )}
            </div>
          </div>

          <div className="hero-panel animate-pop-in" style={{ animationDelay: '0.4s' }}>
            <div className="hero-screenshot-container">
              <img 
                src="/app.jpg" 
                alt="Proclama Interface" 
                className="hero-screenshot"
              />
              <div className="screenshot-overlay" />
            </div>
          </div>
        </section>

        <section id="funciones" className="section">
          <div className="section-head animate-on-scroll">
            <h2>{t(language, 'landing.features.title')}</h2>
          </div>
          <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <article className="feature-card animate-on-scroll delay-1">
              <Cpu size={28} color="#c9a658" />
              <h3>{t(language, 'landing.features.card1Title')}</h3>
              <p>{t(language, 'landing.features.card1Desc')}</p>
            </article>
            <article className="feature-card animate-on-scroll delay-2">
              <BookOpen size={28} color="#c9a658" />
              <h3>{t(language, 'landing.features.card2Title')}</h3>
              <p>{t(language, 'landing.features.card2Desc')}</p>
            </article>
            <article className="feature-card animate-on-scroll delay-3">
              <FileSpreadsheet size={28} color="#c9a658" />
              <h3>{t(language, 'landing.features.card3Title')}</h3>
              <p>{t(language, 'landing.features.card3Desc')}</p>
            </article>
            <article className="feature-card animate-on-scroll delay-4">
              <Globe size={28} color="#c9a658" />
              <h3>{t(language, 'landing.features.card4Title')}</h3>
              <p>{t(language, 'landing.features.card4Desc')}</p>
            </article>
            <article className="feature-card animate-on-scroll delay-1" style={{ animationDelay: '0.1s' }}>
              <Sparkles size={28} color="#c9a658" />
              <h3>{t(language, 'landing.features.card5Title')}</h3>
              <p>{t(language, 'landing.features.card5Desc')}</p>
            </article>
            <article className="feature-card animate-on-scroll delay-2" style={{ animationDelay: '0.2s' }}>
              <Shield size={28} color="#c9a658" />
              <h3>{t(language, 'landing.features.card6Title')}</h3>
              <p>{t(language, 'landing.features.card6Desc')}</p>
            </article>
          </div>
        </section>

        <section id="showcase" className="section showcase-section">
          <div className="section-head animate-on-scroll">
            <h2>{t(language, 'landing.showcase.title')}</h2>
            <p>{t(language, 'landing.showcase.subtitle')}</p>
          </div>

          <div className="showcase-grid">
            {/* Función 1: Biblias */}
            <div className="showcase-item animate-on-scroll">
              <div className="showcase-content">
                <div className="feature-icon"><Globe size={24} color="#c9a658" /></div>
                <h3>{t(language, 'landing.showcase.biblesTitle')}</h3>
                <p>{t(language, 'landing.showcase.biblesDesc')}</p>
                <ul className="feature-list">
                  <li><Check size={16} /> {t(language, 'landing.showcase.biblesItem1')}</li>
                  <li><Check size={16} /> {t(language, 'landing.showcase.biblesItem2')}</li>
                  <li><Check size={16} /> {t(language, 'landing.showcase.biblesItem3')}</li>
                </ul>
              </div>
              <div className="showcase-visual">
                <div className="screenshot-reveal reveal-right">
                  <div className="screenshot-frame">
                    <img src="/bible.jpg" alt="Biblias Multilingües" />
                  </div>
                  <div className="visual-glow" />
                </div>
              </div>
            </div>

            {/* Función 2: Setlists y Confiabilidad */}
            <div className="showcase-item inverted animate-on-scroll">
              <div className="showcase-content">
                <div className="feature-icon"><FileSpreadsheet size={24} color="#c9a658" /></div>
                <h3>{t(language, 'landing.showcase.setlistsTitle')}</h3>
                <p>{t(language, 'landing.showcase.setlistsDesc')}</p>
                <ul className="feature-list">
                  <li><Check size={16} /> {t(language, 'landing.showcase.setlistsItem1')}</li>
                  <li><Check size={16} /> {t(language, 'landing.showcase.setlistsItem2')}</li>
                  <li><Check size={16} /> {t(language, 'landing.showcase.setlistsItem3')}</li>
                </ul>
              </div>
              <div className="showcase-visual">
                <div className="screenshot-reveal reveal-left">
                  <div className="screenshot-frame">
                    <img src="/setlist.jpg" alt="Gestión de Setlists" />
                  </div>
                  <div className="visual-glow" />
                </div>
              </div>
            </div>

            {/* Función 3: Búsqueda Online */}
            <div className="showcase-item animate-on-scroll">
              <div className="showcase-content">
                <div className="feature-icon"><Search size={24} color="#c9a658" /></div>
                <h3>{t(language, 'landing.showcase.searchTitle')}</h3>
                <p>{t(language, 'landing.showcase.searchDesc')}</p>
                <ul className="feature-list">
                  <li><Check size={16} /> {t(language, 'landing.showcase.searchItem1')}</li>
                  <li><Check size={16} /> {t(language, 'landing.showcase.searchItem2')}</li>
                  <li><Check size={16} /> {t(language, 'landing.showcase.searchItem3')}</li>
                </ul>
              </div>
              <div className="showcase-visual">
                <div className="screenshot-reveal reveal-right">
                  <div className="screenshot-frame">
                    <img src="/search.jpg" alt="Búsqueda Online de Canciones" />
                  </div>
                  <div className="visual-glow" />
                </div>
              </div>
            </div>
          </div>
        </section>


      </main>

      <footer className="landing-footer">
        <div className="landing-footer-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '24px' }}>
          
            <div className="social-section">
              <h4 style={{ margin: '0 0 16px', color: '#e7edf8', fontSize: '16px', fontWeight: '600' }}>{t(language, 'landing.footer.followUs')}</h4>
            <div className="social-links" style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <a href="https://instagram.com/proclamapro" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Instagram">
                <Instagram size={24} />
              </a>
              <a href="https://tiktok.com/@proclamapro" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="TikTok">
                <TikTokIcon size={24} />
              </a>
            </div>
          </div>

          <div className="footer-separator" style={{ width: '60px', height: '1px', background: 'rgba(201, 166, 88, 0.3)' }}></div>

          <div className="footer-contact">
            <p style={{ fontStyle: 'italic', marginBottom: '12px', fontSize: '13px', color: '#8b98b0' }}>
              {t(language, 'landing.footer.verse')}
            </p>
            <div style={{ marginBottom: '16px', color: '#9aa6bb' }}>
              {t(language, 'landing.footer.contact')} <a href="mailto:proclamapro@gmail.com" style={{ color: '#c9a658', textDecoration: 'none', fontWeight: 'bold', marginLeft: '4px' }}>proclamapro@gmail.com</a>
            </div>
            <div style={{ color: '#778398', fontSize: '14px' }}>{t(language, 'landing.footer.copyright')}</div>
          </div>
        </div>
      </footer>

      {showTermsForGuest && (
        <TermsModal
          mode="required"
          onAccept={async () => {
            await acceptTerms(CURRENT_TERMS_VERSION)
            setForceLanding(false)
            setActiveView('library')
            setLandingShowAuth(true)
          }}
          onClose={() => setShowTermsForGuest(false)}
        />
      )}

      <style>{`
        /* ── Landing Design System ───────────────────────────────── */
        /* Prefijo landing- para aislar estilos del sistema global   */

        .landing-root {
          height: 100%;
          min-height: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
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
        .landing-main,
        .landing-footer { position: relative; z-index: 1; }
        .landing-nav {
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: rgba(5, 7, 13, 0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(201, 166, 88, 0.08);
          width: 100%;
        }
        .landing-nav-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 16px 5%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }
        .landing-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: 'Montserrat', sans-serif;
          font-size: 24px;
          font-weight: 600;
        }
        .landing-logo span span { color: #c9a658; }
        .nav-links { display: flex; gap: 8px; }
        .nav-links a {
          color: #9aa6bb;
          text-decoration: none;
          font-size: 14px;
          font-family: 'Outfit', sans-serif;
          padding: 8px 16px;
          border-radius: 8px;
          transition: all 0.2s ease;
        }
        .nav-links a:hover {
          color: #e7edf8;
          background: rgba(255, 255, 255, 0.05);
        }
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
        .social-link {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #9aa6bb;
          transition: all 0.2s ease;
        }
        .social-link:hover {
          color: #c9a658;
          background: rgba(201, 166, 88, 0.08);
          border-color: rgba(201, 166, 88, 0.3);
          transform: translateY(-2px);
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-btn-primary:hover, .social-link:hover { transform: none; }
          .animate-fade-up, .animate-fade-down, .animate-pop-in { animation: none; opacity: 1; transform: none; }
          .animate-on-scroll { transition: none; opacity: 1; transform: none; }
        }

        .landing-main { max-width: 1280px; margin: 0 auto; padding: 24px 5% 96px; }
        .hero {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 48px;
          align-items: center;
          min-height: 82vh;
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
          font-family: 'Montserrat', sans-serif;
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
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 40px 100px rgba(0,0,0,0.6);
          transform: perspective(1000px) rotateY(-4deg) rotateX(2deg);
          transition: transform 0.5s ease;
        }
        .hero-panel:hover {
          transform: perspective(1000px) rotateY(0deg) rotateX(0deg);
        }
        .hero-screenshot-container {
          position: relative;
          background: #000;
          line-height: 0;
        }
        .hero-screenshot {
          width: 100%;
          height: auto;
          display: block;
        }
        .screenshot-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, transparent 70%, rgba(5, 7, 13, 0.4));
          pointer-events: none;
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
          font-family: 'Montserrat', sans-serif;
          font-size: clamp(30px, 4vw, 40px);
          text-wrap: balance;
        }
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        @media (max-width: 900px) {
          .plans-grid { grid-template-columns: 1fr; }
        }
        /* ── Showcase Section ────────────────────────────────────── */
        .showcase-section { padding-bottom: 120px; overflow: hidden; }
        .showcase-grid {
          display: flex;
          flex-direction: column;
          gap: 160px;
          margin-top: 80px;
        }
        .showcase-item {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: 80px;
          align-items: center;
        }
        .showcase-item.inverted { grid-template-columns: 1.3fr 1fr; }
        .showcase-item.inverted .showcase-content { order: 2; }
        .showcase-item.inverted .showcase-visual { order: 1; }
        
        .showcase-content h3 {
          font-size: 36px;
          margin: 20px 0;
          font-family: 'Montserrat', sans-serif;
          color: white;
        }
        .showcase-content p { font-size: 17px; margin-bottom: 24px; }
        .feature-icon {
          width: 52px;
          height: 52px;
          background: rgba(201, 166, 88, 0.12);
          border: 1px solid rgba(201, 166, 88, 0.2);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .feature-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 14px; }
        .feature-list li { display: flex; align-items: center; gap: 12px; color: #9aa6bb; font-size: 15px; }
        .feature-list li svg { flex-shrink: 0; color: #c9a658; }

        .showcase-visual { position: relative; }
        .screenshot-frame {
          position: relative;
          z-index: 2;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 40px 100px rgba(0,0,0,0.6);
          background: #05070d;
        }
        .screenshot-frame img { width: 100%; height: auto; display: block; }
        .visual-glow {
          position: absolute;
          inset: -20px;
          background: radial-gradient(circle at center, rgba(201, 166, 88, 0.15), transparent 70%);
          z-index: 1;
          pointer-events: none;
        }

        /* Reveal Animations */
        .screenshot-reveal { transition: all 1s cubic-bezier(0.16, 1, 0.3, 1); }
        .reveal-right { transform: translateX(40px); opacity: 0; }
        .reveal-left { transform: translateX(-40px); opacity: 0; }
        
        .is-visible .reveal-right,
        .is-visible .reveal-left { transform: translateX(0); opacity: 1; }

        @media (max-width: 960px) {
          .showcase-item, .showcase-item.inverted { grid-template-columns: 1fr; gap: 48px; text-align: center; }
          .showcase-item.inverted .showcase-content { order: 1; }
          .showcase-item.inverted .showcase-visual { order: 2; }
          .feature-list { align-items: center; }
          .showcase-grid { gap: 100px; }
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
        .lang-toggle {
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
          transition: all 0.2s ease;
          font-family: 'Outfit', sans-serif;
          flex-shrink: 0;
        }
        .lang-toggle:hover {
          background: rgba(255,255,255,0.06);
          color: #e7edf8;
          border-color: rgba(255,255,255,0.22);
        }
        @media (max-width: 600px) {
          .lang-toggle span { display: none; }
        }
      `}</style>
    </div>
  )
}
