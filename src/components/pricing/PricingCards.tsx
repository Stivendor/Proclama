import { Check, Sparkles } from 'lucide-react'
import { useAppStore } from '@/stores'
import { t } from '@/i18n'
import { formatCOP, subscribeWhatsappUrl, currentPrice, monthlyEquivalent, founderDeadline } from './pricingHelpers'

interface PricingCardsProps {
  variant: 'marketing' | 'app'
  isPremium?: boolean
  trialEligible?: boolean
  onStartTrial?: () => void
  startingTrial?: boolean
  onFreeCta?: () => void
  userEmail?: string
}

export default function PricingCards(props: PricingCardsProps) {
  const language = useAppStore((s) => s.language)

  const freeFeatures = ['f1', 'f2', 'f3', 'f4', 'f5'].map((k) =>
    t(language, `landing.pricing.free.${k}`),
  )
  // Cada gate de usePlan() tiene que estar en esta lista, o se vende algo que
  // el usuario no sabe que compra: canCreateSong (f1), canUseOnlineSearch (f7),
  // canInviteCollaborators (f2), canSync (f3), canUseMediaBackgrounds (f4),
  // canExportReports + canViewStats (f5), canImportBibles (f6).
  // El orden del array manda, no el numero de la clave: f7 va junto a f1 porque
  // las dos hablan de llenar la biblioteca.
  const premiumFeatures = ['f1', 'f7', 'f2', 'f3', 'f4', 'f5', 'f6'].map((k) =>
    t(language, `landing.pricing.premium.${k}`),
  )

  const { amount: price, strikethrough } = currentPrice()
  const per = t(language, 'landing.pricing.perYear')
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const founderDeadlineShort = founderDeadline().toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })

  // La oferta sólo se ofrece a quien todavía puede comprarla. En la tarjeta de
  // Ajustes, un premium ya tiene el precio asegurado — sea el fundador o el de
  // lista — y enseñarle "precio fundador hasta el 31-dic" es invitarlo a comprar
  // algo que ya compró. La landing no cambia: ahí nadie está logueado pagando.
  // No se puede distinguir al fundador del que pagó de lista (no hay tabla de
  // pagos), por eso el criterio es "es premium" y no "es fundador": en ambos
  // casos dejar de vender es lo correcto.
  const showFounderOffer = !!strikethrough && !(props.variant === 'app' && props.isPremium)

  // "Empezar prueba gratuita de 1 mes". En landing lleva a registro (el trial se
  // activa logueado); en app activa el trial sólo si la cuenta es elegible.
  const trialAction =
    props.variant === 'marketing'
      ? props.onFreeCta
      : props.trialEligible
        ? props.onStartTrial
        : undefined
  const showTrialBtn = !!trialAction
  const showSubscribe = !(props.variant === 'app' && props.isPremium)

  return (
    <div className="pricing">
      <div className="plans-grid">
        {/* Free */}
        <div className="plan-card">
          <h3>{t(language, 'landing.pricing.free.name')}</h3>
          <div className="plan-price">{t(language, 'landing.pricing.free.price')}</div>
          <p className="plan-tagline">{t(language, 'landing.pricing.free.tagline')}</p>
          <ul>
            {freeFeatures.map((f, i) => (
              <li key={i}><Check size={16} /> {f}</li>
            ))}
          </ul>
          {props.variant === 'marketing' ? (
            <button className="plan-btn-outline" onClick={props.onFreeCta}>
              {t(language, 'landing.pricing.free.cta')}
            </button>
          ) : (
            !props.isPremium && <div className="plan-current">{t(language, 'settings.plan.currentFree')}</div>
          )}
        </div>

        {/* Premium */}
        <div className="plan-card plan-pro">
          {/* Un solo distintivo: el precio fundador manda sobre el gancho del
              trial, y el del trial no se muestra a quien ya no puede usarlo. */}
          {showFounderOffer ? (
            <span className="plan-badge plan-badge-pro">
              <Sparkles size={13} /> {t(language, 'landing.pricing.premium.founderBadge')}
            </span>
          ) : showTrialBtn ? (
            <span className="plan-badge plan-badge-pro">
              <Sparkles size={13} /> {t(language, 'landing.pricing.premium.trialBadge')}
            </span>
          ) : null}
          <h3>{t(language, 'landing.pricing.premium.name')}</h3>
          <div className="plan-price">
            {showFounderOffer && <s className="plan-price-was">{formatCOP(strikethrough)}</s>}
            {formatCOP(price, true)}<span> {per}</span>
          </div>
          {/* El anual manda y esto va debajo y en pequeño: es una equivalencia
              para poder pensar el precio, no un plan mensual — no existe. */}
          <p className="plan-monthly-note">
            {t(language, 'landing.pricing.perMonthNote', {
              price: formatCOP(monthlyEquivalent(price)),
            })}
          </p>
          {showFounderOffer && (
            <p className="plan-founder-note">
              {t(language, 'landing.pricing.premium.founderNote', { date: founderDeadlineShort })}
            </p>
          )}
          {/* Quien ya es premium no recibe la oferta: recibe la confirmación de
              que lo que ya tiene sigue congelado. Sin fecha, porque su precio
              ya está asegurado y el 31-dic no le aplica. */}
          {strikethrough && props.variant === 'app' && props.isPremium && (
            <p className="plan-founder-note">
              {t(language, 'landing.pricing.premium.founderMineNote')}
            </p>
          )}
          <p className="plan-tagline">{t(language, 'landing.pricing.premium.tagline')}</p>
          <ul>
            {premiumFeatures.map((f, i) => (
              <li key={i}><Check size={16} /> {f}</li>
            ))}
          </ul>
          <div className="plan-actions">
            {showTrialBtn && (
              <button className="plan-btn-primary" onClick={trialAction} disabled={props.startingTrial}>
                {props.startingTrial
                  ? t(language, 'settings.plan.starting')
                  : t(language, 'landing.pricing.premium.ctaTrial')}
              </button>
            )}
            {showSubscribe && (
              <a
                className={showTrialBtn ? 'plan-btn-outline' : 'plan-btn-primary'}
                href={subscribeWhatsappUrl(props.userEmail)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t(language, 'landing.pricing.premium.ctaSubscribe')}
              </a>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .pricing { width: 100%; max-width: 920px; margin: 0 auto; }
        .pricing .plans-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 720px) { .pricing .plans-grid { grid-template-columns: 1fr; } }

        .pricing .plan-card {
          position: relative; display: flex; flex-direction: column;
          padding: 28px 24px; border-radius: 18px;
          background: var(--bg-elevated, #11151c);
          border: 1px solid var(--border, rgba(255,255,255,0.08));
        }
        .pricing .plan-pro {
          border-color: var(--gold-dim, rgba(201,166,88,0.4));
          box-shadow: 0 8px 30px rgba(201,166,88,0.08);
        }
        .pricing .plan-badge-pro {
          position: absolute; top: -12px; left: 24px;
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 999px;
          background: var(--gold, #c9a658); color: #1a1206;
          font-size: 12px; font-weight: 700;
        }
        .pricing .plan-card h3 { margin: 6px 0 4px; font-size: 22px; color: var(--text-primary, #e7edf8); }
        .pricing .plan-price { font-size: 30px; font-weight: 800; color: var(--text-primary, #fff); }
        .pricing .plan-price span { font-size: 15px; font-weight: 400; color: var(--text-secondary, #9aa6bb); }
        .pricing .plan-price-was {
          margin-right: 10px; font-size: 19px; font-weight: 600;
          color: var(--text-secondary, #9aa6bb); opacity: .65;
        }
        .pricing .plan-monthly-note {
          margin: 6px 0 0; font-size: 12.5px;
          color: var(--text-secondary, #9aa6bb);
        }
        .pricing .plan-founder-note {
          margin: 6px 0 0; font-size: 12.5px; font-weight: 600;
          color: var(--gold, #c9a658);
        }
        .pricing .plan-tagline { margin: 6px 0 18px; font-size: 14px; color: var(--text-secondary, #9aa6bb); }
        .pricing .plan-card ul { flex: 1; list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .pricing .plan-card li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 1.4; color: var(--text-primary, #d8deea); }
        .pricing .plan-card li svg { flex-shrink: 0; margin-top: 2px; color: var(--gold, #c9a658); }

        .pricing .plan-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
        .pricing .plan-btn-primary {
          padding: 13px; border: none; border-radius: 12px; cursor: pointer;
          font-size: 15px; font-weight: 700; text-align: center;
          background: var(--gold, #c9a658); color: #1a1206; transition: opacity .15s;
        }
        .pricing .plan-btn-primary:hover { opacity: .92; }
        .pricing .plan-btn-primary:disabled { opacity: .6; cursor: default; }
        .pricing .plan-btn-outline {
          display: block; padding: 13px; border-radius: 12px; cursor: pointer;
          font-weight: 600; text-align: center; text-decoration: none;
          color: var(--text-primary, #e7edf8);
          border: 1px solid var(--border, rgba(255,255,255,0.16)); transition: all .15s;
        }
        .pricing .plan-btn-outline:hover { border-color: var(--gold-dim, rgba(201,166,88,0.5)); }
        .pricing .plan-current { margin-top: 16px; font-size: 13px; color: var(--text-secondary, #9aa6bb); }
      `}</style>
    </div>
  )
}
