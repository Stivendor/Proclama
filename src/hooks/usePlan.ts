import { useAppStore } from '@/stores'

/**
 * Flag global: mientras sea true, TODOS los usuarios tienen acceso premium.
 * Cambiar a false cuando se active el modelo freemium.
 */
export const PREMIUM_FOR_EVERYONE = true  

/** Límite de canciones propias para usuarios free */
export const FREE_SONG_LIMIT = 10

/** Límite de canciones de Supabase que usuarios free pueden proyectar */
export const FREE_PROJECTION_LIMIT = 50
export const FREE_MEDIA_MAX_FILES = 5
export const FREE_MEDIA_MAX_TOTAL_BYTES = 200 * 1024 * 1024 // 200MB
export const PREMIUM_MEDIA_MAX_FILES = 25
export const PREMIUM_MEDIA_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024 // 2GB

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
  const canUseMediaBackgrounds = isPremium

  /** Retorna true si el usuario puede gestionar carpetas de media local */
  const canManageMediaFolders = isPremium

  const mediaLimits = isPremium
    ? { maxFiles: PREMIUM_MEDIA_MAX_FILES, maxTotalBytes: PREMIUM_MEDIA_MAX_TOTAL_BYTES }
    : { maxFiles: FREE_MEDIA_MAX_FILES, maxTotalBytes: FREE_MEDIA_MAX_TOTAL_BYTES }

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
    canManageMediaFolders,
    mediaLimits,
    canExportReports,
  }
}
