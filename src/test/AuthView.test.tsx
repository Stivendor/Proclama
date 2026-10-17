import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthView from '@/pages/AuthView'

const signInWithOAuth = vi.fn()

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
    },
  },
}))

describe('AuthView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clean render shows the Google button with its label', () => {
    render(<AuthView />)
    expect(
      screen.getByRole('button', { name: /continuar con google/i }),
    ).toBeInTheDocument()
  })

  it('shows a role=alert region with the Spanish error when Google sign-in fails', async () => {
    signInWithOAuth.mockRejectedValue(new Error('network down'))
    render(<AuthView />)

    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'No se pudo iniciar sesión con Google. Intenta de nuevo.',
    )
  })
})
