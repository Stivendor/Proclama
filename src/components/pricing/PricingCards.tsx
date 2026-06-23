import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useAppStore } from '@/stores'
import { t } from '@/i18n'
import { PRICING } from '@/constants/plans'
import { formatCOP, subscribeWhatsappUrl, type BillingPeriod } from './pricingHelpers'

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
  const [period, setPeriod] = useState<BillingPeriod>('monthly')

  const freeFeatures = ['f1', 'f2', 'f3', 'f4', 'f5'].map((k) =>
    t(language, `landing.pricing.free.${k}`),
  )
  const premiumFeatures = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((k) =>
    t(language, `landing.pricing.premium.${k}`),
  )

  const price = period === 'annual' ? PRICING.annualCOP : PRICING.monthlyCOP
  const per = period === 'annual'
    ? t(language, 'landing.pricing.perYear')
    : t(language, 'landing.pricing.perMonth')

  // "Empezar prueba gratuita de 1 mes": gancho del plan mensual. En landing
  // lleva a registro (el trial se activa logueado); en app activa el trial si
  // la cuenta es elegible. Se muestra solo con el toggle en Mensual.
  const trialAction =
    props.variant === 'marketing'
      ? props.onFreeCta
      : props.trialEligible
        ? props.onStartTrial
        : undefined
  const showTrialBtn = period === 'monthly' && !!trialAction
  const showSubscribe = !(props.variant === 'app' && props.isPremium)

  return (
    <div className="pricing">
      <div className="pricing-toggle" role="group" aria-label={t(language, 'landing.pricing.period')}>
        <button
          className={period === 'monthly' ? 'active' : ''}
          onClick={() => setPeriod('monthly')}
        >
          {t(language, 'landing.pricing.monthly')}
        </button>
        <button
          className={period === 'annual' ? 'active' : ''}
          onClick={() => setPeriod('annual')}
        >
          {t(language, 'landing.pricing.annual')}
          <span className="pricing-badge">{t(language, 'landing.pricing.annualBadge')}</span>
        </button>
      </div>

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
          <span className="plan-badge plan-badge-pro">
            <Sparkles size={13} /> {t(language, 'landing.pricing.premium.trialBadge')}
          </span>
          <h3>{t(language, 'landing.pricing.premium.name')}</h3>
          <div className="plan-price">{formatCOP(price)}<span> {per}</span></div>
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
                href={subscribeWhatsappUrl(period, props.userEmail)}
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
        .pricing .pricing-toggle {
          display: flex; justify-content: center; gap: 6px; width: fit-content;
          margin: 0 auto 28px; padding: 4px; border-radius: 999px;
          background: var(--bg-surface, rgba(255,255,255,0.04));
          border: 1px solid var(--border, rgba(255,255,255,0.08));
        }
        .pricing .pricing-toggle button {
          display: flex; align-items: center; gap: 8px; padding: 8px 18px;
          border: none; background: transparent; cursor: pointer;
          border-radius: 999px; font-weight: 600; font-size: 14px;
          color: var(--text-secondary, #9aa6bb); transition: all .15s;
        }
        .pricing .pricing-toggle button.active { background: var(--gold, #c9a658); color: #1a1206; }
        .pricing .pricing-badge {
          font-size: 11px; padding: 2px 8px; border-radius: 999px;
          background: rgba(201,166,88,0.18); color: var(--gold, #c9a658);
        }
        .pricing .pricing-toggle button.active .pricing-badge { background: rgba(0,0,0,0.15); color: #1a1206; }

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
