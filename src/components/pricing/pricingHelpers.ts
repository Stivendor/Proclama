import { WHATSAPP_NUMBER, PRICING, FOUNDER_PRICE_UNTIL } from '@/constants/plans'

/**
 * Formatea en pesos colombianos.
 *
 * `withCurrency` agrega el sufijo "COP". Va sólo en el precio que se cobra, no
 * en el tachado ni en repeticiones: sin él, "$99.000" a secas se puede leer como
 * dólares, y más en la versión en inglés de la landing.
 */
export function formatCOP(n: number, withCurrency = false): string {
  const amount = '$' + new Intl.NumberFormat('es-CO').format(n)
  return withCurrency ? `${amount} COP` : amount
}

/** ¿Sigue vigente el precio fundador? Inclusive el último día. */
export function isFounderPriceActive(now: Date = new Date()): boolean {
  return now <= new Date(`${FOUNDER_PRICE_UNTIL}T23:59:59-05:00`)
}

/** Precio anual a cobrar y, si hay promoción, el de lista que se tacha al lado. */
export function currentPrice(now: Date = new Date()): {
  amount: number
  strikethrough: number | null
} {
  if (isFounderPriceActive(now)) {
    return { amount: PRICING.founderAnnualCOP, strikethrough: PRICING.annualCOP }
  }
  return { amount: PRICING.annualCOP, strikethrough: null }
}

export function subscribeWhatsappUrl(email?: string, now: Date = new Date()): string {
  const { amount, strikethrough } = currentPrice(now)
  const priceLabel = strikethrough
    ? `${formatCOP(amount, true)} al año (precio fundador, en vez de ${formatCOP(strikethrough)})`
    : `${formatCOP(amount, true)} al año`
  const emailPart = email ? ` Mi correo de la cuenta es ${email}.` : ''
  const msg = `¡Hola! 👋 Quiero suscribirme a Proclama Pro — ${priceLabel}.${emailPart} ¿Cómo hago el pago?`
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
}

export function isTrialEligible(args: { isPremium: boolean; trialStartedAt: string | null }): boolean {
  return !args.isPremium && args.trialStartedAt == null
}
