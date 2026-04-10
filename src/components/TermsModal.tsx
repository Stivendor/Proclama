import { useEffect, useRef, useState } from 'react'
import { X, FileText } from 'lucide-react'
import TermsContent from '@/components/TermsContent'

interface TermsModalProps {
  mode: 'required' | 'optional'
  onAccept: () => void
  onClose: () => void
}

export default function TermsModal({ mode, onAccept, onClose }: TermsModalProps) {
  const [accepted, setAccepted] = useState(false)
  const [reachedBottom, setReachedBottom] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return

    const handleScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10
      if (atBottom) setReachedBottom(true)
    }

    el.addEventListener('scroll', handleScroll)
    // Por si el contenido es corto y no necesita scroll
    handleScroll()
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  function handleOverlayClick() {
    if (mode === 'optional') onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal terms-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="terms-modal-title" ref={titleRef} tabIndex={-1}>
            <FileText size={18} color="var(--gold)" />
            Términos y Condiciones
          </h2>
          <button
            className="btn-icon"
            onClick={onClose}
            aria-label="Cerrar términos"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body terms-modal-body" ref={bodyRef}>
          <TermsContent />
          {!reachedBottom && (
            <div style={{
              position: 'sticky',
              bottom: 0,
              textAlign: 'center',
              padding: '8px 0',
              fontSize: 12,
              color: 'var(--text-muted)',
              background: 'linear-gradient(transparent, var(--surface))',
              pointerEvents: 'none',
            }}>
              ↓ Desplázate para leer todo el contenido
            </div>
          )}
        </div>

        <div className="terms-modal-footer">
          <label
            className="terms-checkbox-label"
            style={{ opacity: reachedBottom ? 1 : 0.4, transition: 'opacity 0.3s' }}
            title={!reachedBottom ? 'Debes leer los términos completos primero' : undefined}
          >
            <input
              id="terms-accept-checkbox"
              type="checkbox"
              checked={accepted}
              onChange={e => reachedBottom && setAccepted(e.target.checked)}
              disabled={!reachedBottom}
              aria-required="true"
            />
            He leído y acepto los Términos y Condiciones
          </label>
          <button
            className="btn-primary"
            onClick={onAccept}
            disabled={!accepted || !reachedBottom}
            title={!reachedBottom ? 'Debes leer los términos completos' : !accepted ? 'Acepta los términos para continuar' : undefined}
          >
            Aceptar y continuar
          </button>
        </div>
      </div>
    </div>
  )
}