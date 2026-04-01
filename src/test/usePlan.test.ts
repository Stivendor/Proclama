import { describe, it, expect, beforeEach } from 'vitest'
import { FREE_SONG_LIMIT } from '@/hooks/usePlan'

/**
 * Tests de la lógica de planes freemium.
 * usePlan() es un hook de React que depende de Zustand, por lo que
 * testeamos la lógica pura directamente (sin renderizar componentes).
 */

// Lógica pura extraída de usePlan para testear sin hooks
const PREMIUM_FOR_EVERYONE = false

function buildPlanLogic(userPlan: 'free' | 'premium', userRole: 'admin' | 'user' | null) {
  const isPremium = PREMIUM_FOR_EVERYONE || userRole === 'admin' || userPlan === 'premium'
  return {
    isPremium,
    plan: isPremium ? 'premium' : ('free' as const),
    canCreateSong: (ownSongCount: number) => isPremium || ownSongCount < FREE_SONG_LIMIT,
    canUseGenius: isPremium,
    canSync: isPremium,
    canUseMediaBackgrounds: true,
    canExportReports: isPremium,
  }
}

describe('FREE_SONG_LIMIT', () => {
  it('es 10', () => {
    expect(FREE_SONG_LIMIT).toBe(10)
  })
})

describe('Plan free', () => {
  const plan = buildPlanLogic('free', 'user')

  it('isPremium es false', () => {
    expect(plan.isPremium).toBe(false)
  })

  it('plan es "free"', () => {
    expect(plan.plan).toBe('free')
  })

  it('puede crear canciones hasta el límite', () => {
    expect(plan.canCreateSong(0)).toBe(true)
    expect(plan.canCreateSong(9)).toBe(true)
    expect(plan.canCreateSong(FREE_SONG_LIMIT - 1)).toBe(true)
  })

  it('no puede crear canciones al alcanzar el límite', () => {
    expect(plan.canCreateSong(FREE_SONG_LIMIT)).toBe(false)
    expect(plan.canCreateSong(FREE_SONG_LIMIT + 1)).toBe(false)
    expect(plan.canCreateSong(100)).toBe(false)
  })

  it('no puede usar Genius', () => {
    expect(plan.canUseGenius).toBe(false)
  })

  it('no puede sincronizar', () => {
    expect(plan.canSync).toBe(false)
  })

  it('puede usar fondos multimedia (siempre disponible)', () => {
    expect(plan.canUseMediaBackgrounds).toBe(true)
  })

  it('no puede exportar reportes', () => {
    expect(plan.canExportReports).toBe(false)
  })
})

describe('Plan premium', () => {
  const plan = buildPlanLogic('premium', 'user')

  it('isPremium es true', () => {
    expect(plan.isPremium).toBe(true)
  })

  it('plan es "premium"', () => {
    expect(plan.plan).toBe('premium')
  })

  it('puede crear canciones ilimitadas', () => {
    expect(plan.canCreateSong(0)).toBe(true)
    expect(plan.canCreateSong(FREE_SONG_LIMIT)).toBe(true)
    expect(plan.canCreateSong(1000)).toBe(true)
  })

  it('puede usar Genius', () => {
    expect(plan.canUseGenius).toBe(true)
  })

  it('puede sincronizar', () => {
    expect(plan.canSync).toBe(true)
  })

  it('puede exportar reportes', () => {
    expect(plan.canExportReports).toBe(true)
  })
})

describe('Admin siempre tiene acceso premium', () => {
  const plan = buildPlanLogic('free', 'admin')

  it('isPremium es true aunque el plan sea free', () => {
    expect(plan.isPremium).toBe(true)
  })

  it('puede crear canciones ilimitadas', () => {
    expect(plan.canCreateSong(1000)).toBe(true)
  })

  it('puede usar Genius', () => {
    expect(plan.canUseGenius).toBe(true)
  })

  it('puede sincronizar', () => {
    expect(plan.canSync).toBe(true)
  })
})

describe('canCreateSong — casos borde', () => {
  it('exactamente en el límite: free no puede', () => {
    const plan = buildPlanLogic('free', 'user')
    expect(plan.canCreateSong(FREE_SONG_LIMIT)).toBe(false)
  })

  it('un por debajo del límite: free puede', () => {
    const plan = buildPlanLogic('free', 'user')
    expect(plan.canCreateSong(FREE_SONG_LIMIT - 1)).toBe(true)
  })

  it('con 0 canciones: free puede', () => {
    const plan = buildPlanLogic('free', 'user')
    expect(plan.canCreateSong(0)).toBe(true)
  })
})
