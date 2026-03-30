import { useAppStore } from '@/stores'

/**
 * Flag global: mientras sea true, TODOS los usuarios tienen acceso premium.
 * Cambiar a false cuando se active el modelo freemium.
 */
const PREMIUM_FOR_EVERYONE = true

export function usePlan() {
  const { userPlan, userRole, user } = useAppStore()

  const isPremium =
    PREMIUM_FOR_EVERYONE ||
    userRole === 'admin' ||
    userPlan === 'premium'

  return { isPremium, plan: isPremium ? 'premium' : 'free' as const }
}
