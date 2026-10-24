import { useEffect, useRef } from 'react'
import { Check, Heart, X } from 'lucide-react'
import { useAppStore } from '@/stores'
import { t } from '@/i18n'
import { currentPrice, formatCOP, monthlyEquivalent, subscribeWhatsappUrl, founderDeadline, founderSavings } from './pricingHelpers'

interface Props {
  /** Último día completo con Pro, ya calculado por graceStatus(). */
  lastFullDay: Date
  userEmail?: string
  onClose: () => void
}

/**
 * Aviso de fin de la fase fundadores. Se muestra una vez al entrar; después, el
 * recordatorio permanente es el banner del sidebar, que puede volver a abrirlo.
 *
 * Las listas de funciones salen de las mismas claves que PricingCards: si un
 * gate nuevo se anuncia allí, aparece aquí solo, y no puede cobrarse algo que
 * el aviso no nombró.
 */
export default function GraceNoticeModal({ lastFullDay, userEmail, onClose }: Props) {
  const language = useAppStore((s) => s.language)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const freeFeatures = ['f1', 'f2', 'f3', 'f4', 'f5'].map((k) =>
    t(language, `landing.pricing.free.${k}`),
  )
  const proFeatures = ['f1', 'f7', 'f2', 'f3', 'f4', 'f5', 'f6'].map((k) =>
    t(language, `landing.pricing.premium.${k}`),
  )

  // El último día completo, no el del vencimiento: la gracia caduca a las 00:00,
  // así que "sigue igual hasta el 12" sería un día de más — el 12 ya son Gratis.
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const date = lastFullDay.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  // La otra fecha, la que de verdad obliga a decidir: la del precio fundador.
  // Hasta ahora el aviso nombraba sólo la primera, y quien leía "hasta el 11 de
  // noviembre" creía que esa era toda la decisión que tenía por delante.
  const deadlineDate = founderDeadline().toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const { amount, strikethrough } = currentPrice()

  // Con promoción viva, el precio de lista va en el párrafo de costos y el
  // fundador en el suyo. Sin promoción hay un solo precio y sobra el segundo.
  const listPrice = formatCOP(strikethrough ?? amount, true)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal grace-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grace-notice-title"
      >
        <div className="modal-header">
          <h2 id="grace-notice-title" ref={titleRef} tabIndex={-1}>
            <Heart size={18} color="var(--gold)" />
            {t(language, 'graceNotice.title')}
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label={t(language, 'graceNotice.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body grace-notice-body">
          <p>{t(language, 'graceNotice.lead', { date })}</p>

          <div className="grace-notice-block">
            <h3>{t(language, 'graceNotice.freeTitle')}</h3>
            <ul>
              {freeFeatures.map((f, i) => (
                <li key={i}><Check size={15} /> {f}</li>
              ))}
            </ul>
            <p className="grace-notice-closing">{t(language, 'graceNotice.freeClosing')}</p>
          </div>

          <div className="grace-notice-block grace-notice-pro">
            <h3>{t(language, 'graceNotice.proTitle')}</h3>
            <ul>
              {proFeatures.map((f, i) => (
                <li key={i}><Check size={15} /> {f}</li>
              ))}
            </ul>
          </div>

          <p>{t(language, 'graceNotice.costs', { list: listPrice })}</p>
          {strikethrough && (
            <p className="grace-notice-founder">
              {t(language, 'graceNotice.founder', {
                price: formatCOP(amount, true),
                monthly: formatCOP(monthlyEquivalent(amount)),
              })}
            </p>
          )}
          {/* Las dos piezas de escasez van condicionadas a la promoción viva,
              igual que el párrafo de arriba: pasado el 31-dic el bloque entero
              se cae y no queda un aviso hablando de una oferta muerta. */}
          {strikethrough && (
            <p>{t(language, 'graceNotice.deadline', { date: deadlineDate, list: listPrice })}</p>
          )}
          {strikethrough && (
            <p className="grace-notice-savings">
              {t(language, 'graceNotice.savings', { amount: formatCOP(founderSavings()) })}
            </p>
          )}
          <p>{t(language, 'graceNotice.thanks')}</p>
        </div>

        <div className="grace-notice-footer">
          <button className="btn-ghost" onClick={onClose}>
            {t(language, 'graceNotice.dismiss')}
          </button>
          <a
            className="btn-primary"
            href={subscribeWhatsappUrl(userEmail)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t(language, 'graceNotice.ctaFounder', { price: formatCOP(amount, true) })}
          </a>
        </div>
      </div>

      <style>{`
        .grace-notice { max-width: 560px; }
        .grace-notice-body { display: flex; flex-direction: column; gap: 14px; font-size: 14px; line-height: 1.5; }
        .grace-notice-block { padding: 14px 16px; border-radius: 12px; background: var(--bg-elevated, rgba(255,255,255,0.03)); }
        .grace-notice-pro { border: 1px solid var(--gold-dim, rgba(201,166,88,0.35)); background: rgba(201,166,88,0.06); }
        .grace-notice-block h3 { margin: 0 0 10px; font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .grace-notice-block ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
        .grace-notice-block li { display: flex; align-items: flex-start; gap: 9px; font-size: 13.5px; }
        .grace-notice-block li svg { flex-shrink: 0; margin-top: 2px; color: var(--gold, #c9a658); }
        .grace-notice-closing { margin: 10px 0 0; font-size: 13px; color: var(--text-secondary); }
        .grace-notice-founder { color: var(--gold, #c9a658); font-weight: 600; }
        .grace-notice-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--border, rgba(255,255,255,0.08)); }
        .grace-notice-footer .btn-primary { display: inline-flex; align-items: center; text-decoration: none; }
        @media (max-width: 560px) {
          .grace-notice-footer { flex-direction: column-reverse; }
          .grace-notice-footer > * { width: 100%; justify-content: center; text-align: center; }
        }
      `}</style>
    </div>
  )
}
