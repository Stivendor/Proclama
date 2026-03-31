import { useState, useEffect, useRef } from 'react'
import { Music2, BookOpen, Video, Cloud, Zap, ChevronRight, Search, Globe, Layout, ShieldCheck, Cpu } from 'lucide-react'
import AuthView from './AuthView'
import FeedbackModal from '@/components/FeedbackModal'
import TermsModal from '@/components/TermsModal'
import { useAppStore } from '@/stores'
import { CURRENT_TERMS_VERSION } from '@/constants/terms'

export default function LandingView() {
  const { setGuestMode, acceptTerms } = useAppStore()
  const [showTermsForGuest, setShowTermsForGuest] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
        }
      })
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' })

    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
      observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  if (showAuth) {
    return (
      <div className="landing-auth-container fade-in">
        <button className="btn-close-auth" onClick={() => setShowAuth(false)}>
          <ChevronRight size={24} style={{ transform: 'rotate(180deg)' }} /> Volver
        </button>
        <AuthView />
        <style>{`
          .landing-auth-container { position: fixed; inset: 0; z-index: 3000; background: #060810; }
          .btn-close-auth { position: absolute; top: 20px; left: 20px; z-index: 3100; color: white; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 16px; }
          .fade-in { animation: fadeIn 0.3s ease-out; }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </div>
    )
  }

  return (
    <div className="landing-root">
      {/* Fondo Ultraligero pero elegante */}
      <div className="landing-bg">
        <div className="grid-overlay"></div>
        <div className="glow glow-1"></div>
        <div className="glow glow-2"></div>
      </div>

      <nav className="landing-nav animate-fade-down">
        <div className="landing-logo">
          <Music2 size={32} color="var(--gold)" />
          <span>Proclama <span>Pro</span></span>
        </div>
        <div className="nav-links">
          <a href="#funciones">Funciones</a>
          <a href="#diferenciadores">Por qué Proclama</a>
        </div>
        <div className="nav-actions">
          <FeedbackModal />
          <button className="btn-login-line" onClick={() => setShowAuth(true)}>Acceder</button>
        </div>
      </nav>

      <main className="landing-main">
        <section className="hero">
          <div className="hero-content">
            <div className="badge animate-fade-up" style={{ animationDelay: '0.1s' }}>
              <Zap size={14} color="#C9A658" /> Software Ultra Ligero
            </div>
            <h1 className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
              Proyección pura.<br />
              <span className="text-glow">Sin complicaciones.</span>
            </h1>
            <p className="animate-fade-up" style={{ animationDelay: '0.3s' }}>
              El software definitivo para iglesias optimizado para cualquier PC. <br/>
              Búsqueda de letras online, Biblia al instante y proyección impecable.
            </p>
            <div className="hero-actions animate-fade-up" style={{ animationDelay: '0.4s' }}>
              <button className="btn-primary-glow" onClick={() => setShowTermsForGuest(true)}>
                Probar Gratis <ChevronRight size={18} />
              </button>
              <a href="#funciones" className="btn-secondary-line">Descubrir más</a>
            </div>
          </div>

          <div className="hero-visual animate-pop-in" style={{ animationDelay: '0.5s' }}>
            {/* Abstracción UI ligera en lugar de iframes pesados */}
            <div className="abstract-ui">
              <div className="ui-header">
                <span className="dot" style={{background:'#ff5f56'}}></span>
                <span className="dot" style={{background:'#ffbd2e'}}></span>
                <span className="dot" style={{background:'#27c93f'}}></span>
              </div>
              <div className="ui-body">
                <div className="ui-sidebar">
                  <div className="ui-line short"></div>
                  <div className="ui-line medium active"></div>
                  <div className="ui-line short"></div>
                </div>
                <div className="ui-main">
                  <div className="ui-lyrics-card">
                    <h2>Cuán Grande Es Él</h2>
                    <div className="ui-line full opacity-50"></div>
                    <div className="ui-line medium opacity-50"></div>
                  </div>
                  <div className="ui-search-bar">
                    <Search size={14} color="#8b98b0" />
                    <span>Buscar canción en internet...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="funciones" className="features-section">
          <div className="features-header animate-on-scroll">
            <h2 className="title-serif">Todo lo que necesitas, nada que sobre</h2>
          </div>

          <div className="bento-grid">
            {/* Celda Principal */}
            <div className="bento-cell cell-large animate-on-scroll delay-1">
              <div className="cell-content">
                <Globe size={32} color="var(--gold)" />
                <h3>Búsqueda Online Integrada</h3>
                <p>No pierdas tiempo descargando archivos. Busca en internet y proyecta las letras directamente en el servicio en segundos.</p>
              </div>
              <div className="cell-decor decor-search">
                <div className="search-pill"><Search size={12}/> <span>Quiero levantar mis manos</span></div>
              </div>
            </div>

            {/* Celdas regulares */}
            <div className="bento-cell animate-on-scroll delay-2">
               <BookOpen size={28} color="var(--gold)" />
               <h3>Biblia Veloz</h3>
               <p>Ingresa referencias ("Juan 3:16") y lánzalas pantalla al instante en múltiples versiones.</p>
            </div>

            <div className="bento-cell animate-on-scroll delay-3">
               <Video size={28} color="var(--gold)" />
               <h3>Fondos Dinámicos</h3>
               <p>Monta videos en bucle (MP4) o imágenes de fondo sin atascar tu computadora.</p>
            </div>

            <div className="bento-cell cell-wide animate-on-scroll delay-4">
              <div className="cell-content-row">
                <div className="icon-box"><Cloud size={24} color="#060810"/></div>
                <div>
                  <h3>Sincronización Cloud Automática</h3>
                  <p>Inicia sesión en la PC de la iglesia y tendrás acceso a todas tus canciones y configuraciones instantáneamente. Adiós memorias USB.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ventajas Verticales - Scroll Experience */}
        <section id="diferenciadores" className="differentiators-section">
          <div className="features-header animate-on-scroll">
            <h2 className="title-serif">Diseñado para la Iglesia</h2>
            <p style={{color: '#8b98b0', marginTop: '16px'}}>Fluidez, portabilidad y potencia sin compromisos.</p>
          </div>
          
          <div className="vertical-features">
            {/* Feature 1 */}
            <div className="v-feature animate-on-scroll">
              <div className="v-feature-text">
                <div className="feature-icon"><Layout size={24} color="var(--gold)"/></div>
                <h3>Proyección 100% Web</h3>
                <p>Olvídate de descargas pesadas o de necesitar hardware dedicado. Abre tu navegador en cualquier PC (o Mac), inicia sesión, conecta tu pantalla extendida y comienza a proyectar al instante.</p>
              </div>
              <div className="v-feature-visual">
                <div className="wireframe-box fade-in-delay">
                  <div className="wf-bar"></div>
                  <div className="wf-main">
                    <div className="wf-sidebar"></div>
                    <div className="wf-content"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2 (Reverse) */}
            <div className="v-feature reverse animate-on-scroll">
              <div className="v-feature-text">
                <div className="feature-icon"><Cpu size={24} color="var(--gold)"/></div>
                <h3>Ultra Eficiente</h3>
                <p>Todo está optimizado para que funcione rápido y sin problemas. Puedes proyectar texto, fondos en movimiento y usar varias pantallas sin que el computador se ponga lento, incluso si es antiguo.</p>
              </div>
              <div className="v-feature-visual">
                 <div className="wireframe-circle-box fade-in-delay">
                    <Zap size={40} color="#8b98b0" style={{opacity: 0.3}}/>
                 </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="v-feature animate-on-scroll">
              <div className="v-feature-text">
                <div className="feature-icon"><Search size={24} color="var(--gold)"/></div>
                <h3>Repertorio Ilimitado</h3>
                <p>¿Te pidieron una adoración de último minuto? Nuestra barra de búsqueda online rastrea acordes y letras de toda la web y las expone formateadas y listas para la proyección en pantalla completa.</p>
              </div>
              <div className="v-feature-visual">
                <div className="wireframe-search-box fade-in-delay">
                  <div className="wf-search-bar"><Search size={14} /> buscar canto...</div>
                  <div className="wf-results">
                    <div className="wf-line"></div>
                    <div className="wf-line"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-section animate-on-scroll">
          <div className="cta-box">
            <h2>Lleva la excelencia a tus pantallas</h2>
            <p>Hecho para correr fluido hasta en ordenadores con bajos recursos.</p>
            <button className="btn-primary-glow" onClick={() => setShowTermsForGuest(true)}>
              Iniciar Presentación
            </button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>&copy; 2026 Proclama — Excelencia para Su Reino.</p>
      </footer>

      {showTermsForGuest && (
        <TermsModal
          mode="required"
          onAccept={async () => {
            await acceptTerms(CURRENT_TERMS_VERSION)
            setGuestMode(true)
          }}
          onClose={() => setShowTermsForGuest(false)}
        />
      )}

      {/* Estilos estrictamente optimizados (Sin Backdrop Filters excesivos) */}
      <style>{`
        ::selection { background: rgba(201, 166, 88, 0.3); color: white; }
        
        .landing-root {
          background: #040509;
          color: white;
          height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
          font-family: 'Inter', sans-serif;
          scroll-behavior: smooth;
        }

        /* Ambientación de bajo costo computacional */
        .landing-bg {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
        }
        .grid-overlay {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(circle at center, black 20%, transparent 80%);
          -webkit-mask-image: radial-gradient(circle at center, black 20%, transparent 80%);
        }
        .glow {
          position: absolute; width: 500px; height: 500px; border-radius: 50%;
          filter: blur(120px); opacity: 0.15;
          /* Usamos renderizado GPU */
          transform: translateZ(0); 
        }
        .glow-1 { top: -200px; right: -100px; background: #C9A658; }
        .glow-2 { bottom: -200px; left: -100px; background: #1a365d; }

        /* Typography */
        .title-serif { font-family: 'Cinzel', serif; font-weight: 600; }
        .text-glow {
          background: linear-gradient(90deg, #fff, #C9A658);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          filter: drop-shadow(0px 0px 20px rgba(201, 166, 88, 0.2));
        }

        /* Navigation */
        .landing-nav {
          display: flex; justify-content: space-between; align-items: center;
          padding: 24px 5%; position: relative; z-index: 10;
          max-width: 1400px; margin: 0 auto;
        }
        .landing-logo {
          display: flex; align-items: center; gap: 12px;
          font-family: 'Cinzel', serif; font-size: 24px; font-weight: 600;
        }
        .landing-logo span span { color: var(--gold); }
        .nav-links { display: flex; gap: 32px; display: none; }
        @media (min-width: 768px) { .nav-links { display: flex; } }
        .nav-links a { color: #8b98b0; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
        .nav-links a:hover { color: white; }
        .nav-actions { display: flex; align-items: center; gap: 16px; }

        /* Buttons Minimalistas */
        .btn-login-line {
          padding: 8px 24px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
          background: transparent; color: white; font-weight: 500; font-size: 14px;
          transition: border-color 0.2s, background 0.2s;
        }
        .btn-login-line:hover { border-color: rgba(201, 166, 88, 0.5); background: rgba(201, 166, 88, 0.05); }

        .btn-primary-glow {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 16px 36px; border-radius: 8px; font-size: 16px; font-weight: 600;
          background: #C9A658; color: #040509; border: none; cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 8px 30px rgba(201, 166, 88, 0.2);
        }
        .btn-primary-glow:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(201, 166, 88, 0.3);
        }

        .btn-secondary-line {
          display: inline-flex; align-items: center; padding: 16px 36px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1); color: white; text-decoration: none; font-weight: 500;
          transition: background 0.2s;
        }
        .btn-secondary-line:hover { background: rgba(255,255,255,0.05); }

        .badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 16px; border-radius: 99px; border: 1px solid rgba(201, 166, 88, 0.3);
          background: rgba(201, 166, 88, 0.05); color: #e2e8f0; font-size: 13px; font-weight: 500;
          letter-spacing: 0.5px;
        }

        /* Hero Layout */
        .landing-main { position: relative; z-index: 1; overflow: hidden; }
        
        .hero {
          display: grid; grid-template-columns: 1fr 1fr; gap: 40px;
          padding: 100px 5%; max-width: 1400px; margin: 0 auto;
          align-items: center; min-height: 80vh;
        }
        .hero-content h1 {
          font-family: 'Cinzel', serif; font-size: clamp(40px, 5vw, 64px); 
          font-weight: 700; line-height: 1.1; margin: 24px 0; text-wrap: balance;
        }
        .hero-content p {
          font-size: 18px; color: #8b98b0; max-width: 500px; line-height: 1.6; margin-bottom: 40px;
        }
        .hero-actions { display: flex; gap: 16px; flex-wrap: wrap; }

        /* Abstracción UI Ultraligera (CSS puro, no imágenes) */
        .hero-visual {
          position: relative; perspective: 1000px;
        }
        .abstract-ui {
          width: 100%; aspect-ratio: 16/10;
          background: linear-gradient(135deg, #101218, #0a0c12);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px; box-shadow: 0 40px 100px rgba(0,0,0,0.8);
          transform: rotateY(-10deg) rotateX(5deg);
          display: flex; flex-direction: column; overflow: hidden;
        }
        .ui-header { height: 24px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; padding: 0 12px; gap: 6px; }
        .ui-header .dot { width: 8px; height: 8px; border-radius: 50%; opacity: 0.5; }
        .ui-body { display: flex; flex: 1; }
        .ui-sidebar { width: 60px; border-right: 1px solid rgba(255,255,255,0.05); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .ui-line { height: 6px; border-radius: 4px; background: rgba(255,255,255,0.1); }
        .ui-line.short { width: 60%; }
        .ui-line.medium { width: 80%; }
        .ui-line.full { width: 100%; }
        .ui-line.active { background: var(--gold); }
        .opacity-50 { opacity: 0.5; margin-bottom: 8px; }
        .ui-main { flex: 1; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
        .ui-lyrics-card { 
          flex: 1; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.03); 
          border-radius: 8px; padding: 20px;
        }
        .ui-lyrics-card h2 { font-size: 20px; font-weight: 600; color: white; margin-bottom: 16px; font-family: 'Cinzel', serif;}
        .ui-search-bar {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
          border-radius: 6px; padding: 12px 16px; display: flex; align-items: center; gap: 10px;
          color: #8b98b0; font-size: 13px;
        }

        /* Bento Grid */
        .features-section { padding: 100px 5%; max-width: 1200px; margin: 0 auto; }
        .features-header { text-align: center; margin-bottom: 60px; }
        .features-header h2 { font-size: 36px; }
        
        .bento-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
          grid-auto-rows: minmax(180px, auto);
        }
        .bento-cell {
          background: linear-gradient(145deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
          border: 1px solid rgba(255,255,255,0.05); border-radius: 16px;
          padding: 32px; display: flex; flex-direction: column; position: relative;
          overflow: hidden; transition: border-color 0.3s;
        }
        .bento-cell:hover { border-color: rgba(201, 166, 88, 0.3); }
        .bento-cell h3 { font-size: 20px; margin: 16px 0 8px; color: #fff; font-weight: 600; }
        .bento-cell p { font-size: 14px; color: #8b98b0; line-height: 1.6; }
        
        .cell-large { grid-column: span 3; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; }
        @media (max-width: 768px) { .cell-large { grid-template-columns: 1fr; } }
        
        .cell-wide { grid-column: span 3; }
        .cell-content-row { display: flex; align-items: center; gap: 24px; }
        @media (max-width: 768px) { .cell-content-row { flex-direction: column; align-items: flex-start; } }
        .icon-box { background: var(--gold); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        
        .decor-search { display: flex; align-items: center; justify-content: center; height: 100%; }
        .search-pill { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px 24px; border-radius: 99px; display: flex; align-items: center; gap: 10px; color: #fff; font-size: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }

        /* Differentiators Vertical Scroll */
        .differentiators-section { padding: 80px 5% 120px; max-width: 1200px; margin: 0 auto; }
        .vertical-features { display: flex; flex-direction: column; gap: 120px; margin-top: 80px; }
        
        .v-feature { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .v-feature.reverse { direction: rtl; }
        .v-feature.reverse > * { direction: ltr; }
        
        .v-feature-text h3 { font-family: 'Cinzel', serif; font-size: 32px; font-weight: 600; margin-bottom: 20px; color: white; }
        .v-feature-text p { font-size: 17px; color: #8b98b0; line-height: 1.7; }
        
        .v-feature-visual {
          perspective: 1000px;
          display: flex; justify-content: center; align-items: center;
          background: radial-gradient(circle at center, rgba(201, 166, 88, 0.05) 0%, transparent 60%);
          height: 300px; border-radius: 24px; position: relative;
        }

        /* Abstract Wireframes for Visuals */
        .wireframe-box { width: 260px; height: 180px; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; background: rgba(0,0,0,0.4); display: flex; flex-direction: column; transform: rotateY(-15deg) rotateX(10deg); box-shadow: 20px 30px 60px rgba(0,0,0,0.5); }
        .wf-bar { height: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .wf-main { display: flex; flex: 1; }
        .wf-sidebar { width: 40px; border-right: 1px solid rgba(255,255,255,0.05); }
        .wf-content { flex: 1; background: rgba(201, 166, 88, 0.05); border: 2px dashed rgba(201, 166, 88, 0.2); margin: 12px; border-radius: 4px; }
        
        .wireframe-circle-box { width: 140px; height: 140px; border-radius: 50%; border: 2px dashed rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; position: relative; }
        .wireframe-circle-box::before { content: ''; position: absolute; inset: -20px; border: 1px solid rgba(255,255,255,0.05); border-radius: 50%; }
        
        .wireframe-search-box { width: 260px; background: #0a0c12; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; transform: rotateY(15deg) rotateX(10deg); box-shadow: -20px 30px 60px rgba(0,0,0,0.5);}
        .wf-search-bar { background: rgba(255,255,255,0.05); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; gap: 8px; font-size: 11px; color: #666; margin-bottom: 16px; }
        .wf-results { display: flex; flex-direction: column; gap: 8px; }
        .wf-line { height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; width: 100%; }
        .wf-line:last-child { width: 60%; }

        @media (max-width: 768px) {
          .v-feature, .v-feature.reverse { grid-template-columns: 1fr; gap: 40px; text-align: center; }
          .feature-icon { margin: 0 auto; }
          .vertical-features { gap: 80px; }
        }

        /* CTA */
        .cta-section { padding: 60px 5% 120px; max-width: 1000px; margin: 0 auto; text-align: center; }
        .cta-box { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 80px; }
        .cta-box h2 { font-family: 'Cinzel', serif; font-size: 36px; margin-bottom: 16px; }
        .cta-box p { color: #8b98b0; font-size: 16px; margin-bottom: 32px; }

        .landing-footer { text-align: center; padding: 32px; color: #4a5568; font-size: 14px; border-top: 1px solid rgba(255,255,255,0.05); }

        /* Animations */
        .animate-fade-up { opacity: 0; transform: translateY(20px); animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-down { opacity: 0; transform: translateY(-10px); animation: fadeDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pop-in { opacity: 0; transform: scale(0.95); animation: popIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        /* Scroll Animations */
        .animate-on-scroll { opacity: 0; transform: translateY(30px); transition: opacity 0.8s ease-out, transform 0.8s ease-out; }
        .animate-on-scroll.is-visible { opacity: 1; transform: translateY(0); }
        .delay-1 { transition-delay: 0.1s; }
        .delay-2 { transition-delay: 0.2s; }
        .delay-3 { transition-delay: 0.3s; }
        .delay-4 { transition-delay: 0.4s; }
        
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeDown { to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 
          from { opacity: 0; transform: scale(0.95) rotateY(-15deg) rotateX(10deg); } 
          to { opacity: 1; transform: scale(1) rotateY(-10deg) rotateX(5deg); } 
        }

        @media (max-width: 1024px) {
          .hero { grid-template-columns: 1fr; text-align: center; padding-top: 60px; }
          .hero-content p { margin-left: auto; margin-right: auto; }
          .hero-actions { justify-content: center; }
          .bento-grid { grid-template-columns: 1fr; }
          .cell-large, .cell-wide { grid-column: span 1; }
          .abstract-ui { transform: none; animation: none; }
        }
      `}</style>
    </div>
  )
}

