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
    </div>
  )
}
