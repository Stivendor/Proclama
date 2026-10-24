import {
  WHATSAPP_NUMBER,
  PRICING,
  FOUNDER_PRICE_UNTIL,
  GRACE_NOTICE_MAX_DAYS,
  GRACE_EXPIRY_ISO,
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

/**
 * Último día con precio fundador, fin del día en hora de Colombia.
 *
 * Es la escasez real del producto y hasta ahora no aparecía en ningún sitio:
 * el aviso de gracia nombraba el día en que la cuenta cae a Gratis (11-nov) y
 * callaba éste (31-dic), que es el que de verdad obliga a decidir.
 */
export function founderDeadline(): Date {
  return new Date(`${FOUNDER_PRICE_UNTIL}T23:59:59-05:00`)
}

/**
 * Cuánto se ahorra el precio fundador respecto al de lista. 0 sin promoción.
 *
 * Se calcula y no se escribe a mano: si cambia `PRICING`, el aviso del ahorro
 * le sigue cuadrando al cliente en vez de prometer un número viejo.
 */
export function founderSavings(now: Date = new Date()): number {
  const { amount, strikethrough } = currentPrice(now)
  return strikethrough ? strikethrough - amount : 0
}

/**
 * ¿Hay que ofrecerle el precio fundador a esta cuenta?
 *
 * La promoción de $99.000 aplica a cuentas viejas y nuevas: no es un regalo de
 * la fase fundadores, es la puerta de entrada, así que el banner es para todo
 * el que todavía no lo tiene. Se excluye a tres casos:
 *
 *  - `founding`: vitalicio, ya tiene todo gratis para siempre.
 *  - `paid` sin fecha: vitalicio igual, sólo que concedido aparte.
 *  - `paid` con fecha distinta a la de la gracia: ya transfirió. A ese ya se le
 *    ofreció y aceptó; volver a ofrecerle es confuso.
 *
 * Las cuentas en gracia SÍ ven la oferta: su fecha es exactamente la de la
 * gracia, y siguen sin haber pagado nada.
 */
export function founderOfferVisible(args: {
  plan: string | null | undefined
  premiumExpiresAt: string | number | null | undefined
}): boolean {
  if (args.plan === 'founding') return false

  if (args.plan === 'paid') {
    if (!args.premiumExpiresAt) return false
    if (new Date(args.premiumExpiresAt).getTime() !== new Date(GRACE_EXPIRY_ISO).getTime()) {
      return false
    }
  }

  return true
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
 * fecha. Ese 'paid' es el mismo que tiene el cliente que ya pagó, así que el
 * criterio no es sólo "premium con caducidad cercana" sino "premium con la
 * fecha exacta de la gracia" — ver GRACE_EXPIRY_ISO. Todo lo demás queda fuera.
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

  // Huella por fecha exacta. 'paid' es el plan tanto de quien está en gracia
  // como de quien ya transfirió, y no hay tabla de pagos que los separe: sólo
  // comparten el instante. Cualquier otra fecha dentro de la ventana de días
  // es alguien que ya pagó, y a ese no se le vuelve a ofrecer el precio
  // fundador — ya lo tiene asegurado de por vida.
  // Se comparan milisegundos y no strings: Postgres devuelve '+00:00' y la
  // constante va con 'Z', que son el mismo instante.
  if (new Date(args.premiumExpiresAt).getTime() !== new Date(GRACE_EXPIRY_ISO).getTime()) {
    return null
  }

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
