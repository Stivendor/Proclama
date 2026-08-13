import {
  WHATSAPP_NUMBER,
  PRICING,
  FOUNDER_PRICE_UNTIL,
  GRACE_NOTICE_MAX_DAYS,
} from '@/constants/plans'

const DAY_MS = 86_400_000

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

/**
 * Lo que sale al mes un plan anual. Es una equivalencia para que el precio se
 * pueda pensar, NO un plan: no hay cobro mensual, y quien lo lea como tal se
 * va a sentir engañado el día de la transferencia. Siempre acompañado de
 * "en un solo pago al año".
 *
 * Redondeo al peso: 12 × 8.250 da los 99.000 exactos, así que a quien haga la
 * cuenta le cuadra.
 */
export function monthlyEquivalent(annual: number): number {
  return Math.round(annual / 12)
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

/** Días completos que faltan para `iso`, redondeando hacia arriba. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY_MS)
}

export type GraceStatus = {
  daysLeft: number
  /** Medianoche en que la cuenta cae a Gratis. */
  expiry: Date
  /** Último día completo con Pro: el anterior al vencimiento. */
  lastFullDay: Date
}

/**
 * ¿Esta cuenta está en el periodo de gracia de fin de fase fundadores?
 *
 * Fuente única para el banner del sidebar y para el modal: si divergieran, uno
 * anunciaría un vencimiento que el otro no reconoce.
 *
 * El grandfathering (supabase/manual/phase6_grandfather_before_paywall.sql) deja
 * a cada cuenta existente en `plan='paid'` con fecha, y a las vitalicias sin
 * fecha. Todo lo que no sea "premium con caducidad cercana" queda fuera.
 */
export function graceStatus(args: {
  plan: string | null | undefined
  role: string | null | undefined
  premiumExpiresAt: string | null | undefined
  now?: Date
}): GraceStatus | null {
  const now = args.now ?? new Date()

  // Los admin no pierden nada: isPremiumByPlan() y public.is_premium() los eximen
  // por rol, pero el script sí los mueve a 'paid' si no están en la lista de
  // correos vitalicios. Sin este descarte les llegaría un aviso falso.
  if (args.role === 'admin') return null

  if (args.plan !== 'paid') return null

  // Vitalicio: premium sin caducidad. No hay nada que anunciarle.
  if (!args.premiumExpiresAt) return null

  const daysLeft = daysUntil(args.premiumExpiresAt, now)
  if (daysLeft <= 0) return null
  if (daysLeft > GRACE_NOTICE_MAX_DAYS) return null

  const expiry = new Date(args.premiumExpiresAt)
  return {
    daysLeft,
    expiry,
    lastFullDay: new Date(expiry.getTime() - DAY_MS),
  }
}
