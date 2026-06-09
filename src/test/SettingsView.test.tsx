import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsView from '@/pages/SettingsView'

const updateSettings = vi.fn()
const fetchBackgrounds = vi.fn()
const toggleSidebar = vi.fn()
const setActiveView = vi.fn()
const setLanguage = vi.fn()

let storeState: any

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}))

vi.mock('@/components/DeviceList', () => ({
  default: () => <div data-testid="device-list" />,
}))

vi.mock('@/hooks/usePlan', () => ({
  PREMIUM_FOR_EVERYONE: true,
  usePlan: () => ({ isPremium: false }),
}))

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

vi.mock('@/stores', () => ({
  useAppStore: (selector: any) => selector(storeState),
}))

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState = {
      settings: {
        defaultTheme: {},
        attendanceCategories: ['Caballeros', 'Damas', 'Amigos', 'Ninos'],
        serviceNameTemplates: [],
        churchName: 'Iglesia Centro',
        country: 'Colombia',
        city: 'Bogota',
      },
      updateSettings,
      isSidebarOpen: true,
      toggleSidebar,
      user: { id: 'user-1', email: 'pastor@example.com' },
      backgrounds: [],
      fetchBackgrounds,
      acceptTerms: vi.fn(),
      setActiveView,
      subscriptionPlan: undefined,
      language: 'es',
      setLanguage,
    }
  })

  it('guarda la informacion opcional de la iglesia con pais y ciudad desplegables', () => {
    render(<SettingsView />)

    fireEvent.change(screen.getByLabelText(/nombre de la iglesia/i), {
      target: { value: 'Casa de Fe' },
    })

    const countrySelect = screen.getByLabelText(/país|pais/i)
    expect(countrySelect.tagName).toBe('SELECT')
    fireEvent.change(countrySelect, {
      target: { value: 'México' },
    })

    const citySelect = screen.getByLabelText(/ciudad/i)
    expect(citySelect.tagName).toBe('SELECT')
    expect(screen.getByRole('option', { name: 'Monterrey' })).toBeInTheDocument()
    fireEvent.change(citySelect, {
      target: { value: 'Monterrey' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        churchName: 'Casa de Fe',
        country: 'México',
        city: 'Monterrey',
      }),
    )
  })
})
