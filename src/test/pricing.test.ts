import { describe, it, expect } from 'vitest'
import {
  formatCOP,
  subscribeWhatsappUrl,
  isTrialEligible,
  isFounderPriceActive,
  currentPrice,
  founderDeadline,
  founderSavings,
  graceStatus,
  daysUntil,
  monthlyEquivalent,
} from '@/components/pricing/pricingHelpers'
import {
  PRICING,
  FOUNDER_PRICE_UNTIL,
  GRACE_NOTICE_MAX_DAYS,
  GRACE_EXPIRY_ISO,
} from '@/constants/plans'

// Derivadas de la constante, nunca escritas a mano: la fecha de la promoción se
// mueve (ya se movió una vez) y unas fechas quemadas dejan estos tests en rojo
// sin que nada esté realmente mal.
const FIN_PROMO = new Date(`${FOUNDER_PRICE_UNTIL}T23:59:59-05:00`)
const DURANTE = new Date(FIN_PROMO.getTime() - 86_400_000)
const DESPUES = new Date(FIN_PROMO.getTime() + 86_400_000)

describe('formatCOP', () => {
  it('formatea con separador de miles es-CO', () => {
    expect(formatCOP(19900)).toBe('$19.900')
    expect(formatCOP(199000)).toBe('$199.000')
  })

  it('marca la moneda cuando se pide, para que no se lea como dólares', () => {
    expect(formatCOP(99000, true)).toBe('$99.000 COP')
  })
})

describe('subscribeWhatsappUrl', () => {
  it('incluye número, precio y correo cuando hay email', () => {
    const url = subscribeWhatsappUrl('a@b.com')
    expect(url.startsWith('https://wa.me/573044762051?text=')).toBe(true)
    const text = decodeURIComponent(url.split('text=')[1])
    expect(text).toContain('al año')
    expect(text).toContain('Mi correo de la cuenta es a@b.com.')
    expect(text).toContain('¿Cómo hago el pago?')
  })

  it('omite la frase del correo cuando no hay email', () => {
    const text = decodeURIComponent(subscribeWhatsappUrl().split('text=')[1])
    expect(text).toContain('al año')
    expect(text).not.toContain('correo')
  })
})

describe('precio fundador', () => {
  it('cuesta la mitad durante la promoción y muestra el precio tachado', () => {
    expect(currentPrice(DURANTE)).toEqual({
      amount: PRICING.founderAnnualCOP,
      strikethrough: PRICING.annualCOP,
    })
  })

  it('vuelve a precio de lista cuando la promoción termina', () => {
    expect(currentPrice(DESPUES)).toEqual({
      amount: PRICING.annualCOP,
      strikethrough: null,
    })
  })

  it('el último día de la promoción todavía cuenta', () => {
    expect(isFounderPriceActive(new Date(`${FOUNDER_PRICE_UNTIL}T23:59:00-05:00`))).toBe(true)
    expect(isFounderPriceActive(new Date(`${FOUNDER_PRICE_UNTIL}T23:59:59-05:00`))).toBe(true)
  })

  it('al día siguiente ya no', () => {
    expect(isFounderPriceActive(DESPUES)).toBe(false)
  })

  // El aviso nombra la fecha y el ahorro: si alguno de los dos se escribiera a
  // mano, el día que se mueva la promoción quedaría mintiendo en el modal.
  it('el deadline del fundador es el fin del día, en hora de Colombia', () => {
    expect(founderDeadline().toISOString()).toBe(
      new Date(`${FOUNDER_PRICE_UNTIL}T23:59:59-05:00`).toISOString(),
    )
  })

  it('el ahorro es la diferencia contra el precio de lista, y 0 sin promoción', () => {
    expect(founderSavings(DURANTE)).toBe(PRICING.annualCOP - PRICING.founderAnnualCOP)
    expect(founderSavings(DESPUES)).toBe(0)
  })

  // Si 12 × mensual no da el anual, alguien que haga la cuenta ve un número que
  // no cuadra justo en el momento de decidir si paga.
  it('la equivalencia mensual multiplicada por 12 devuelve el anual', () => {
    expect(monthlyEquivalent(PRICING.founderAnnualCOP)).toBe(8250)
    expect(monthlyEquivalent(PRICING.founderAnnualCOP) * 12).toBe(PRICING.founderAnnualCOP)
    expect(Math.abs(monthlyEquivalent(PRICING.annualCOP) * 12 - PRICING.annualCOP)).toBeLessThan(12)
  })

  it('el fundador ronda la mitad del precio de lista', () => {
    const ratio = PRICING.founderAnnualCOP / PRICING.annualCOP
    expect(ratio).toBeGreaterThan(0.45)
    expect(ratio).toBeLessThan(0.55)
  })

  it('el mensaje de WhatsApp lleva el precio real, no solo el nombre del plan', () => {
    const texto = decodeURIComponent(
      subscribeWhatsappUrl('iglesia@ejemplo.com', DURANTE).split('text=')[1],
    )
    expect(texto).toContain('$99.000 COP al año')
    expect(texto).toContain('precio fundador')
    expect(texto).toContain('$199.000')
  })

  it('pasada la promoción el mensaje cotiza el precio de lista', () => {
    const texto = decodeURIComponent(
      subscribeWhatsappUrl(undefined, DESPUES).split('text=')[1],
    )
    expect(texto).toContain('$199.000 COP al año')
    expect(texto).not.toContain('fundador')
  })
})

