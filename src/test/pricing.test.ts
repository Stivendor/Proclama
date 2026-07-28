import { describe, it, expect } from 'vitest'
import {
  formatCOP,
  subscribeWhatsappUrl,
  isTrialEligible,
  isFounderPriceActive,
  currentPrice,
} from '@/components/pricing/pricingHelpers'
import { PRICING, FOUNDER_PRICE_UNTIL } from '@/constants/plans'

const DURANTE = new Date('2026-08-15T12:00:00-05:00')
const DESPUES = new Date('2026-10-15T12:00:00-05:00')

describe('formatCOP', () => {
  it('formatea con separador de miles es-CO', () => {
    expect(formatCOP(19900)).toBe('$19.900')
    expect(formatCOP(199000)).toBe('$199.000')
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
    expect(isFounderPriceActive(new Date('2026-10-01T00:00:01-05:00'))).toBe(false)
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
    expect(texto).toContain('$99.000 al año')
    expect(texto).toContain('precio fundador')
    expect(texto).toContain('$199.000')
  })

  it('pasada la promoción el mensaje cotiza el precio de lista', () => {
    const texto = decodeURIComponent(
      subscribeWhatsappUrl(undefined, DESPUES).split('text=')[1],
    )
    expect(texto).toContain('$199.000 al año')
    expect(texto).not.toContain('fundador')
  })
})

describe('isTrialEligible', () => {
  it('elegible sólo si no es premium y nunca usó trial', () => {
    expect(isTrialEligible({ isPremium: false, trialStartedAt: null })).toBe(true)
    expect(isTrialEligible({ isPremium: true, trialStartedAt: null })).toBe(false)
    expect(isTrialEligible({ isPremium: false, trialStartedAt: '2026-01-01' })).toBe(false)
  })
})
