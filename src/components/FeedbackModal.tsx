import { useState } from 'react'
import { MessageSquarePlus, X, Send, CheckCircle, Loader2 } from 'lucide-react'
import { supabase, createFeedback } from '@/services/supabase'
import { useAppStore } from '@/stores'

export default function FeedbackModal() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAppStore()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (message.trim().length < 5) {
      setError('Escribe al menos 5 caracteres')
      return
    }
    setLoading(true)
    setError('')
    try {
      const success = await createFeedback(message, user?.id ?? null)
      if (!success) {
        setError('Error al enviar. Intenta de nuevo.')
      } else {
        setSent(true)
        setMessage('')
        setTimeout(() => {
          setSent(false)
          setOpen(false)
        }, 2500)
      }
    } catch (err) {
      console.error('Feedback submit error:', err)
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        className="btn-feedback-trigger"
        onClick={() => setOpen(true)}
        aria-label="Enviar sugerencia"
        title="Enviar sugerencia"
      >
        <MessageSquarePlus size={15} />
        Sugerencias
      </button>

      {open && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          onClick={e => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="modal feedback-modal">
            <div className="modal-header">
              <h2 id="feedback-title">
                <MessageSquarePlus size={18} color="var(--gold)" />
                Enviar sugerencia
              </h2>
              <button className="btn-icon" onClick={() => setOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {sent ? (
                <div className="feedback-success">
                  <CheckCircle size={40} color="var(--green)" />
                  <p>¡Gracias por tu sugerencia!</p>
                  <span>Tu opinión nos ayuda a mejorar Proclama.</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    ¿Qué podríamos mejorar? ¿Algo que te gustaría ver en Proclama? Tu opinión es muy valiosa.
                  </p>
                  <label htmlFor="feedback-msg" className="sr-only">Mensaje</label>
                  <textarea
                    id="feedback-msg"
                    className="input"
                    rows={5}
                    placeholder="Escribe tu sugerencia, idea o reporte de problema..."
                    value={message}
                    onChange={e => { setMessage(e.target.value); setError('') }}
                    autoFocus
                    maxLength={1000}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{message.length}/1000</span>
                    {error && <span className="field-error">{error}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
                    <button type="submit" className="btn-primary" disabled={loading || message.trim().length < 5}>
                      {loading ? <Loader2 className="spin" size={14} /> : <Send size={14} />}
                      Enviar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
