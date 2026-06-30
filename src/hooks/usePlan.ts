import { useAppStore } from '@/stores'

/**
 * Fase de lanzamiento. true = todos premium (etapa "fundadores").
 * Al activar el modelo de pago, ponlo en false (solo tras correr el
 * grandfathering de la Fase 6 y tener el enforcement server-side listo).
 */
export const FOUNDING_PHASE = true

/** Canciones propias que un usuario free puede crear */
export const FREE_SONG_LIMIT = 30

/**
 * Límites de media local. La media vive en el disco del usuario (IndexedDB),
 * no en nuestra infra, así que el premium no tiene tope: el cap solo existe
 * para el free como muestra/funnel.
 */
export const PREMIUM_MEDIA_MAX_FILES = Infinity
export const PREMIUM_MEDIA_MAX_TOTAL_BYTES = Infinity

/** El free también sube media local, pero acotada */
export const FREE_MEDIA_MAX_FILES = 5
export const FREE_MEDIA_MAX_TOTAL_BYTES = 250 * 1024 * 1024 // 250MB

export type PlanTier = 'free' | 'trial' | 'paid' | 'founding'

/**
 * Fuente de verdad del "es premium" a partir de los campos crudos del perfil.
 * Se usa tanto en el hook (render) como en useAuth (fuera de React), para que
 * el criterio no se duplique. Espeja a public.is_premium() en Supabase.
 */
export function isPremiumFromProfile(args: {
  plan: PlanTier | string | null | undefined
  role: 'admin' | 'user' | null | undefined
  premiumExpiresAt: string | number | null | undefined
}): boolean {
  if (FOUNDING_PHASE) return true
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

export function usePlan() {
  const { userPlan, userRole, premiumExpiresAt } = useAppStore()

  const isPremium = isPremiumFromProfile({
    plan: userPlan,
    role: userRole,
    premiumExpiresAt,
  })

  /** Crear canciones propias (free: hasta FREE_SONG_LIMIT) */
  const canCreateSong = (ownSongCount: number) =>
    isPremium || ownSongCount < FREE_SONG_LIMIT

  /** Proyectar SIEMPRE disponible para todos. El core nunca se bloquea. */
  const canProjectSong = () => true

  /** Búsqueda online (Genius / import) */
  const canUseGenius = isPremium

  /** Sincronización en la nube / multi-dispositivo */
  const canSync = isPremium

  /** Librería de fondos motion/video + imágenes propias */
  const canUseMediaBackgrounds = isPremium

  /** Gestión de carpetas de media local */
  const canManageMediaFolders = isPremium

  const mediaLimits = isPremium
    ? { maxFiles: PREMIUM_MEDIA_MAX_FILES, maxTotalBytes: PREMIUM_MEDIA_MAX_TOTAL_BYTES }
    : { maxFiles: FREE_MEDIA_MAX_FILES, maxTotalBytes: FREE_MEDIA_MAX_TOTAL_BYTES }

  /** Ver asistencia básica en la app (todos) */
  const canViewAttendance = true

  /** Exportar reporte PDF con gráficas (diferenciador, solo Pro) */
  const canExportReports = isPremium

  /** Importar versiones del catálogo HelloAO (+1.000). Solo Pro. */
  const canImportBibles = isPremium

  return {
    isPremium,
    plan: isPremium ? ('premium' as const) : ('free' as const),
    canCreateSong,
    canProjectSong,
    canUseGenius,
    canSync,
    canUseMediaBackgrounds,
    canManageMediaFolders,
    mediaLimits,
    canViewAttendance,
    canExportReports,
    canImportBibles,
  }
}
