import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Sidebar from '@/components/layout/Sidebar'
import { FOUNDER_PRICE_UNTIL, GRACE_EXPIRY_ISO } from '@/constants/plans'

/**
 * El banner del sidebar es la superficie de conversión de la gracia: es lo único
 * que ve todos los días alguien que todavía no decidió, y el único sitio desde
 * el que se reabre el aviso completo. Un `{param}` mal escrito en las cadenas
 * i18n se imprime literal y nadie lo ve hasta que un cliente lo reporta.
 *
 * No hay caso "con la promoción ya vencida": la gracia termina el 12-nov y la
 * promoción el 31-dic, así que cuando muere la segunda ya no hay banner que
 * mostrar. Ese estado lo cubre graceStatus() en pricing.test.ts.
 */

let storeState: Record<string, unknown>

// El jsdom de este proyecto no implementa localStorage (lo deja como objeto
// vacío), y Sidebar lo lee en el useState inicial. Un stub en memoria basta.
const almacen = new Map<string, string>()

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector: (s: Record<string, unknown>) => unknown) => selector,
}))

vi.mock('@/hooks/useSWUpdate', () => ({
  useSWUpdate: () => ({ updateAvailable: false, updateApp: vi.fn() }),
}))

vi.mock('@/services/supabase', () => ({
  supabase: { auth: { signOut: vi.fn() } },
}))

vi.mock('@/components/ui/FeedbackFAB', () => ({ default: () => null }))

vi.mock('@/stores', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) => selector(storeState),
}))

describe('Sidebar — banner de gracia', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Dentro de la gracia (18 días antes de su vencimiento) y todavía con la
    // promoción fundadora viva: es el único estado en el que el banner puede
    // nombrar las dos fechas a la vez.
    vi.setSystemTime(new Date(new Date(GRACE_EXPIRY_ISO).getTime() - 18 * 86_400_000))
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => almacen.get(k) ?? null,
      setItem: (k: string, v: string) => void almacen.set(k, v),
      removeItem: (k: string) => void almacen.delete(k),
      clear: () => almacen.clear(),
    })
    almacen.clear()
    storeState = {
      activeView: 'library',
      setActiveView: vi.fn(),
      toggleSidebar: vi.fn(),
      user: { email: 'iglesia@ejemplo.com' },
      goToLanding: vi.fn(),
      language: 'es',
      userPlan: 'paid',
      userRole: 'user',
      premiumExpiresAt: GRACE_EXPIRY_ISO,
      setGraceNoticeSeen: vi.fn(),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('nombra las dos fechas: lo que se pierde y el precio que se acaba', () => {
    render(<Sidebar />)

    // Lo que se cae con la gracia: el último día completo con Pro.
    expect(screen.getByText(/Pro hasta el/i)).toBeInTheDocument()
    // Y la otra fecha, la del precio fundador, con el precio que se cobra.
    expect(
      screen.getByText(/Precio fundador \$99\.000\/año hasta el 31 de dic/i),
    ).toBeInTheDocument()
  })

  it('el CTA invita a asegurar el precio, no a "ver planes"', () => {
    render(<Sidebar />)

    expect(screen.getByText(/Asegurar precio/i)).toBeInTheDocument()
    expect(screen.queryByText(/ver planes/i)).not.toBeInTheDocument()
  })

  it('al hacer clic reabre el aviso completo', () => {
    render(<Sidebar />)

    fireEvent.click(screen.getByText(/Asegurar precio/i))
    expect(storeState.setGraceNoticeSeen).toHaveBeenCalledWith(false)
  })

  // La huella: un 'paid' con otra fecha es alguien que ya pagó y ya tiene el
  // precio asegurado — a ese no se le vuelve a ofrecer la oferta.
  it('no aparece a quien ya transfirió, aunque le queden pocos días', () => {
    storeState.premiumExpiresAt = new Date(
      new Date(`${FOUNDER_PRICE_UNTIL}T23:59:59-05:00`).getTime() + 30 * 86_400_000,
    ).toISOString()

    render(<Sidebar />)

    expect(screen.queryByText(/Asegurar precio/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pro hasta el/i)).not.toBeInTheDocument()
  })

  // Los vitalicios (premium sin fecha) nunca pierden nada: anunciarles un
  // vencimiento sería mentirles.
  it('no aparece a los vitalicios', () => {
    storeState.premiumExpiresAt = null

    render(<Sidebar />)

    expect(screen.queryByText(/Asegurar precio/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pro hasta el/i)).not.toBeInTheDocument()
  })
})

