import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronRight, Download, Instagram, Link2, ListMusic, Menu, Minus, Music2, Search, Smartphone, WifiOff, X } from 'lucide-react'
import AuthView from './AuthView'
import { useAppStore } from '@/stores'
import { supabase } from '@/services/supabase'
import { t } from '@/i18n'
import PricingCards from '@/components/pricing/PricingCards'
import { FOUNDING_PHASE } from '@/hooks/usePlan'

const TikTokIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.79-2.46V9.8a5.72 5.72 0 1 0 4.88 5.66V9.01a7.35 7.35 0 0 0 4.31 1.38V7.3a4.28 4.28 0 0 1-3.25-1.48Z" />
  </svg>
)

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
  const { setForceLanding, forceLandingSection, user, landingShowAuth, setLandingShowAuth, language, setLanguage } = useAppStore()
  const [canInstall, setCanInstall] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const scrollToSection = (id: string) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (!forceLandingSection) return
    const timer = setTimeout(() => scrollToSection(forceLandingSection), 500)
    return () => clearTimeout(timer)
  }, [forceLandingSection])

  useEffect(() => {
    const scrollTo = new URLSearchParams(window.location.search).get('scroll')
    if (scrollTo) setTimeout(() => scrollToSection(scrollTo), 300)

    const handler = (e: Event) => {
      e.preventDefault()
      window.deferredPrompt = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Una sola orquestación de entrada para toda la página: nada aparece dos veces
  // ni con curvas distintas.
  //
  // useLayoutEffect, no useEffect: la clase lp-animate es la que esconde las
  // secciones. Se pone antes de pintar para que no haya un fotograma en el que
  // aparecen y se vuelven a ocultar. Si este efecto no llega a correr —JS caído,
  // hidratación lenta del SSG— nada se esconde y la página se lee entera.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.classList.add('lp-animate')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -80px 0px' }
    )
    observerRef.current = observer

    root.querySelectorAll('.rise').forEach((el) => observer.observe(el))

    return () => {
      observer.disconnect()
      root.classList.remove('lp-animate')
    }
    // Depende de landingShowAuth: al entrar al login este componente NO se
    // desmonta, solo cambia el árbol que devuelve. Con deps [] el efecto se
    // quedaba observando nodos ya retirados y, al volver, los nuevos .rise
    // nacían en opacity:0 sin nadie que los revelara.
  }, [landingShowAuth])

  const handleSignOut = async () => {
    useAppStore.getState().logout()
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn(e)
    }
    window.location.href = '/'
  }

  const handleInstall = async () => {
    if (!window.deferredPrompt) return
    await window.deferredPrompt.prompt()
    const { outcome } = await window.deferredPrompt.userChoice
    if (outcome === 'accepted') setCanInstall(false)
    window.deferredPrompt = undefined
  }

  const primaryCta = () => {
    if (FOUNDING_PHASE) setLandingShowAuth(true)
    else scrollToSection('precios')
  }

  const userName = user?.email?.split('@')[0]

  if (landingShowAuth) {
    return (
      <div className="landing-auth">
        <button className="landing-auth-back" onClick={() => setLandingShowAuth(false)}>
          <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /> {t(language, 'nav.back')}
        </button>
        <AuthView />
        <style>{`
          .landing-auth { position: fixed; inset: 0; background: #08090b; z-index: 3000; }
          .landing-auth-back {
            position: absolute; top: 20px; left: 20px; z-index: 3001;
            display: inline-flex; align-items: center; gap: 6px;
            padding: 8px 14px; border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1);
            color: #d6dae1; font-size: 14px; font-weight: 500;
          }
          .landing-auth-back:hover { background: rgba(255,255,255,0.05); color: #fff; }
        `}</style>
      </div>
    )
  }

  const navLinks = (
    <>
      <button onClick={() => scrollToSection('biblioteca')}>{t(language, 'nav.features')}</button>
      <button onClick={() => scrollToSection('colaborar')}>{t(language, 'nav.showcase')}</button>
      {!FOUNDING_PHASE && <button onClick={() => scrollToSection('precios')}>{t(language, 'nav.pricing')}</button>}
    </>
  )

  return (
    <div className="lp" ref={rootRef}>
      {/*
        DIRECTION CONTRACT — landing, modo Persuade. Semilla ea41b32b.
        THESIS: software de producción en vivo presentado como tal. La página es
          el producto trabajando, no su ilustración. Rechaza la disposición que la
          categoría envía de verdad: hero a dos columnas con portátil flotando en
          3D, rejilla de seis tarjetas de iconos idénticas y degradado dorado como
          sustituto de jerarquía.
        OWN-WORLD: negro neutro con escalones reales de elevación (08090b / 0e1013 /
          16181d), separación por filetes de 1px a rgba(255,255,255,.08), nunca por
          sombra. Inter en toda la página, escala fija con tracking negativo en los
          tamaños grandes. Un solo acento, el dorado #c9a658, con presupuesto de tres
          apariciones por viewport. Radios 8/12/16, jamás píldoras. Las capturas van
          en marcos con filete y luz de canto superior, recortadas, nunca en 3D.
        STORY: el operador ve que no empieza de cero —3.000 canciones ya
          verificadas—, entiende que su líder puede armarle el setlist desde el
          celular con un enlace, comprueba que el domingo no depende del wifi, y
          entra. Los reportes de asistencia van después: son ciertos y únicos,
          pero se usan poco y no cargan la página.
        FIRST VIEWPORT: composición centrada. Etiqueta, titular a dos líneas,
          subtítulo de una, dos botones (dorado sólido + fantasma). Debajo, a todo
          el ancho de la columna, el marco de producto recortado por el pliegue.
        FORM: el estándar de la categoría, jugado derecho. Puerta permanente elegida
          por el usuario sobre la dirección asignada por la tirada. Vara de oficio:
          Linear, Stripe, Vercel. La diferenciación es de ejecución, no de concepto.
      */}

      <header className="lp-nav">
        <div className="lp-nav-in">
          <button className="lp-logo" onClick={() => rootRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Music2 size={18} />
            <span>Proclama</span>
          </button>

          <nav className="lp-nav-links">{navLinks}</nav>

          <div className="lp-nav-actions">
            <button
              className="lp-lang"
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              aria-label={language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              {language === 'es' ? 'EN' : 'ES'}
            </button>
            {user ? (
              <>
                <span className="lp-user">{userName}</span>
                <button className="lp-btn lp-btn-sm" onClick={() => setForceLanding(false)}>
                  {t(language, 'nav.goToApp')}
                </button>
                <button className="lp-ghost lp-ghost-sm" onClick={handleSignOut}>
                  {t(language, 'nav.signOut')}
                </button>
              </>
            ) : (
              <button className="lp-btn lp-btn-sm" onClick={() => setLandingShowAuth(true)}>
                {t(language, 'nav.signIn')}
              </button>
            )}
          </div>

          <button
            className="lp-menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? t(language, 'nav.close') : t(language, 'nav.menu')}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {menuOpen && (
          <div className="lp-drawer">
            <nav className="lp-drawer-links">{navLinks}</nav>
            <div className="lp-drawer-actions">
              {user ? (
                <>
                  <button className="lp-btn" onClick={() => setForceLanding(false)}>{t(language, 'nav.goToApp')}</button>
                  <button className="lp-ghost" onClick={handleSignOut}>{t(language, 'nav.signOut')}</button>
                </>
              ) : (
                <button className="lp-btn" onClick={() => setLandingShowAuth(true)}>{t(language, 'nav.signIn')}</button>
              )}
              <button className="lp-ghost" onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}>
                {language === 'es' ? 'English' : 'Español'}
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="lp-hero">
          <div className="lp-wrap">
            <p className="lp-eyebrow">{t(language, 'landing.eyebrow')}</p>
            <h1>
              {t(language, 'landing.hero.title')}
              <br />
              <span>{t(language, 'landing.hero.titleHighlight')}</span>
            </h1>
            <p className="lp-lede">{t(language, 'landing.hero.subtitle')}</p>
            <div className="lp-cta-row">
              <button className="lp-btn lp-btn-lg" onClick={primaryCta}>
                {FOUNDING_PHASE ? t(language, 'landing.hero.enterApp') : t(language, 'landing.hero.viewPlans')}
                <ArrowRight size={16} />
              </button>
              <button className="lp-ghost lp-ghost-lg" onClick={() => scrollToSection('biblioteca')}>
                {t(language, 'landing.hero.viewLibrary')}
              </button>
              {canInstall && (
                <button className="lp-quiet" onClick={handleInstall}>
                  <Download size={15} /> {t(language, 'landing.hero.downloadApp')}
                </button>
              )}
            </div>
          </div>

          <div className="lp-wrap lp-hero-shot">
            {/* ponytail: /projection.jpg = captura real de una letra proyectada.
                Cae a /app.jpg mientras no exista. */}
            <figure className="lp-frame">
              <img
                src="/app.jpg"
                onError={(e) => { e.currentTarget.style.opacity = '0' }}
                alt="Proclama abierto en la biblioteca: lista de canciones, las estrofas de la letra en diapositivas y la previsualización de la proyección abajo"
                width={1600}
                height={855}
              />
            </figure>
          </div>
        </section>

        {/* ── La biblioteca: primera sección, es el gancho ─────── */}
        <section id="biblioteca" className="lp-section">
          <div className="lp-wrap rise">
            <div className="lp-center">
              <p className="lp-eyebrow">{t(language, 'landing.library.eyebrow')}</p>
              <h2>{t(language, 'landing.library.title')}</h2>
              <p className="lp-body lp-body-center">{t(language, 'landing.library.desc')}</p>
            </div>
            <figure className="lp-frame">
              <img
                src="/library.jpg"
                alt="Biblioteca de Proclama con el contador de 3.119 canciones, la lista con sus escudos de verificación y la letra en diapositivas"
                width={1267}
                height={971}
              />
            </figure>
            <ul className="lp-cards lp-cards-4">
              <li><h3>{t(language, 'landing.library.item1')}</h3></li>
              <li><h3>{t(language, 'landing.library.item2')}</h3></li>
              <li><h3>{t(language, 'landing.library.item3')}</h3></li>
              <li><h3>{t(language, 'landing.library.item4')}</h3></li>
            </ul>
          </div>
        </section>

        {/* ── Colaboradores ────────────────────────────────────── */}
        <section id="colaborar" className="lp-section">
          <div className="lp-wrap lp-split rise">
            <div className="lp-split-copy">
              <p className="lp-eyebrow">{t(language, 'landing.collab.eyebrow')}</p>
              <h2>{t(language, 'landing.collab.title')}</h2>
              <p className="lp-body">{t(language, 'landing.collab.desc')}</p>
              <p className="lp-note">{t(language, 'landing.collab.caveat')}</p>
            </div>

            {/* Flujo en DOM, no una captura inventada: la vista del colaborador
                está tras un token de Pro y no hay captura real todavía. */}
            <ol className="lp-steps lp-split-visual">
              <li>
                <span className="lp-step-icon"><Link2 size={16} /></span>
                <div>
                  <h3>{t(language, 'landing.collab.step1Title')}</h3>
                  <p>{t(language, 'landing.collab.step1Desc')}</p>
                </div>
              </li>
              <li>
                <span className="lp-step-icon"><Smartphone size={16} /></span>
                <div>
                  <h3>{t(language, 'landing.collab.step2Title')}</h3>
                  <p>{t(language, 'landing.collab.step2Desc')}</p>
                </div>
              </li>
              <li>
                <span className="lp-step-icon"><ListMusic size={16} /></span>
                <div>
                  <h3>{t(language, 'landing.collab.step3Title')}</h3>
                  <p>{t(language, 'landing.collab.step3Desc')}</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* ── El mecanismo: dos ventanas ───────────────────────── */}
        <section id="producto" className="lp-section">
          <div className="lp-wrap lp-split rise">
            <div className="lp-split-copy">
              <p className="lp-eyebrow">{t(language, 'landing.dual.eyebrow')}</p>
              <h2>{t(language, 'landing.dual.title')}</h2>
              <p className="lp-body">{t(language, 'landing.dual.desc')}</p>
              <ul className="lp-list">
                <li><Check size={16} /> {t(language, 'landing.dual.item1')}</li>
                <li><Check size={16} /> {t(language, 'landing.dual.item2')}</li>
                <li><Check size={16} /> {t(language, 'landing.dual.item3')}</li>
                {/* Lo que NO funciona sin red se dice aquí mismo, no se omite:
                    solo la RVR1960 es local, el resto sale a bolls.life. */}
                <li className="lp-list-caveat"><Minus size={16} /> {t(language, 'landing.dual.item4')}</li>
              </ul>
            </div>

            {/* Captura real de la ventana de proyección, con fondo de imagen y
                todo, no una recreación. Es la única prueba de lo que ve la sala. */}
            <div className="lp-split-visual">
              <div className="lp-window">
                <div className="lp-window-bar">
                  <span className="lp-window-title">{t(language, 'landing.dual.audience')}</span>
                  <span className="lp-badge-offline"><WifiOff size={12} /> {t(language, 'landing.dual.offline')}</span>
                </div>
                <div className="lp-stage">
                  <img
                    src="/projection.jpg"
                    alt="Juan 3:16 en RVR1960 proyectado a pantalla completa sobre un fondo de atardecer"
                    width={1593}
                    height={901}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Cifras ───────────────────────────────────────────── */}
        <section className="lp-section lp-section-tight">
          <div className="lp-wrap rise">
            <div className="lp-stats">
              <div>
                <span className="lp-stat-num">{t(language, 'landing.benefits.statValue')}</span>
                <p>{t(language, 'landing.stats.songs')}</p>
              </div>
              <div>
                <span className="lp-stat-num">{t(language, 'landing.stats.biblesValue')}</span>
                <p>{t(language, 'landing.stats.bibles')}</p>
              </div>
              <div>
                <span className="lp-stat-num">{t(language, 'landing.stats.networkValue')}</span>
                <p>{t(language, 'landing.stats.network')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Biblia ───────────────────────────────────────────── */}
        <section className="lp-section">
          <div className="lp-wrap lp-split rise">
            <div className="lp-split-copy">
              <span className="lp-icon"><Search size={18} /></span>
              <h2>{t(language, 'landing.showcase.searchTitle')}</h2>
              <p className="lp-body">{t(language, 'landing.showcase.searchDesc')}</p>
              <ul className="lp-list">
                <li><Check size={16} /> {t(language, 'landing.showcase.searchItem1')}</li>
                <li><Check size={16} /> {t(language, 'landing.showcase.searchItem2')}</li>
                <li><Check size={16} /> {t(language, 'landing.showcase.searchItem3')}</li>
              </ul>
            </div>
            <figure className="lp-frame lp-split-visual">
              <img
                src="/bible.jpg"
                alt="Juan 3 abierto en Reina Valera 1960, con el selector de capítulo, el historial de pasajes recientes y el versículo ya en la previsualización de proyección"
                width={984}
                height={1017}
              />
            </figure>
          </div>
        </section>

        {/* ── Reportes: sigue siendo cierto y único, pero ya no es
               la sección estrella. Se usa poco, así que baja a split. ── */}
        <section id="reportes" className="lp-section">
          <div className="lp-wrap lp-split lp-split-flip rise">
            <div className="lp-split-copy">
              <p className="lp-eyebrow">{t(language, 'landing.showcase.reportsBadge')}</p>
              <h2>{t(language, 'landing.showcase.reportsTitle')}</h2>
              <p className="lp-body">{t(language, 'landing.showcase.reportsDesc')}</p>
              <ul className="lp-list">
                <li><Check size={16} /> {t(language, 'landing.showcase.reportsItem1')}</li>
                <li><Check size={16} /> {t(language, 'landing.showcase.reportsItem2')}</li>
              </ul>
            </div>

            {/* El PDF es blanco: va sobre un fondo claro propio con marco, para que
                lea como documento impreso y no como un fogonazo en la página negra. */}
            <figure className="lp-paper lp-split-visual">
              <img
                src="/report.jpg"
                onError={(e) => { e.currentTarget.closest('figure')?.remove() }}
                alt="Reporte PDF de asistencia con gráfica de tendencia y estadísticas por categoría"
                width={982}
                height={897}
              />
            </figure>
          </div>
        </section>

        {/* ── Testimonio ───────────────────────────────────────── */}
        <section className="lp-section lp-section-tight">
          <figure className="lp-wrap lp-quote rise">
            <blockquote>{t(language, 'landing.testimonial.quote')}</blockquote>
            <figcaption>
              <strong>{t(language, 'landing.testimonial.name')}</strong>
              <span>{t(language, 'landing.testimonial.role')}</span>
              <em>{t(language, 'landing.testimonialNote')}</em>
            </figcaption>
          </figure>
        </section>

        {/* ── Precios ──────────────────────────────────────────── */}
        {!FOUNDING_PHASE && (
          <section id="precios" className="lp-section">
            <div className="lp-wrap rise">
              <div className="lp-center">
                <h2>{t(language, 'landing.pricing.title')}</h2>
              </div>
              <PricingCards variant="marketing" onFreeCta={() => setLandingShowAuth(true)} />
            </div>
          </section>
        )}

        {/* ── Cierre ───────────────────────────────────────────── */}
        <section className="lp-section">
          <div className="lp-wrap rise">
            <div className="lp-closing">
              <h2>{t(language, 'landing.closing.title')}</h2>
              <p className="lp-body">{t(language, 'landing.closing.desc')}</p>
              <button className="lp-btn lp-btn-lg" onClick={() => setLandingShowAuth(true)}>
                {t(language, 'landing.closing.cta')} <ArrowRight size={16} />
              </button>
              <p className="lp-note">{t(language, 'landing.closing.note')}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-footer-top">
            <div className="lp-logo lp-logo-static">
              <Music2 size={18} />
              <span>Proclama</span>
            </div>
            <div className="lp-social">
              <a href="https://instagram.com/proclamapro" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
              <a href="https://tiktok.com/@proclamapro" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><TikTokIcon size={18} /></a>
            </div>
          </div>
          <p className="lp-verse">{t(language, 'landing.footer.verse')}</p>
          <div className="lp-footer-bottom">
            <span>{t(language, 'landing.footer.copyright')}</span>
            <nav>
              <a href="/terms">{t(language, 'landing.footer.terms')}</a>
              <a href="mailto:proclamapro@gmail.com">proclamapro@gmail.com</a>
            </nav>
          </div>
        </div>
      </footer>

      <style>{`
        /* ═══ Landing ═══════════════════════════════════════════
           Prefijo lp- para aislar del design system de la app.
           Escala fija, no fluida salvo en los dos titulares mayores.
        */
        .lp {
          --ink:      #08090b;
          --surface:  #0e1013;
          --raised:   #16181d;
          --line:     rgba(255,255,255,0.08);
          --line-2:   rgba(255,255,255,0.14);
          --fg:       #f2f4f7;
          --fg-2:     #a2a9b4;
          --fg-3:     #6d7480;
          --accent:   #c9a658;
          --accent-2: #e0c179;
          --gutter:   24px;
          --col:      1120px;

          flex: 1;
          min-height: 0;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          background: var(--ink);
          color: var(--fg);
          font-family: 'Inter', -apple-system, sans-serif;
          font-size: 16px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
          font-feature-settings: 'cv05' 1, 'ss03' 1;
        }
        .lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
        .lp-wrap { width: 100%; max-width: var(--col); margin: 0 auto; padding: 0 var(--gutter); }

        /* ── Tipografía ─────────────────────────────────────── */
        .lp h1 {
          margin: 0 0 20px;
          font-size: clamp(38px, 5.6vw, 60px);
          line-height: 1.06;
          letter-spacing: -0.035em;
          font-weight: 600;
        }
        /* Segunda línea del titular en tono medio, no en el gris de texto
           deshabilitado: es contraste jerárquico, no un estado apagado. */
        .lp h1 span { color: var(--fg-2); }
        .lp h2 {
          margin: 0 0 16px;
          font-size: clamp(26px, 3.4vw, 36px);
          line-height: 1.15;
          letter-spacing: -0.028em;
          font-weight: 600;
        }
        .lp h3 { margin: 0; font-size: 15px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.45; }
        .lp-eyebrow {
          margin: 0 0 14px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent);
        }
        .lp-lede {
          max-width: 620px;
          margin: 0 auto 32px;
          font-size: 18px;
          line-height: 1.6;
          color: var(--fg-2);
          letter-spacing: -0.011em;
        }
        .lp-body { margin: 0 0 24px; font-size: 16px; line-height: 1.65; color: var(--fg-2); letter-spacing: -0.006em; }
        .lp-body-center { max-width: 640px; margin-inline: auto; }
        .lp-note { margin: 16px 0 0; font-size: 13px; color: var(--fg-3); }
        .lp-caption { margin: 12px 0 0; font-size: 12px; color: var(--fg-3); text-align: center; letter-spacing: 0.01em; }

        /* ── Botones ────────────────────────────────────────── */
        .lp-btn, .lp-ghost, .lp-quiet {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: -0.006em;
          white-space: nowrap;
          cursor: pointer;
          transition: background-color .15s ease, border-color .15s ease, color .15s ease;
        }
        .lp-btn { padding: 9px 15px; border: 1px solid var(--accent); background: var(--accent); color: #16130a; }
        .lp-btn:hover { background: var(--accent-2); border-color: var(--accent-2); }
        .lp-ghost { padding: 9px 15px; border: 1px solid var(--line-2); background: transparent; color: var(--fg); }
        .lp-ghost:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.22); }
        .lp-quiet { padding: 9px 12px; border: 1px solid transparent; background: transparent; color: var(--fg-2); }
        .lp-quiet:hover { color: var(--fg); background: rgba(255,255,255,0.04); }
        .lp-btn-lg, .lp-ghost-lg { padding: 12px 20px; font-size: 15px; }
        .lp-btn-sm, .lp-ghost-sm { padding: 6px 12px; font-size: 13px; }
        .lp :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }

        /* ── Nav ────────────────────────────────────────────── */
        .lp-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(8,9,11,0.72);
          backdrop-filter: saturate(180%) blur(14px);
          -webkit-backdrop-filter: saturate(180%) blur(14px);
          border-bottom: 1px solid var(--line);
        }
        .lp-nav-in {
          max-width: var(--col);
          margin: 0 auto;
          padding: 0 var(--gutter);
          height: 56px;
          display: flex;
          align-items: center;
          gap: 28px;
        }
        .lp-logo {
          display: inline-flex; align-items: center; gap: 8px;
          background: none; border: 0; padding: 0; cursor: pointer;
          font-family: inherit; font-size: 15px; font-weight: 600;
          letter-spacing: -0.02em; color: var(--fg);
        }
        .lp-logo svg { color: var(--accent); }
        .lp-logo-static { cursor: default; }
        .lp-nav-links { display: flex; gap: 4px; margin-right: auto; }
        .lp-nav-links button {
          padding: 6px 10px; border: 0; border-radius: 6px; background: none;
          font-family: inherit; font-size: 14px; font-weight: 450; letter-spacing: -0.006em;
          color: var(--fg-2); cursor: pointer; transition: color .15s ease, background-color .15s ease;
        }
        .lp-nav-links button:hover { color: var(--fg); background: rgba(255,255,255,0.05); }
        .lp-nav-actions { display: flex; align-items: center; gap: 8px; }
        .lp-user { font-size: 13px; color: var(--fg-2); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-lang {
          padding: 6px 9px; border: 1px solid var(--line); border-radius: 6px; background: none;
          font-family: inherit; font-size: 12px; font-weight: 600; letter-spacing: 0.03em;
          color: var(--fg-2); cursor: pointer;
        }
        .lp-lang:hover { color: var(--fg); border-color: var(--line-2); }
        .lp-menu-btn {
          display: none; margin-left: auto; padding: 8px; border: 1px solid var(--line);
          border-radius: 8px; background: none; color: var(--fg); cursor: pointer;
        }
        .lp-drawer { border-top: 1px solid var(--line); background: var(--ink); padding: 12px var(--gutter) 20px; }
        .lp-drawer-links { display: flex; flex-direction: column; }
        .lp-drawer-links button {
          padding: 12px 0; border: 0; border-bottom: 1px solid var(--line); background: none;
          font-family: inherit; font-size: 16px; font-weight: 500; color: var(--fg);
          text-align: left; cursor: pointer;
        }
        .lp-drawer-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .lp-drawer-actions > * { width: 100%; padding: 11px 16px; font-size: 15px; }

        /* ── Secciones ──────────────────────────────────────── */
        .lp-section { padding: 104px 0; }
        .lp-section-tight { padding: 72px 0; }
        .lp-center { text-align: center; margin-bottom: 48px; }

        /* ── Hero ───────────────────────────────────────────── */
        .lp-hero { padding: 96px 0 0; text-align: center; }
        .lp-hero .lp-eyebrow, .lp-hero h1, .lp-hero .lp-lede { max-width: 760px; margin-inline: auto; }
        .lp-cta-row { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .lp-hero-shot { margin-top: 72px; }

        /* Marco de producto: filete, luz de canto arriba, sin 3D ni sombra grande. */
        .lp-frame {
          position: relative;
          margin: 0;
          border: 1px solid var(--line-2);
          border-radius: 12px;
          overflow: hidden;
          background: var(--surface);
          line-height: 0;
        }
        .lp-frame::before {
          content: '';
          position: absolute; inset: 0 0 auto; height: 1px; z-index: 2;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
        }
        .lp-frame img { display: block; width: 100%; height: auto; }
        /* El marco del hero se disuelve por abajo en vez de cortarse en seco. */
        .lp-hero-shot .lp-frame {
          border-radius: 14px 14px 0 0;
          border-bottom: 0;
          -webkit-mask-image: linear-gradient(180deg, #000 58%, transparent 100%);
          mask-image: linear-gradient(180deg, #000 58%, transparent 100%);
        }

        /* ── Split ──────────────────────────────────────────── */
        .lp-split { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 64px; align-items: center; }
        .lp-split-flip .lp-split-copy { order: 2; }
        .lp-split-flip .lp-split-visual { order: 1; }
        .lp-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; margin-bottom: 18px;
          border: 1px solid var(--line-2); border-radius: 9px;
          background: var(--raised); color: var(--accent);
        }
        .lp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }
        .lp-list li { display: flex; gap: 10px; align-items: flex-start; font-size: 15px; line-height: 1.55; color: var(--fg-2); }
        .lp-list svg { flex: 0 0 auto; margin-top: 3px; color: var(--accent); }
        /* La salvedad se lee como salvedad: sin palomita y en tono apagado. */
        .lp-list-caveat { color: var(--fg-3); }
        .lp-list-caveat svg { color: var(--fg-3); }

        /* ── Ventana de proyección (DOM real, no captura) ───── */
        .lp-window { border: 1px solid var(--line-2); border-radius: 12px; overflow: hidden; background: var(--surface); }
        .lp-window-bar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 14px; border-bottom: 1px solid var(--line); background: var(--raised);
        }
        .lp-window-title { font-size: 12px; font-weight: 500; color: var(--fg-2); letter-spacing: 0.01em; }
        .lp-badge-offline {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 8px; border-radius: 999px;
          border: 1px solid rgba(76,175,125,0.3); background: rgba(76,175,125,0.1);
          font-size: 11px; font-weight: 600; color: #6fc79c; letter-spacing: 0.02em;
        }
        .lp-stage { aspect-ratio: 16 / 9; background: #000; }
        .lp-stage img { display: block; width: 100%; height: 100%; object-fit: cover; }

        /* ── Cifras ─────────────────────────────────────────── */
        .lp-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
        .lp-stats > div { padding: 32px 28px; background: var(--ink); }
        .lp-stat-num { display: block; font-size: 38px; font-weight: 600; letter-spacing: -0.035em; line-height: 1; color: var(--fg); }
        .lp-stats p { margin: 12px 0 0; font-size: 14px; line-height: 1.5; color: var(--fg-2); }

        /* ── Reportes ───────────────────────────────────────── */
        .lp-paper {
          margin: 0 auto;
          max-width: 860px;
          padding: 20px;
          border: 1px solid var(--line-2);
          border-radius: 14px;
          background: var(--raised);
        }
        .lp-paper img { display: block; width: 100%; height: auto; border-radius: 6px; }
        .lp-cards { list-style: none; margin: 40px auto 0; padding: 0; max-width: 860px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .lp-cards-4 { max-width: none; grid-template-columns: repeat(4, 1fr); }
        .lp-cards li { padding: 20px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }

        /* ── Colaboradores: flujo de tres pasos ─────────────── */
        .lp-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .lp-steps li { position: relative; display: flex; gap: 16px; padding: 0 0 28px; }
        .lp-steps li:last-child { padding-bottom: 0; }
        /* Hilo que une los pasos, cortado en el último. */
        .lp-steps li:not(:last-child)::before {
          content: '';
          position: absolute; left: 17px; top: 36px; bottom: 8px; width: 1px;
          background: var(--line-2);
        }
        .lp-step-icon {
          position: relative; z-index: 1; flex: 0 0 auto;
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 36px;
          border: 1px solid var(--line-2); border-radius: 50%;
          background: var(--raised); color: var(--accent);
        }
        .lp-steps h3 { margin: 8px 0 4px; font-size: 16px; font-weight: 600; letter-spacing: -0.012em; color: var(--fg); }
        .lp-steps p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--fg-2); }

        /* ── Precios ────────────────────────────────────────────
           PricingCards se comparte con la app y lee sus tokens: dentro de la
           landing traía el azulado de --bg-elevated (#1c2230) y el filete
           grueso de --border (#2d3748). Se remapean aquí, no en el componente,
           para que en la app siga viéndose igual que siempre. */
        .lp .pricing {
          --bg-elevated: var(--surface);
          --border: var(--line);
          --text-primary: var(--fg);
          --text-secondary: var(--fg-2);
          --gold-dim: rgba(201, 166, 88, 0.45);
        }
        .lp .pricing .plan-card { border-radius: 16px; padding: 28px; }
        /* El contrato de esta página separa con filetes, nunca con sombra. */
        .lp .pricing .plan-pro { box-shadow: none; background: var(--raised); border-color: rgba(201, 166, 88, 0.32); }
        .lp .pricing .plan-card h3 { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
        .lp .pricing .plan-price { font-weight: 600; letter-spacing: -0.03em; }
        .lp .pricing .plan-btn-primary,
        .lp .pricing .plan-btn-outline {
          padding: 11px; border-radius: 8px; font-family: inherit;
          font-size: 14px; font-weight: 500; letter-spacing: -0.006em;
        }
        .lp .pricing .plan-btn-primary { font-weight: 600; }
        .lp .pricing .plan-btn-outline { border-color: var(--line-2); }
        .lp .pricing .plan-btn-outline:hover { border-color: rgba(255,255,255,0.22); background: rgba(255,255,255,0.05); }

        /* ── Testimonio ─────────────────────────────────────── */
        .lp-quote { max-width: 720px; margin: 0 auto; text-align: center; }
        .lp-quote blockquote { margin: 0 0 24px; font-size: clamp(19px, 2.2vw, 24px); line-height: 1.5; letter-spacing: -0.018em; color: var(--fg); }
        .lp-quote figcaption { display: flex; flex-direction: column; gap: 3px; }
        .lp-quote strong { font-size: 14px; font-weight: 500; color: var(--fg); }
        .lp-quote span { font-size: 14px; color: var(--fg-2); }
        .lp-quote em { margin-top: 8px; font-size: 12px; font-style: normal; color: var(--fg-3); }

        /* ── Cierre ─────────────────────────────────────────── */
        .lp-closing {
          text-align: center;
          padding: 72px 40px;
          border: 1px solid var(--line-2);
          border-radius: 16px;
          background:
            radial-gradient(120% 140% at 50% 0%, rgba(201,166,88,0.07), transparent 60%),
            var(--surface);
        }
        .lp-closing h2 { margin-bottom: 12px; }
        .lp-closing .lp-body { margin-bottom: 28px; }

        /* ── Footer ─────────────────────────────────────────── */
        .lp-footer { border-top: 1px solid var(--line); padding: 48px 0 40px; }
        .lp-footer-top { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
        .lp-social { display: flex; gap: 8px; }
        .lp-social a {
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border: 1px solid var(--line); border-radius: 8px;
          color: var(--fg-2); text-decoration: none; transition: color .15s ease, border-color .15s ease;
        }
        .lp-social a:hover { color: var(--fg); border-color: var(--line-2); text-decoration: none; }
        .lp-verse { margin: 28px 0; padding: 20px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); font-size: 13px; line-height: 1.6; color: var(--fg-3); }
        .lp-footer-bottom { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--fg-3); }
        .lp-footer-bottom nav { display: flex; gap: 20px; }
        .lp-footer-bottom a { color: var(--fg-3); text-decoration: none; }
        .lp-footer-bottom a:hover { color: var(--fg); text-decoration: none; }

        /* ── Movimiento: una sola curva para toda la página ─── */
        /* Ojo: esconder depende de .lp-animate, que pone el propio efecto que
           luego revela. Sin JS no se esconde nada. */
        .lp.lp-animate .rise { opacity: 0; transform: translateY(16px); transition: opacity .5s cubic-bezier(.22,1,.36,1), transform .5s cubic-bezier(.22,1,.36,1); }
        .lp.lp-animate .rise.is-in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          .lp.lp-animate .rise { opacity: 1; transform: none; transition: none; }
          .lp * { scroll-behavior: auto; }
        }

        /* ── Responsive ─────────────────────────────────────── */
        @media (max-width: 900px) {
          .lp-nav-links, .lp-nav-actions { display: none; }
          .lp-menu-btn { display: inline-flex; }
          .lp-split, .lp-split-flip { grid-template-columns: 1fr; gap: 40px; }
          .lp-split-flip .lp-split-copy, .lp-split-flip .lp-split-visual { order: 0; }
          .lp-stats { grid-template-columns: 1fr; }
          .lp-cards, .lp-cards-4 { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .lp { --gutter: 20px; }
          .lp-section { padding: 72px 0; }
          .lp-section-tight { padding: 56px 0; }
          .lp-hero { padding-top: 64px; }
          .lp-hero-shot { margin-top: 48px; }
          .lp-cta-row > * { flex: 1 1 100%; }
          /* A 390px una captura de escritorio entera es ilegible. Se deja
             desplazar en horizontal a tamaño real en vez de miniaturizarla. */
          .lp-hero-shot .lp-frame {
            overflow-x: auto;
            -webkit-mask-image: none;
            mask-image: none;
            border-radius: 12px;
            border-bottom: 1px solid var(--line-2);
          }
          .lp-hero-shot .lp-frame img { min-width: 760px; }
          .lp-closing { padding: 48px 24px; }
          .lp-paper { padding: 12px; }
          .lp-footer-bottom { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  )
}
