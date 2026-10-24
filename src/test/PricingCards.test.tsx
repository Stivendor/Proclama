import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PricingCards from '@/components/pricing/PricingCards'
import { FOUNDER_PRICE_UNTIL } from '@/constants/plans'

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
  // El componente llama a currentPrice() con el reloj real y no acepta fecha por
  // props, así que sin congelar el tiempo estos tests se caen solos el día que
  // expire la promoción — probando el calendario en vez de la lógica.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(new Date(`${FOUNDER_PRICE_UNTIL}T23:59:59-05:00`).getTime() - 86_400_000))
  })
  afterEach(() => vi.useRealTimers())

  it('muestra el precio con descuento y el de lista tachado', () => {
    render(<PricingCards variant="marketing" onFreeCta={vi.fn()} />)

    // El precio que se cobra lleva la moneda; el tachado no, para no repetirla.
    expect(screen.getByText(/\$99\.000 COP/)).toBeInTheDocument()
    expect(screen.getByText('$199.000')).toBeInTheDocument()
    expect(screen.getByText(/precio fundador/i)).toBeInTheDocument()
  })

  // Quien ya es premium tiene el precio asegurado (sea el fundador o el de
  // lista; no hay tabla de pagos que los distinga). Ofrecerle "precio fundador
  // hasta el 31-dic" es invitarlo a comprar algo que ya compró.
  it('a quien ya es premium no se le vuelve a ofrecer la oferta', () => {
    render(<PricingCards variant="app" isPremium />)

    expect(document.querySelector('.plan-badge-pro')).toBeNull()
    expect(screen.queryByText('$199.000')).not.toBeInTheDocument()
    // Sin fecha: su precio ya está congelado y el 31-dic no le aplica.
    expect(screen.queryByText(/31 de dic/i)).not.toBeInTheDocument()
    // Y en su lugar, la confirmación de que lo que tiene sigue congelado.
    expect(screen.getByText(/congelado de por vida mientras renueves/i)).toBeInTheDocument()
  })

  it('a quien todavía no es premium sí se le ofrece, con precio y fecha', () => {
    render(<PricingCards variant="app" isPremium={false} trialEligible={false} />)

    expect(document.querySelector('.plan-badge-pro')).toBeInTheDocument()
    expect(screen.getByText(/\$99\.000 COP/)).toBeInTheDocument()
    expect(screen.getByText('$199.000')).toBeInTheDocument()
    expect(screen.getByText(/31 de dic/i)).toBeInTheDocument()
  })

  it('la tarjeta Pro nombra cada función que el plan bloquea', () => {
    render(<PricingCards variant="marketing" onFreeCta={vi.fn()} />)

    // Un gate en usePlan() sin renglón acá es algo que se cobra sin anunciarlo.
    const pro = document.querySelector('.plan-pro')?.textContent ?? ''
    for (const gate of [
      /colaboradores/i,      // canInviteCollaborators
      /ilimitadas/i,         // canCreateSong
      /sincronizaci/i,       // canSync
      /fondos/i,             // canUseMediaBackgrounds
      /reportes pdf/i,       // canExportReports
      /estad/i,              // canViewStats
      /biblia/i,             // canImportBibles
      /letras online/i,      // canUseOnlineSearch
    ]) {
      expect(pro).toMatch(gate)
    }
  })

  // El mensual es una equivalencia para poder pensar el precio, no un plan: el
  // cobro es una transferencia anual, y quien lo lea como cuota mensual se va a
  // sentir engañado el día que le pidan los $99.000 completos.
  it('muestra el equivalente mensual sin ofrecer un plan mensual', () => {
    render(<PricingCards variant="marketing" onFreeCta={vi.fn()} />)

    const pro = document.querySelector('.plan-pro')?.textContent ?? ''
    expect(pro).toMatch(/\$8\.250 al mes/)
    expect(pro).toMatch(/un solo pago al año/i)

    // El anual sigue siendo el precio, no un adorno.
    expect(screen.getByText('/año')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mensual/i })).not.toBeInTheDocument()
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