describe('graceStatus', () => {
  const AHORA = new Date('2026-08-13T12:00:00-05:00')
  /** Fecha de vencimiento a `d` días de AHORA. */
  const en = (d: number) => new Date(AHORA.getTime() + d * 86_400_000).toISOString()
  const base = { plan: 'paid', role: 'user', now: AHORA }

  it('reconoce a quien está en la gracia y cuenta los días', () => {
    // La huella: sólo el vencimiento exacto que repartió el script es gracia.
    // Con el `now` de este bloque quedan 91 días, que es lo que el script puso
    // (corrió el 13-ago con +91 para cerrar a medianoche de Colombia).
    expect(graceStatus({ ...base, premiumExpiresAt: GRACE_EXPIRY_ISO })?.daysLeft).toBe(91)
  })

  // La gracia vence a las 00:00 del día siguiente al último día con Pro: si no
  // se distinguen, el aviso promete un día de más.
  it('el último día completo es el anterior al vencimiento', () => {
    const s = graceStatus({ ...base, premiumExpiresAt: GRACE_EXPIRY_ISO })
    expect(s?.expiry.toISOString()).toBe(GRACE_EXPIRY_ISO)
    expect(s?.lastFullDay.toISOString()).toBe('2026-11-11T05:00:00.000Z')
  })

  // Los vitalicios: el script los deja en 'founding' sin fecha, y la cuenta que
  // quedó en 'paid' sin fecha por un cambio de plan de prueba también es de por
  // vida. Ninguno pierde nada, así que anunciarles un vencimiento sería mentir.
  it('deja fuera a los vitalicios, con y sin plan founding', () => {
    expect(graceStatus({ ...base, plan: 'founding', premiumExpiresAt: null })).toBeNull()
    expect(graceStatus({ ...base, premiumExpiresAt: null })).toBeNull()
  })

  // El script mueve a 'paid' a cualquier admin que no esté en la lista de correos
  // vitalicios, pero isPremiumByPlan() y public.is_premium() lo eximen por rol.
  it('deja fuera a los admin', () => {
    expect(graceStatus({ ...base, role: 'admin', premiumExpiresAt: en(90) })).toBeNull()
  })

  it('deja fuera a trial y free', () => {
    expect(graceStatus({ ...base, plan: 'trial', premiumExpiresAt: en(20) })).toBeNull()
    expect(graceStatus({ ...base, plan: 'free', premiumExpiresAt: null })).toBeNull()
  })

  // El caso que justifica el tope: quien paga queda igual que quien está en la
  // gracia — 'paid' con fecha — y sin el tope vería el banner de despedida.
  it('deja fuera a quien ya pagó el año', () => {
    expect(graceStatus({ ...base, premiumExpiresAt: en(365) })).toBeNull()
    expect(graceStatus({ ...base, premiumExpiresAt: en(GRACE_NOTICE_MAX_DAYS + 1) })).toBeNull()
  })

  // Y el caso que justifica la huella: estar a punto de vencer NO basta. Es el
  // cliente que ya transfirió el precio fundador — su vencimiento es pago +
  // 365 días con hora del día — y al que, sin la huella, le saldría el aviso
  // pidiéndole asegurar un precio que ya tiene congelado de por vida.
  it('deja fuera a quien está a punto de vencer pero no tiene la fecha de la gracia', () => {
    expect(graceStatus({ ...base, premiumExpiresAt: en(GRACE_NOTICE_MAX_DAYS) })).toBeNull()
    expect(graceStatus({ ...base, premiumExpiresAt: en(30) })).toBeNull()
    expect(graceStatus({ ...base, premiumExpiresAt: GRACE_EXPIRY_ISO })).not.toBeNull()
  })

  // Postgres devuelve '+00:00' y la constante va con 'Z': son el mismo instante
  // y la comparación tiene que aguantar las dos grafías.
  it('reconoce la huella escrita con +00:00 en vez de Z', () => {
    expect(graceStatus({ ...base, premiumExpiresAt: '2026-11-12T05:00:00+00:00' })).not.toBeNull()
  })

  it('calla cuando la gracia ya venció', () => {
    expect(graceStatus({ ...base, premiumExpiresAt: en(-1) })).toBeNull()
    expect(graceStatus({ ...base, premiumExpiresAt: AHORA.toISOString() })).toBeNull()
  })

  it('daysUntil redondea hacia arriba: media hora sigue siendo un día', () => {
    expect(daysUntil(new Date(AHORA.getTime() + 1_800_000).toISOString(), AHORA)).toBe(1)
    expect(daysUntil(en(90), AHORA)).toBe(90)
  })
})

describe('isTrialEligible', () => {
  it('elegible sólo si no es premium y nunca usó trial', () => {
    expect(isTrialEligible({ isPremium: false, trialStartedAt: null })).toBe(true)
    expect(isTrialEligible({ isPremium: true, trialStartedAt: null })).toBe(false)
    expect(isTrialEligible({ isPremium: false, trialStartedAt: '2026-01-01' })).toBe(false)
  })
})
