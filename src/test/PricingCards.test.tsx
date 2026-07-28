import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PricingCards from '@/components/pricing/PricingCards'

/**
 * El botón de prueba y el distintivo del plan Pro son inalcanzables mientras
 * FOUNDING_PHASE esté en true (el flag fuerza isPremium y mata la elegibilidad),
 * así que en producción nunca se han visto. Estos tests son la única red que
 * cubre ese estado antes de activar el paywall.
 */

vi.mock('@/stores', () => ({
  useAppStore: (selector: (s: { language: string }) => unknown) => selector({ language: 'es' }),
}))

const TRIAL_CTA = /empezar prueba gratuita/i
const TRIAL_BADGE = /prueba 1 mes gratis/i
const SUBSCRIBE_CTA = /suscribirme/i

describe('PricingCards — botón de prueba', () => {
  it('se muestra a quien es elegible', () => {
    render(<PricingCards variant="app" isPremium={false} trialEligible onStartTrial={vi.fn()} />)

    expect(screen.getByText(TRIAL_CTA)).toBeInTheDocument()
  })

  it('dispara onStartTrial al hacer clic', () => {
    const onStartTrial = vi.fn()
    render(<PricingCards variant="app" isPremium={false} trialEligible onStartTrial={onStartTrial} />)

    fireEvent.click(screen.getByText(TRIAL_CTA))
    expect(onStartTrial).toHaveBeenCalledOnce()
  })

  it('queda deshabilitado mientras la prueba se está activando', () => {
    render(
      <PricingCards variant="app" isPremium={false} trialEligible onStartTrial={vi.fn()} startingTrial />,
    )
    const btn = screen.getByRole('button', { name: /activando|empezar prueba/i })
    expect(btn).toBeDisabled()
  })

  it('NO se muestra a quien ya usó la prueba', () => {
    render(<PricingCards variant="app" isPremium={false} trialEligible={false} onStartTrial={vi.fn()} />)

    expect(screen.queryByText(TRIAL_CTA)).not.toBeInTheDocument()
    // Y tampoco el distintivo que la ofrece.
    expect(screen.queryByText(TRIAL_BADGE)).not.toBeInTheDocument()
  })

  it('NO se muestra a quien ya es premium, y ese usuario tampoco ve "Suscribirme"', () => {
    render(<PricingCards variant="app" isPremium trialEligible={false} />)

    expect(screen.queryByText(TRIAL_CTA)).not.toBeInTheDocument()
    expect(screen.queryByText(SUBSCRIBE_CTA)).not.toBeInTheDocument()
  })

  it('en la landing el botón lleva a registro, no a la RPC', () => {
    const onFreeCta = vi.fn()
    const onStartTrial = vi.fn()
    render(<PricingCards variant="marketing" onFreeCta={onFreeCta} onStartTrial={onStartTrial} />)

    fireEvent.click(screen.getByText(TRIAL_CTA))
    expect(onFreeCta).toHaveBeenCalledOnce()
    expect(onStartTrial).not.toHaveBeenCalled()
  })
})

describe('PricingCards — precio fundador', () => {
  it('muestra el precio con descuento y el de lista tachado', () => {
    render(<PricingCards variant="marketing" onFreeCta={vi.fn()} />)

    // El precio que se cobra lleva la moneda; el tachado no, para no repetirla.
    expect(screen.getByText(/\$99\.000 COP/)).toBeInTheDocument()
    expect(screen.getByText('$199.000')).toBeInTheDocument()
    expect(screen.getByText(/precio fundador/i)).toBeInTheDocument()
  })

  it('no ofrece plan mensual: sólo hay un precio', () => {
    render(<PricingCards variant="marketing" onFreeCta={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /mensual/i })).not.toBeInTheDocument()
    expect(screen.getByText('/año')).toBeInTheDocument()
    expect(screen.queryByText('/mes')).not.toBeInTheDocument()
  })

  it('el enlace de WhatsApp cotiza el precio fundador', () => {
    render(<PricingCards variant="marketing" onFreeCta={vi.fn()} userEmail="iglesia@ejemplo.com" />)

    const link = screen.getByText(SUBSCRIBE_CTA).closest('a')
    const texto = decodeURIComponent(link?.getAttribute('href') ?? '')
    expect(texto).toContain('$99.000 COP al año')
    expect(texto).toContain('iglesia@ejemplo.com')
  })
})
