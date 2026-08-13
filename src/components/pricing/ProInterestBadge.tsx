import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useAppStore } from '@/stores'
import { registerPremiumInterest, type PremiumInterestSource } from '@/services/supabase'
import { currentPrice, formatCOP } from './pricingHelpers'

type Status = 'idle' | 'sending' | 'done' | 'already' | 'error'

/**
 * Distintivo "Pro" con un botón para levantar la mano.
 *
 * No bloquea nada: durante la fase fundadores todo está abierto. Sirve para
 * medir qué función movería a alguien a pagar, que hoy no sabemos porque nunca
 * se le ha preguntado a nadie dentro de la app.
 */
export default function ProInterestBadge({ source, label = 'Pro', align = 'left' }: {
  source: PremiumInterestSource
  label?: string
  /** Hacia dónde se abre el popup. 'right' para distintivos pegados al borde
   *  derecho de una cabecera, donde alinearlo a la izquierda lo saca de pantalla. */
  align?: 'left' | 'right'
}) {
  const user = useAppStore(s => s.user)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>('idle')

  // Sin sesión no hay correo que registrar: ese caso lo cubre el formulario de
  // la landing.
  if (!user?.email) return null

  const { amount, strikethrough } = currentPrice()

  const send = async () => {
    setStatus('sending')
    const res = await registerPremiumInterest(user.email!.toLowerCase(), user.id, source)
    if (!res.success) return setStatus('error')
    setStatus(res.alreadyRegistered ? 'already' : 'done')
  }

  return (
    <span className="pro-interest">
      <button
        className="pro-interest-badge"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        title="Esta función será parte del plan Pro"
      >
        <Sparkles size={11} /> {label}
      </button>

      {open && (
        <div className={`pro-interest-popup ${align}`} role="status" onClick={e => e.stopPropagation()}>
          <div className="pro-interest-head">
            <strong>Será parte del plan Pro</strong>
            <button onClick={() => setOpen(false)} title="Cerrar"><X size={12} /></button>
          </div>
          <p>
            Hoy la tienes gratis por ser de los primeros. Cuando Proclama empiece a
            cobrar, esta función irá en el plan Pro: {formatCOP(amount, true)} al año
            {strikethrough ? ` (precio fundador, en vez de ${formatCOP(strikethrough)}), congelado de por vida.` : '.'}
          </p>

          {status === 'done' && <p className="pro-interest-ok">Anotado. Gracias — te escribimos antes de cualquier cobro.</p>}
          {status === 'already' && <p className="pro-interest-ok">Ya nos lo habías dicho para esta función.</p>}
          {status === 'error' && <p className="pro-interest-err">No se pudo registrar. Intenta de nuevo.</p>}

          {(status === 'idle' || status === 'sending' || status === 'error') && (
            <button className="pro-interest-cta" onClick={send} disabled={status === 'sending'}>
              {status === 'sending' ? 'Enviando...' : 'Me interesa'}
            </button>
          )}
        </div>
      )}

      <style>{`
        .pro-interest { position: relative; display: inline-flex; }
        .pro-interest-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 1px 7px; border-radius: 999px;
          border: 1px solid rgba(201, 166, 88, 0.4);
          background: rgba(201, 166, 88, 0.12);
          color: var(--gold); font-size: 10px; font-weight: 700;
          cursor: pointer; white-space: nowrap;
        }
        .pro-interest-badge:hover { border-color: var(--gold); background: rgba(201, 166, 88, 0.2); }
        .pro-interest-popup {
          position: absolute; top: calc(100% + 6px); z-index: 200;
          width: 260px; padding: 10px;
          background: var(--bg-elevated); border: 1px solid rgba(201, 166, 88, 0.45);
          border-radius: 8px; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
          text-align: left; white-space: normal;
        }
        .pro-interest-popup.left { left: 0; }
        .pro-interest-popup.right { right: 0; }
        .pro-interest-head {
          display: flex; align-items: center; justify-content: space-between;
          color: var(--gold); font-size: 12px; margin-bottom: 6px;
        }
        .pro-interest-head button {
          background: none; border: none; color: var(--gold); cursor: pointer; padding: 2px;
        }
        .pro-interest-popup p { margin: 0 0 8px; font-size: 11px; line-height: 1.5; color: var(--text-muted); }
        .pro-interest-ok { color: var(--green, #4ade80) !important; }
        .pro-interest-err { color: var(--red, #f87171) !important; }
        .pro-interest-cta {
          width: 100%; padding: 6px; border-radius: 6px; cursor: pointer;
          border: 1px solid var(--gold); background: var(--gold); color: #000;
          font-size: 12px; font-weight: 700;
        }
        .pro-interest-cta:disabled { opacity: 0.6; cursor: default; }
      `}</style>
    </span>
  )
}
