import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  icon?: React.ReactNode
}

export default function ConfirmDialog({ 
  message, 
  onConfirm, 
  onCancel, 
  confirmLabel = 'Confirmar', 
  cancelLabel = 'Cancelar',
  danger = false,
  icon
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-msg" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ width: 380 }}>
        <div className="modal-body" style={{ gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon ? icon : (danger && <AlertTriangle size={20} color="var(--red)" />)}
            <p id="confirm-msg" style={{ fontSize: 14 }}>{message}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button ref={cancelRef} className="btn-ghost" onClick={onCancel}>{cancelLabel}</button>
            <button
              className="btn-primary"
              style={danger ? { background: 'var(--red)' } : undefined}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
