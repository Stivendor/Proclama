import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * El distintivo es el instrumento de medición del experimento: si registra la
 * función equivocada, o no registra, el dato con el que se decide el cobro sale
 * mal. Estos tests cubren eso.
 */

let user: { id: string; email: string } | null

vi.mock('@/stores', () => ({
  useAppStore: (selector: (s: { user: typeof user }) => unknown) => selector({ user }),
}))

const registerPremiumInterest = vi.fn()
vi.mock('@/services/supabase', () => ({
  registerPremiumInterest: (...args: unknown[]) => registerPremiumInterest(...args),
}))

import ProInterestBadge from '@/components/pricing/ProInterestBadge'

describe('ProInterestBadge', () => {
  beforeEach(() => {
    registerPremiumInterest.mockReset()
    registerPremiumInterest.mockResolvedValue({ success: true, alreadyRegistered: false })
    user = { id: 'user-1', email: 'Lider@Iglesia.com' }
  })

  it('registra el interés con la función que lo disparó', async () => {
    render(<ProInterestBadge source="collaborators" />)

    fireEvent.click(screen.getByTitle(/plan Pro/i))
    fireEvent.click(screen.getByText('Me interesa'))

    await waitFor(() =>
      expect(registerPremiumInterest).toHaveBeenCalledWith('lider@iglesia.com', 'user-1', 'collaborators'),
    )
    expect(await screen.findByText(/Anotado/i)).toBeInTheDocument()
  })

  it('avisa cuando ya se había registrado por esa misma función', async () => {
    registerPremiumInterest.mockResolvedValue({ success: true, alreadyRegistered: true })
    render(<ProInterestBadge source="reports" />)

    fireEvent.click(screen.getByTitle(/plan Pro/i))
    fireEvent.click(screen.getByText('Me interesa'))

    expect(await screen.findByText(/Ya nos lo hab/i)).toBeInTheDocument()
  })

  it('deja reintentar si el registro falla', async () => {
    registerPremiumInterest.mockResolvedValue({ success: false })
    render(<ProInterestBadge source="stats" />)

    fireEvent.click(screen.getByTitle(/plan Pro/i))
    fireEvent.click(screen.getByText('Me interesa'))

    expect(await screen.findByText(/No se pudo registrar/i)).toBeInTheDocument()
    expect(screen.getByText('Me interesa')).toBeInTheDocument()
  })

  it('no se muestra sin sesión: ese caso lo cubre la landing', () => {
    user = null
    const { container } = render(<ProInterestBadge source="bibles" />)
    expect(container).toBeEmptyDOMElement()
  })
})