describe('Sidebar — banner de promoción (cuentas sin gracia)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(new Date(GRACE_EXPIRY_ISO).getTime() - 18 * 86_400_000))
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => almacen.get(k) ?? null,
      setItem: (k: string, v: string) => void almacen.set(k, v),
      removeItem: (k: string) => void almacen.delete(k),
      clear: () => almacen.clear(),
    })
    almacen.clear()
    storeState = {
      activeView: 'library',
      setActiveView: vi.fn(),
      toggleSidebar: vi.fn(),
      user: { email: 'iglesia@ejemplo.com' },
      goToLanding: vi.fn(),
      language: 'es',
      // Una cuenta como la que se registra hoy: free, sin gracia, sin nada.
      userPlan: 'free',
      userRole: 'user',
      premiumExpiresAt: null,
      setGraceNoticeSeen: vi.fn(),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('al free de hoy le muestra la fecha del 31-dic', () => {
    render(<Sidebar />)

    expect(
      screen.getByText(/Precio fundador \$99\.000\/año hasta el 31 de dic/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Asegurar precio/i)).toBeInTheDocument()
    // Nunca tuvo Pro regalado, así que no hay nada que vencer el 11-nov.
    expect(screen.queryByText(/Pro hasta el/i)).not.toBeInTheDocument()
  })

  it('el CTA lleva a Ajustes → Plan', () => {
    render(<Sidebar />)

    fireEvent.click(screen.getByText(/Asegurar precio/i))
    expect(storeState.setActiveView).toHaveBeenCalledWith('settings')
    // Y no dispara el aviso de gracia, que a esta cuenta no le corresponde.
    expect(storeState.setGraceNoticeSeen).not.toHaveBeenCalled()
  })

  it('no se apila con el banner de gracia', () => {
    storeState.userPlan = 'paid'
    storeState.premiumExpiresAt = GRACE_EXPIRY_ISO

    render(<Sidebar />)

    // El de gracia ya lleva la misma fecha: dos banners se leen como duplicados.
    expect(screen.getAllByText(/Asegurar precio/i)).toHaveLength(1)
    expect(screen.getByText(/Pro hasta el/i)).toBeInTheDocument()
  })

  it('no le sale a quien ya tiene el precio asegurado', () => {
    for (const cuenta of [
      { userPlan: 'founding', premiumExpiresAt: null },
      { userPlan: 'paid', premiumExpiresAt: null },
      { userPlan: 'paid', premiumExpiresAt: '2027-10-10T17:50:31.680Z' },
    ]) {
      storeState.userPlan = cuenta.userPlan
      storeState.premiumExpiresAt = cuenta.premiumExpiresAt

      const { unmount } = render(<Sidebar />)
      expect(screen.queryByText(/Asegurar precio/i)).not.toBeInTheDocument()
      unmount()
    }
  })

  it('se apaga solo cuando pasa el 31 de diciembre', () => {
    vi.setSystemTime(
      new Date(new Date(`${FOUNDER_PRICE_UNTIL}T23:59:59-05:00`).getTime() + 86_400_000),
    )

    render(<Sidebar />)

    expect(screen.queryByText(/Asegurar precio/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Precio fundador/i)).not.toBeInTheDocument()
  })
})
