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
                  Acceso Premium Gratuito
                </span>
                <span className="premium-banner-separator">•</span>
                <span className="premium-banner-text-body">
                  Todas las funciones desbloqueadas hasta el <strong>1 de junio, 2026</strong>
                </span>
              </div>
              
              <div className="banner-row-secondary">
                {isLoggedIn ? (
                  <span className="discount-msg success">
                    <Sparkles size={12} />
                    ¡Sesión iniciada! Has asegurado tu <strong>descuento exclusivo</strong> para el futuro.
                  </span>
                ) : (
                  <button className="discount-msg login-trigger" onClick={handleLoginRedirect}>
                    <ArrowRight size={12} />
                    <span>Inicia sesión ahora y asegura un <strong>descuento exclusivo</strong> cuando finalice el periodo gratuito.</span>
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
