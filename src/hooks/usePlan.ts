import { useAppStore } from '@/stores'

/**
 * Flag global: mientras sea true, TODOS los usuarios tienen acceso premium.
 * Cambiar a false cuando se active el modelo freemium.
 */
export const PREMIUM_FOR_EVERYONE = true 

/** Límite de canciones propias para usuarios free */
export const FREE_SONG_LIMIT = 10

/** Límite de canciones de Supabase que usuarios free pueden proyectar */
export const FREE_PROJECTION_LIMIT = 100

export function usePlan() {
  const { userPlan, userRole } = useAppStore()

  const isPremium =
    PREMIUM_FOR_EVERYONE ||
    userRole === 'admin' ||
    userPlan === 'premium'

  /**
   * Retorna true si el usuario puede crear más canciones propias.
   * @param ownSongCount número de canciones propias actuales del usuario
   */
  const canCreateSong = (ownSongCount: number) =>
    isPremium || ownSongCount < FREE_SONG_LIMIT

  /**
   * Retorna true si el usuario puede proyectar una canción de Supabase.
   * @param usageCount número de veces que se ha usado la canción
   * @param rank posición de la canción en el ranking (1 = más usada)
   */
  const canProjectSong = (usageCount: number, rank: number) =>
    isPremium || rank <= FREE_PROJECTION_LIMIT

  /** Retorna true si el usuario puede usar la búsqueda online (Genius) */
  const canUseGenius = isPremium

  /** Retorna true si el usuario tiene sincronización en la nube */
  const canSync = isPremium

  /** Retorna true si el usuario puede usar fondos multimedia (videos/imágenes) */
  const canUseMediaBackgrounds = isPremium // Siempre disponible para todos

  /** Retorna true si el usuario puede exportar reportes de asistencia */
  const canExportReports = isPremium

  return {
    isPremium,
    plan: isPremium ? 'premium' : ('free' as const),
    canCreateSong,
    canProjectSong,
    canUseGenius,
    canSync,
    canUseMediaBackgrounds,
    canExportReports,
  }
}
