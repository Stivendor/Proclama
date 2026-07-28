import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsView from '@/pages/SettingsView'

/**
 * Flujo de activación de la prueba, con FOUNDING_PHASE ya en false (post-paywall).
 * Cubre lo que el confirm nativo del navegador hacía antes y ahora hace el
 * ConfirmDialog de la app: nada se activa sin que el usuario lo confirme.
 */

const startTrial = vi.fn()
let storeState: any

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}))

vi.mock('@/components/DeviceList', () => ({
  default: () => <div data-testid="device-list" />,
}))

vi.mock('@/hooks/usePlan', () => ({
  FOUNDING_PHASE: false,
  usePlan: () => ({ isPremium: false }),
}))

vi.mock('@/services/supabase', () => ({
  supabase: { auth: { signInWithOAuth: vi.fn(), signOut: vi.fn() } },
  startTrial: (...args: unknown[]) => startTrial(...args),
}))

const setUserPlan = vi.fn()
const setPremiumExpiresAt = vi.fn()
const setTrialStartedAt = vi.fn()

vi.mock('@/stores', () => ({
  useAppStore: Object.assign((selector: any) => selector(storeState), {
    getState: () => ({ setUserPlan, setPremiumExpiresAt, setTrialStartedAt }),
  }),
}))

const TRIAL_CTA = /empezar prueba gratuita/i
const CONFIRM_CTA = /activar prueba/i

describe('SettingsView — activar la prueba', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    startTrial.mockResolvedValue({ ok: true, expiresAt: '2026-08-27T00:00:00Z' })
    storeState = {
      settings: { defaultTheme: {}, attendanceCategories: [], serviceNameTemplates: [] },
      updateSettings: vi.fn(),
      isSidebarOpen: true,
      toggleSidebar: vi.fn(),
      user: { id: 'user-1', email: 'pastor@example.com' },
      backgrounds: [],
      fetchBackgrounds: vi.fn(),
      acceptTerms: vi.fn(),
      setActiveView: vi.fn(),
      language: 'es',
      setLanguage: vi.fn(),
      trialStartedAt: null,
      premiumExpiresAt: null,
      userPlan: 'free',
    }
  })

  it('no activa nada hasta confirmar', () => {
    render(<SettingsView />)

    fireEvent.click(screen.getByText(TRIAL_CTA))
    // El diálogo está abierto, pero la RPC no se ha llamado todavía.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(startTrial).not.toHaveBeenCalled()
  })

  it('cancelar cierra el diálogo sin activar', () => {
    render(<SettingsView />)

    fireEvent.click(screen.getByText(TRIAL_CTA))
    fireEvent.click(screen.getByRole('button', { name: /ahora no/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(startTrial).not.toHaveBeenCalled()
  })

  it('confirmar llama a la RPC y refleja la prueba en el store', async () => {
    render(<SettingsView />)

    fireEvent.click(screen.getByText(TRIAL_CTA))
    fireEvent.click(screen.getByRole('button', { name: CONFIRM_CTA }))

    await waitFor(() => expect(startTrial).toHaveBeenCalledOnce())
    expect(setUserPlan).toHaveBeenCalledWith('trial')
    expect(setPremiumExpiresAt).toHaveBeenCalledWith('2026-08-27T00:00:00Z')
    expect(setTrialStartedAt).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('si la RPC falla, muestra el error y no toca el store', async () => {
    startTrial.mockResolvedValue({ ok: false, error: 'Ya usaste tu prueba gratuita.' })
    render(<SettingsView />)

    fireEvent.click(screen.getByText(TRIAL_CTA))
    fireEvent.click(screen.getByRole('button', { name: CONFIRM_CTA }))

    expect(await screen.findByText('Ya usaste tu prueba gratuita.')).toBeInTheDocument()
    expect(setUserPlan).not.toHaveBeenCalled()
  })
})
