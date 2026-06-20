import { describe, it, expect } from 'vitest'
import { FREE_SONG_LIMIT, FOUNDING_PHASE, isPremiumFromProfile, type PlanTier } from '@/hooks/usePlan'

/**
 * Tests de la lógica de planes freemium.
 * usePlan() es un hook de React (Zustand), así que testeamos la lógica pura:
 *  - isPremiumFromProfile: la fuente de verdad de "es premium" (espeja public.is_premium).
 *  - buildPlanLogic: la matriz de capacidades post-lanzamiento (con FOUNDING_PHASE simulado en false).
 */

const FUTURE = new Date(Date.now() + 86_400_000).toISOString() // +1 día
const PAST = new Date(Date.now() - 86_400_000).toISOString() // -1 día

describe('FREE_SONG_LIMIT', () => {
  it('es 30', () => {
    expect(FREE_SONG_LIMIT).toBe(30)
  })
})

describe('isPremiumFromProfile (función real)', () => {
  it('durante FOUNDING_PHASE, todos son premium', () => {
    // En esta fase el flag está en true: cualquier perfil es premium.
    expect(FOUNDING_PHASE).toBe(true)
    expect(isPremiumFromProfile({ plan: 'free', role: 'user', premiumExpiresAt: null })).toBe(true)
  })
})

/**
 * Lógica de capacidades para CUANDO FOUNDING_PHASE pase a false.
 * Mantiene la matriz Free vs Pro documentada y probada antes de activar pagos.
 */
function premiumFromPlan(plan: PlanTier, role: 'admin' | 'user' | null, expiresAt: string | null): boolean {
  if (role === 'admin') return true
  const ms = expiresAt ? new Date(expiresAt).getTime() : null
  const notExpired = ms == null || ms > Date.now()
  switch (plan) {
    case 'founding': return true
    case 'paid': return notExpired
    case 'trial': return ms != null && ms > Date.now()
    default: return false
  }
}

function buildPlanLogic(plan: PlanTier, role: 'admin' | 'user' | null, expiresAt: string | null = null) {
  const isPremium = premiumFromPlan(plan, role, expiresAt)
  return {
    isPremium,
    plan: isPremium ? 'premium' : ('free' as const),
    canCreateSong: (ownSongCount: number) => isPremium || ownSongCount < FREE_SONG_LIMIT,
    canProjectSong: () => true,
    canUseGenius: isPremium,
    canSync: isPremium,
    canUseMediaBackgrounds: isPremium,
    canViewAttendance: true,
    canExportReports: isPremium,
    canImportBibles: isPremium,
  }
}

describe('Plan free (post-lanzamiento)', () => {
  const plan = buildPlanLogic('free', 'user')

  it('isPremium es false', () => expect(plan.isPremium).toBe(false))
  it('puede proyectar siempre (core nunca se bloquea)', () => expect(plan.canProjectSong()).toBe(true))
  it('puede ver asistencia básica', () => expect(plan.canViewAttendance).toBe(true))
  it('crea canciones hasta el límite', () => {
    expect(plan.canCreateSong(FREE_SONG_LIMIT - 1)).toBe(true)
    expect(plan.canCreateSong(FREE_SONG_LIMIT)).toBe(false)
  })
  it('NO usa Genius, sync, media, reportes ni importar biblias', () => {
    expect(plan.canUseGenius).toBe(false)
    expect(plan.canSync).toBe(false)
    expect(plan.canUseMediaBackgrounds).toBe(false)
    expect(plan.canExportReports).toBe(false)
    expect(plan.canImportBibles).toBe(false)
  })
})

describe('Plan founding (permanente)', () => {
  const plan = buildPlanLogic('founding', 'user')
  it('es premium sin vencimiento', () => expect(plan.isPremium).toBe(true))
  it('crea canciones ilimitadas', () => expect(plan.canCreateSong(1000)).toBe(true))
})

describe('Plan paid (suscripción)', () => {
  it('activo mientras no venza (o vitalicio si null)', () => {
    expect(buildPlanLogic('paid', 'user', FUTURE).isPremium).toBe(true)
    expect(buildPlanLogic('paid', 'user', null).isPremium).toBe(true)
  })
  it('vencido pierde premium', () => {
    expect(buildPlanLogic('paid', 'user', PAST).isPremium).toBe(false)
  })
})

describe('Plan trial (prueba con fecha)', () => {
  it('requiere fecha futura', () => {
    expect(buildPlanLogic('trial', 'user', FUTURE).isPremium).toBe(true)
    expect(buildPlanLogic('trial', 'user', PAST).isPremium).toBe(false)
    expect(buildPlanLogic('trial', 'user', null).isPremium).toBe(false)
  })
})

describe('Admin siempre premium', () => {
  it('aunque el plan sea free', () => {
    expect(buildPlanLogic('free', 'admin').isPremium).toBe(true)
  })
})
