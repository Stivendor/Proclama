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
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
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
          {mode === 'optional' && (
            <button
              className="btn-icon"
              onClick={onClose}
              aria-label="Cerrar términos"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="modal-body terms-modal-body">
          <TermsContent />
        </div>

        <div className="terms-modal-footer">
          <label className="terms-checkbox-label">
            <input
              id="terms-accept-checkbox"
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              aria-required="true"
            />
            He leído y acepto los Términos y Condiciones
          </label>
          <button
            className="btn-primary"
            onClick={onAccept}
            disabled={!accepted}
          >
            Aceptar y continuar
          </button>
        </div>
      </div>
    </div>
  )
}
