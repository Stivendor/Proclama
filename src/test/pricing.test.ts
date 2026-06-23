import { describe, it, expect } from 'vitest'
import {
  formatCOP,
  subscribeWhatsappUrl,
  isTrialEligible,
} from '@/components/pricing/pricingHelpers'

describe('formatCOP', () => {
  it('formatea con separador de miles es-CO', () => {
    expect(formatCOP(19900)).toBe('$19.900')
    expect(formatCOP(199000)).toBe('$199.000')
  })
})

describe('subscribeWhatsappUrl', () => {
  it('incluye número, plan y correo cuando hay email', () => {
    const url = subscribeWhatsappUrl('annual', 'a@b.com')
    expect(url.startsWith('https://wa.me/573044762051?text=')).toBe(true)
    const text = decodeURIComponent(url.split('text=')[1])
    expect(text).toContain('plan Anual')
    expect(text).toContain('a@b.com')
    expect(text).toContain('Mi correo de la cuenta es a@b.com.')
    expect(text).toContain('¿Cómo hago el pago?')
  })

  it('omite la frase del correo cuando no hay email', () => {
    const text = decodeURIComponent(subscribeWhatsappUrl('monthly').split('text=')[1])
    expect(text).toContain('plan Mensual')
    expect(text).not.toContain('correo')
  })
})

describe('isTrialEligible', () => {
  it('elegible sólo si no es premium y nunca usó trial', () => {
    expect(isTrialEligible({ isPremium: false, trialStartedAt: null })).toBe(true)
    expect(isTrialEligible({ isPremium: true, trialStartedAt: null })).toBe(false)
    expect(isTrialEligible({ isPremium: false, trialStartedAt: '2026-01-01' })).toBe(false)
  })
})
