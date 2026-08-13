import { Lock, type LucideIcon } from 'lucide-react'
import { useAppStore } from '@/stores'

interface PremiumFeatureModalProps {
  title: string
  description: string
  benefits: string[]
  icon: LucideIcon
  onClose: () => void
}

export default function PremiumFeatureModal({
  title,
  description,
  benefits,
  icon: Icon,
  onClose,
}: PremiumFeatureModalProps) {
  const handleUpgrade = () => {
    useAppStore.getState().setForceLanding(true, 'precios')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ 
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 2000
    }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ 
        maxWidth: 480, 
        background: '#16191d', 
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.7)',
        borderRadius: '24px',
        overflow: 'hidden',
        animation: 'modalFadeIn 0.3s ease-out'
      }}>
        <div className="modal-header" style={{ 
          padding: '24px', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 12, margin: 0, fontSize: '18px', fontWeight: 700 }}>
            <div style={{ 
              background: 'rgba(201, 166, 88, 0.15)', 
              padding: '8px', 
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Lock size={20} color="var(--gold)" />
            </div>
            <span style={{ color: '#fff' }}>Función Pro</span>
          </h2>
          <button 
            className="btn-icon" 
            onClick={onClose} 
            style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              color: '#778398',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '24px',
                background: 'linear-gradient(135deg, rgba(201, 166, 88, 0.12), rgba(201, 166, 88, 0.04))',
                borderRadius: '20px',
                border: '1px solid rgba(201, 166, 88, 0.2)',
              }}
            >
              <div style={{
                background: 'var(--gold)',
                padding: '14px',
                borderRadius: '14px',
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(201, 166, 88, 0.3)'
              }}>
                <Icon size={32} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                  {title}
                </h3>
                <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#9aa6bb', lineHeight: 1.5 }}>
                  {description}
                </p>
              </div>
            </div>

            <div style={{ 
              fontSize: '15px', 
              color: '#d1dae8', 
              lineHeight: 1.6,
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '24px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <p style={{ margin: '0 0 16px', fontWeight: 700, color: '#fff', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ¿Qué incluye esta función?
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {benefits.map((benefit) => (
                  <li key={benefit} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ 
                      width: 18, 
                      height: 18, 
                      background: 'rgba(201, 166, 88, 0.15)', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      marginTop: '2px',
                      flexShrink: 0
                    }}>
                      <div style={{ width: 6, height: 6, background: 'var(--gold)', borderRadius: '50%' }} />
                    </div>
                    <span style={{ fontSize: '14px' }}>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 36 }}>
            <button 
              className="btn-primary" 
              onClick={handleUpgrade}
              style={{ 
                height: '52px', 
                fontSize: '16px', 
                fontWeight: 800, 
                width: '100%', 
                justifyContent: 'center',
                background: 'var(--gold)',
                color: '#000',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 10px 20px -5px rgba(201, 166, 88, 0.4)',
              }}
            >
              Mejorar a Premium ahora
            </button>
            <button 
              className="btn-ghost" 
              onClick={onClose}
              style={{ 
                height: '44px', 
                fontSize: '14px', 
                fontWeight: 600,
                width: '100%', 
                color: '#778398',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Quizás en otro momento
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
