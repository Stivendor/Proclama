import { useAppStore } from '@/stores'

/**
 * Fase de lanzamiento. true = todos premium (etapa "fundadores").
 * Al activar el modelo de pago, ponlo en false (solo tras correr el
 * grandfathering de la Fase 6 y tener el enforcement server-side listo).
 */
export const FOUNDING_PHASE = true

/** Canciones propias que un usuario free puede crear */
export const FREE_SONG_LIMIT = 30

export type PlanTier = 'free' | 'trial' | 'paid' | 'founding'

export type PremiumProfileFields = {
  plan: PlanTier | string | null | undefined
  role: 'admin' | 'user' | null | undefined
  premiumExpiresAt: string | number | null | undefined
}

/**
 * La regla de premium por plan, sin la fase de lanzamiento.
 * Espeja EXACTAMENTE a public.is_premium() en Supabase: si cambias una,
 * cambia la otra. Vive aparte de FOUNDING_PHASE para que los tests puedan
 * probar la matriz post-lanzamiento contra el código real en vez de una copia.
 */
export function isPremiumByPlan(args: PremiumProfileFields): boolean {
  if (args.role === 'admin') return true

  const expiresAtMs = args.premiumExpiresAt ? new Date(args.premiumExpiresAt).getTime() : null
  const notExpired = expiresAtMs == null || expiresAtMs > Date.now()

  switch (args.plan) {
    case 'founding':
      return true // permanente, sin vencimiento
    case 'paid':
      return notExpired // suscripción activa (o vitalicia si null)
    case 'trial':
      return expiresAtMs != null && expiresAtMs > Date.now() // prueba con fecha obligatoria
    default:
      return false
  }
}

/**
 * Fuente de verdad del "es premium" a partir de los campos crudos del perfil.
 * Se usa tanto en el hook (render) como en useAuth (fuera de React), para que
 * el criterio no se duplique.
 */
export function isPremiumFromProfile(args: PremiumProfileFields): boolean {
  if (FOUNDING_PHASE) return true
  return isPremiumByPlan(args)
}

/**
 * Regla de "puede crear otra canción propia" a partir del perfil crudo, para
 * callers fuera de React (atajos de teclado). El hook delega aquí para que el
 * límite no viva en dos sitios.
 */
export function canCreateSongFromProfile(profile: PremiumProfileFields, ownSongCount: number): boolean {
  return isPremiumFromProfile(profile) || ownSongCount < FREE_SONG_LIMIT
}

export function usePlan() {
  const { userPlan, userRole, premiumExpiresAt } = useAppStore()

  const isPremium = isPremiumFromProfile({
    plan: userPlan,
    role: userRole,
    premiumExpiresAt,
  })

  /** Crear canciones propias (free: hasta FREE_SONG_LIMIT) */
  const canCreateSong = (ownSongCount: number) =>
    canCreateSongFromProfile({ plan: userPlan, role: userRole, premiumExpiresAt }, ownSongCount)

  /** Proyectar SIEMPRE disponible para todos. El core nunca se bloquea. */
  const canProjectSong = () => true

  /** Sincronización en la nube / multi-dispositivo */
  const canSync = isPremium

  /** Librería de fondos motion/video + imágenes propias */
  const canUseMediaBackgrounds = isPremium

  /**
   * Invitar colaboradores a los setlists. Sólo cubre CREAR enlaces: ver y
   * revocar los existentes queda abierto (espeja las políticas RLS de
   * public.collaborators, donde el gate premium está sólo en el insert).
   */
  const canInviteCollaborators = isPremium

  /** Ver asistencia básica en la app (todos) */
  const canViewAttendance = true

  /** Exportar reporte PDF con gráficas (diferenciador, solo Pro) */
  const canExportReports = isPremium

  /** Panel de estadísticas de asistencia (analítica, solo Pro) */
  const canViewStats = isPremium

  /** Importar versiones del catálogo HelloAO (+1.000). Solo Pro. */
  const canImportBibles = isPremium

  return {
    isPremium,
    plan: isPremium ? ('premium' as const) : ('free' as const),
    canCreateSong,
    canProjectSong,
    canSync,
    canUseMediaBackgrounds,
    canInviteCollaborators,
    canViewAttendance,
    canExportReports,
    canViewStats,
    canImportBibles,
  }
}
