  import { useAppStore } from '@/stores'

  /**
   * Flag global: mientras sea true, TODOS los usuarios tienen acceso premium.
   * Cambiar a false cuando se active el modelo freemium.
   */
  const PREMIUM_FOR_EVERYONE = false  

  /** Límite de canciones propias para usuarios free */
  export const FREE_SONG_LIMIT = 10

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

    /** Retorna true si el usuario puede usar la búsqueda online (Genius) */
    const canUseGenius = isPremium

    /** Retorna true si el usuario tiene sincronización en la nube */
    const canSync = isPremium

    /** Retorna true si el usuario puede usar fondos multimedia (videos/imágenes) */
    const canUseMediaBackgrounds = true // Siempre disponible para todos

    /** Retorna true si el usuario puede exportar reportes de asistencia */
    const canExportReports = isPremium

    return {
      isPremium,
      plan: isPremium ? 'premium' : ('free' as const),
      canCreateSong,
      canUseGenius,
      canSync,
      canUseMediaBackgrounds,
      canExportReports,
    }
  }
