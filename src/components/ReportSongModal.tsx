import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X, Send, CheckCircle, Loader2 } from 'lucide-react'
import { createSongReport } from '@/services/supabase'
import { useProjectionStore } from '@/stores'

interface ReportSongModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ReportSongModal({ isOpen, onClose }: ReportSongModalProps) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  
  const { songId, songTitle } = useProjectionStore(s => ({
    songId: s.state.songId,
    songTitle: s.state.songTitle
  }))

  const reasons = [
    { id: 'lyrics_error', label: 'Error en la letra (faltas, errores)' },
    { id: 'wrong_order', label: 'Orden incorrecto de estrofas' },
    { id: 'missing_stanzas', label: 'Faltan estrofas' },
    { id: 'formatting', label: 'Problemas de formato/estilo' },
    { id: 'other', label: 'Otro motivo' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) {
      setError('Selecciona un motivo')
      return
    }
    if (!songId) {
      setError('No se pudo identificar la canción')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const success = await createSongReport(
        songId,
        reason,
        details,
        null
      )

      if (!success) {
        setError('Error al enviar el reporte. Intenta de nuevo.')
      } else {
        setSent(true)
        setTimeout(() => {
          setSent(false)
          onClose()
          setReason('')
          setDetails('')
        }, 2500)
      }
    } catch (err) {
      console.error('[ReportSong] Submit error:', err)
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal report-song-modal">
        <div className="modal-header">
          <h2 id="report-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="var(--red)" />
            Reportar Canción
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {sent ? (
            <div className="feedback-success" style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle size={48} color="var(--green)" style={{ marginBottom: '16px' }} />
              <p style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0' }}>Reporte enviado</p>
              <span style={{ color: 'var(--text-muted)' }}>Gracias por ayudarnos a mejorar el cancionero.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Canción seleccionada:</div>
                <div style={{ fontWeight: 600 }}>{songTitle}</div>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  ¿Cuál es el problema?
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {reasons.map(r => (
                    <label 
                      key={r.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        cursor: 'pointer', 
                        padding: '12px 16px', 
                        background: reason === r.id ? 'var(--bg-hover)' : 'transparent', 
                        borderRadius: '10px', 
                        border: '1px solid', 
                        borderColor: reason === r.id ? 'var(--gold)' : 'var(--border)', 
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        justifyContent: 'flex-start'
                      }}
                    >
                      <input 
                        type="radio" 
                        name="report-reason" 
                        value={r.id} 
                        checked={reason === r.id}
                        onChange={() => { setReason(r.id); setError('') }}
                        style={{ 
                          accentColor: 'var(--gold)',
                          width: '18px',
                          height: '18px',
                          margin: 0,
                          flexShrink: 0
                        }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: reason === r.id ? 600 : 400, color: reason === r.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {r.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  Detalles adicionales (opcional)
                </label>
                <textarea
                  className="input"
                  placeholder="Explica brevemente el error para que podamos corregirlo..."
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  rows={3}
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              {error && (
                <div style={{ color: 'var(--red)', fontSize: '12px', padding: '8px 12px', background: 'var(--red-dim)', borderRadius: '6px', border: '1px solid var(--red)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={loading || !reason} style={{ background: 'var(--red)', borderColor: 'var(--red)' }}>
                  {loading ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                  Enviar Reporte
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        .report-song-modal {
          width: 100%;
          max-width: 450px;
        }
        .modal-body {
          padding: 24px;
        }
        .field-error {
          color: var(--red);
          font-size: 11px;
        }
      `}</style>
    </div>,
    document.body
  )
}
