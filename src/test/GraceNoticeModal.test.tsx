import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GraceNoticeModal from '@/components/pricing/GraceNoticeModal'
import { FOUNDER_PRICE_UNTIL } from '@/constants/plans'

vi.mock('@/stores', () => ({
  useAppStore: (selector: (s: { language: string }) => unknown) => selector({ language: 'es' }),
}))

/**
 * El aviso cotiza el precio fundador, que caduca. Sin congelar el reloj estos
 * tests dejarían de probar el caso que importa el día que pase la promoción.
 */
const DURANTE = new Date(new Date(`${FOUNDER_PRICE_UNTIL}T23:59:59-05:00`).getTime() - 86_400_000)
const en = (dias: number) => new Date(DURANTE.getTime() + dias * 86_400_000)

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(DURANTE)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GraceNoticeModal', () => {
  it('nombra las siete funciones Pro que el usuario está a punto de perder', () => {
    render(<GraceNoticeModal lastFullDay={en(90)} onClose={vi.fn()} />)

    // Mismas claves i18n que PricingCards: lo que se cobra tiene que estar dicho.
    const pro = document.querySelector('.grace-notice-pro')?.textContent ?? ''
    expect(pro).toMatch(/ilimitadas/i)
    expect(pro).toMatch(/letras online/i)
    expect(pro).toMatch(/colaboradores/i)
    expect(pro).toMatch(/sincronizaci/i)
    expect(pro).toMatch(/fondos/i)
    expect(pro).toMatch(/reportes pdf/i)
    expect(pro).toMatch(/biblia/i)
    expect(document.querySelectorAll('.grace-notice-pro li')).toHaveLength(7)
  })

  it('promete que lo gratis sigue gratis', () => {
    render(<GraceNoticeModal lastFullDay={en(90)} onClose={vi.fn()} />)

    expect(screen.getByText(/sin proyección un domingo/i)).toBeInTheDocument()
  })

  // La gracia vence a las 00:00 del día 12, así que el último día con Pro es el
  // 11. Prometer "hasta el 12" sería un día de más: ese día ya están en Gratis.
  it('nombra el último día completo con Pro, no el del vencimiento', () => {
    render(<GraceNoticeModal lastFullDay={new Date('2026-11-11T05:00:00.000Z')} onClose={vi.fn()} />)

    expect(screen.getByText(/11 de noviembre de 2026/i)).toBeInTheDocument()
    expect(screen.queryByText(/12 de noviembre/i)).not.toBeInTheDocument()
  })

  it('el enlace de WhatsApp cotiza el precio fundador y lleva el correo', () => {
    render(
      <GraceNoticeModal
        lastFullDay={en(90)}
        userEmail="iglesia@ejemplo.com"
        onClose={vi.fn()}
      />,
    )

    const link = screen.getByText(/quiero apoyar/i).closest('a')
    const texto = decodeURIComponent(link?.getAttribute('href') ?? '')
    expect(texto).toContain('$99.000 COP al año')
    expect(texto).toContain('iglesia@ejemplo.com')
  })

  it('«Entendido» cierra', () => {
    const onClose = vi.fn()
    render(<GraceNoticeModal lastFullDay={en(90)} onClose={onClose} />)

    fireEvent.click(screen.getByText(/entendido/i))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Escape cierra', () => {
    const onClose = vi.fn()
    render(<GraceNoticeModal lastFullDay={en(90)} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
