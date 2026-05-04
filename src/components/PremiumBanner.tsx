import React, { useState } from 'react';
import { Sparkles, X, Calendar, Crown, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/stores';

export default function PremiumBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const authStatus = useAppStore(s => s.authStatus);
  const isGuest = useAppStore(s => s.guestMode);

  const setActiveView = useAppStore(s => s.setActiveView);
  const setLandingShowAuth = useAppStore(s => s.setLandingShowAuth);
  const isLanding = useAppStore(s => s.forceLanding);

  if (!isVisible) return null;

  const isLoggedIn = authStatus === 'authenticated';

  const handleLoginRedirect = () => {
    if (isLanding) {
      setLandingShowAuth(true);
    } else {
      setActiveView('settings');
    }
  };

  return (
    <div className="premium-banner-wrapper">
      <div className="premium-banner-refined">
        <div className="premium-banner-glass-effect" />
        
        <div className="premium-banner-inner">
          <div className="premium-banner-brand">
            <div className="brand-badge">
              <Crown size={12} fill="currentColor" />
              <span>PRO</span>
            </div>
          </div>

          <div className="premium-banner-divider" />
          
          <div className="premium-banner-main">
            <div className="banner-content-rows">
              <div className="banner-row-primary">
                <span className="premium-banner-text-highlight">
                  Oferta de Lanzamiento
                </span>
                <span className="premium-banner-separator">•</span>
                <span className="premium-banner-text-body">
                  Válido solo hasta el <strong>1 de junio, 2026</strong>
                </span>
              </div>
              
              <div className="banner-row-secondary">
                {isLoggedIn ? (
                  <span className="discount-msg success">
                    <Sparkles size={12} />
                    ¡Felicidades! Al registrarte antes del 1 de junio, has asegurado tu cuenta <strong>Premium de por vida</strong>.
                  </span>
                ) : (
                  <button className="discount-msg login-trigger" onClick={handleLoginRedirect}>
                    <ArrowRight size={12} />
                    <span>Inicia sesión <strong>antes del 1 de junio</strong> y asegura tu cuenta <strong>Premium de por vida</strong>.</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="premium-banner-actions">
            <div className="premium-date-pill">
              <Calendar size={13} />
              <span>1 Jun 2026</span>
            </div>
            <button 
              className="premium-banner-close-btn"
              onClick={() => setIsVisible(false)}
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="banner-shine-line" />
        <Sparkles size={16} className="banner-sparkle floating-sparkle-1" />
        <Sparkles size={14} className="banner-sparkle floating-sparkle-2" />
      </div>
    </div>
  );
}
