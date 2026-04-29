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
  const setActiveView = useAppStore((s) => s.setActiveView)

  const handleUpgrade = () => {
    useAppStore.getState().setForceLanding(true, 'planes')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={20} color="var(--gold)" />
            Funcion Pro
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            x
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                background: 'rgba(212, 175, 55, 0.1)',
                borderRadius: 8,
                border: '1px solid rgba(212, 175, 55, 0.3)',
              }}
            >
              <Icon size={32} color="var(--gold)" style={{ flexShrink: 0 }} />
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {title}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {description}
                </p>
              </div>
            </div>

            <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 12px' }}>Con Pro puedes:</p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            </div>

            <div
              style={{
                padding: 12,
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              Inicia sesion con una cuenta Premium para desbloquear esta funcion.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={onClose}>
              Cerrar
            </button>
            <button className="btn-primary" onClick={handleUpgrade}>
              Ver cuenta Pro
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
