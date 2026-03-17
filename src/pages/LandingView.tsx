import { useState } from 'react'
import { Music2, BookOpen, Video, Cloud, Zap, ChevronRight, Layout, Monitor } from 'lucide-react'
import AuthView from './AuthView'

export default function LandingView() {
  const [showAuth, setShowAuth] = useState(false)

  if (showAuth) {
    return (
      <div className="landing-auth-container">
        <button className="btn-close-auth" onClick={() => setShowAuth(false)}>
          <ChevronRight size={24} style={{ transform: 'rotate(180deg)' }} /> Volver
        </button>
        <AuthView />
        <style>{`
          .landing-auth-container {
            position: fixed; inset: 0; z-index: 3000;
            background: #060810;
          }
          .btn-close-auth {
            position: absolute; top: 20px; left: 20px;
            z-index: 3100; color: white; display: flex; align-items: center; gap: 8px;
            font-weight: 600; font-size: 16px;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="landing-root">
      {/* Background Decor */}
      <div className="landing-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <nav className="landing-nav">
        <div className="landing-logo">
          <Music2 size={32} color="var(--gold)" />
          <span>Proclama <span>Pro</span></span>
        </div>
        <button className="btn-login-nav" onClick={() => setShowAuth(true)}>Acceder</button>
      </nav>

      <main className="landing-main">
        <section className="hero">
          <div className="hero-content">
            <div className="badge">Software Gratuito para Iglesias</div>
            <h1>La Proyección que <br /><span>tu Iglesia merece</span></h1>
            <p>
              Simplifica tu servicio con el sistema más moderno de letras y Biblia. 
              Sincronización en la nube, fondos de video y control profesional en el navegador.
            </p>
            <div className="hero-actions">
              <button className="btn-hero-primary" onClick={() => setShowAuth(true)}>
                Empezar ahora <ChevronRight size={18} />
              </button>
              <a href="#features" className="btn-hero-secondary">Ver funciones</a>
            </div>
          </div>
          <div className="hero-visual">
            <div className="mockup-container">
              <div className="mockup-screen">
                <div className="mockup-header">
                  <div className="dot"></div><div className="dot"></div><div className="dot"></div>
                </div>
                <div className="mockup-content">
                  <div className="mockup-sidebar"></div>
                  <div className="mockup-main">
                    <div className="mockup-verse">"Cuan grande es Él"</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="features">
          <div className="section-header">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <button className="btn-back-landing" onClick={() => document.querySelector('.landing-root')?.scrollTo({ top: 0, behavior: 'smooth' })}>
                <ChevronRight size={16} style={{ transform: 'rotate(-90deg)' }} /> Volver arriba
              </button>
            </div>
            <h2>Potencia tu servicio</h2>
            <p>Herramientas diseñadas por y para el Reino.</p>
          </div>
          <div className="features-grid">
            <FeatureCard 
              icon={<BookOpen size={24} />} 
              title="Biblia Integrada" 
              desc="Busca y proyecta versículos al instante. Soporta referencias directas como 'Juan 3:16'." 
            />
            <FeatureCard 
              icon={<Video size={24} />} 
              title="Fondos de Video" 
              desc="Transforma la atmósfera con Motion Backgrounds impactantes directamente desde la web." 
            />
            <FeatureCard 
              icon={<Cloud size={24} />} 
              title="Cloud Sync" 
              desc="Gestiona tus canciones y setlists desde cualquier PC. Todo se guarda automáticamente." 
            />
            <FeatureCard 
              icon={<Zap size={24} />} 
              title="Ultra Rápido" 
              desc="Optimizado para ser ligero, sin instalaciones pesadas. Funciona en cualquier navegador." 
            />
          </div>
        </section>

        <section className="cta-final">
          <div className="cta-card">
            <h2>¿Listo para elevar la calidad de tu proyección?</h2>
            <p>Únete a las iglesias que ya están usando Proclama.</p>
            <button className="btn-hero-primary" onClick={() => setShowAuth(true)}>Crear cuenta gratuita</button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>&copy; 2026 Proclama — Hecho con amor para el Reino de Dios</p>
      </footer>

      <style>{`
        .landing-root {
          background: #060810;
          color: white;
          height: 100vh;
          overflow-y: auto;
          font-family: 'Inter', sans-serif;
          overflow-x: hidden;
          position: relative;
          scroll-behavior: smooth;
        }
        .btn-back-landing {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: #8b98b0; padding: 6px 14px; border-radius: 99px; font-size: 13px;
          cursor: pointer; transition: all 0.2s;
        }
        .btn-back-landing:hover { color: var(--gold); border-color: var(--gold); background: rgba(255,255,255,0.1); }
        .landing-bg {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
        }
        .blob {
          position: absolute; width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(212, 168, 67, 0.08) 0%, transparent 70%);
          filter: blur(80px); border-radius: 50%;
        }
        .blob-1 { top: -100px; right: -100px; }
        .blob-2 { bottom: -100px; left: -100px; opacity: 0.5; }

        .landing-nav {
          display: flex; justify-content: space-between; align-items: center;
          padding: 24px 60px; position: relative; z-index: 10;
          max-width: 1400px; margin: 0 auto;
        }
        .landing-logo {
          display: flex; align-items: center; gap: 12px;
          font-family: 'Cinzel', serif; font-size: 24px; font-weight: 600;
        }
        .landing-logo span span { color: var(--gold); }
        .btn-login-nav {
          padding: 8px 24px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05); color: white; font-weight: 600;
          transition: all 0.2s;
        }
        .btn-login-nav:hover { background: rgba(255,255,255,0.1); border-color: var(--gold); }

        .landing-main { position: relative; z-index: 1; }
        
        .hero {
          display: grid; grid-template-columns: 1fr 1fr; gap: 40px;
          padding: 80px 60px; max-width: 1400px; margin: 0 auto;
          align-items: center;
        }
        .hero-content h1 {
          font-family: 'Cinzel', serif; font-size: 64px; font-weight: 700;
          line-height: 1.1; margin: 24px 0;
        }
        .hero-content h1 span { color: var(--gold); }
        .hero-content p {
          font-size: 18px; color: #8b98b0; max-width: 540px; line-height: 1.6;
          margin-bottom: 40px;
        }
        .badge {
          display: inline-block; padding: 6px 16px; border-radius: 99px;
          background: rgba(212, 168, 67, 0.1); color: var(--gold);
          font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
        }
        .hero-actions { display: flex; gap: 16px; }
        .btn-hero-primary {
          display: flex; align-items: center; gap: 10px;
          padding: 16px 32px; border-radius: 12px; background: var(--gold);
          color: #060810; font-weight: 700; font-size: 16px; transition: transform 0.2s;
        }
        .btn-hero-primary:hover { transform: translateY(-2px); }
        .btn-hero-secondary {
          padding: 16px 32px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
          color: white; font-weight: 600; font-size: 16px;
        }

        .hero-visual { position: relative; }
        .mockup-container {
          background: linear-gradient(135deg, rgba(212,168,67,0.2) 0%, rgba(74,144,217,0.1) 100%);
          padding: 2px; border-radius: 24px; box-shadow: 0 40px 100px rgba(0,0,0,0.8);
        }
        .mockup-screen {
          background: #0d1117; border-radius: 22px; height: 360px; overflow: hidden;
          display: flex; flex-direction: column;
        }
        .mockup-header {
          height: 30px; background: #161b22; display: flex; align-items: center; gap: 6px; padding: 0 15px;
        }
        .mockup-header .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.1); }
        .mockup-content { flex: 1; display: flex; }
        .mockup-sidebar { width: 80px; background: #161b22; border-right: 1px solid rgba(255,255,255,0.05); }
        .mockup-main {
          flex: 1; display: flex; align-items: center; justify-content: center;
          background: radial-gradient(circle, #1a1f2e 0%, #0d1117 100%);
        }
        .mockup-verse { font-family: 'Lora', serif; font-size: 24px; color: white; opacity: 0.8; }

        .features { padding: 120px 60px; max-width: 1400px; margin: 0 auto; }
        .section-header { text-align: center; margin-bottom: 80px; }
        .section-header h2 { font-family: 'Cinzel', serif; font-size: 40px; margin-bottom: 16px; }
        .section-header p { color: #8b98b0; font-size: 18px; }
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 32px; }
        
        .feature-card {
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
          padding: 40px; border-radius: 20px; transition: all 0.3s;
        }
        .feature-cardBy:hover { background: rgba(255,255,255,0.05); border-color: rgba(212,168,67,0.3); transform: translateY(-5px); }
        .feature-icon {
          width: 56px; height: 56px; border-radius: 14px; background: rgba(212,168,67,0.1);
          color: var(--gold); display: flex; align-items: center; justify-content: center; margin-bottom: 24px;
        }
        .feature-card h3 { font-family: 'Cinzel', serif; font-size: 20px; margin-bottom: 12px; }
        .feature-card p { color: #8b98b0; font-size: 15px; line-height: 1.6; }

        .cta-final { padding: 80px 60px; max-width: 1400px; margin: 0 auto; }
        .cta-card {
          background: linear-gradient(90deg, #1a1f2e 0%, #060810 100%);
          border: 1px solid rgba(212,168,67,0.2); border-radius: 32px;
          padding: 80px; text-align: center; display: flex; flex-direction: column; align-items: center;
        }
        .cta-card h2 { font-family: 'Cinzel', serif; font-size: 48px; margin-bottom: 24px; max-width: 800px; }
        .cta-card p { font-size: 20px; color: #8b98b0; margin-bottom: 40px; }

        .landing-footer { text-align: center; padding: 40px; border-top: 1px solid rgba(255,255,255,0.05); color: #4a5568; font-size: 14px; }

        @media (max-width: 1024px) {
          .hero { grid-template-columns: 1fr; text-align: center; }
          .hero-content h1 { font-size: 48px; }
          .hero-content p { margin: 0 auto 40px; }
          .hero-actions { justify-content: center; }
          .landing-nav { padding: 24px 30px; }
        }
      `}</style>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  )
}
