import type { Song } from '@/types'

/** Biblioteca unificada: mis canciones (cualquier estado) + comunidad aprobada. */
export function inUnifiedLibrary(s: Song, userId?: string, isAdmin = false): boolean {
  if (isAdmin) return true
  if (userId && s.userId === userId) return true // mías: pendientes/rechazadas/privadas incluidas
  if (!s.remoteId) return true                   // locales sin dueño (modo guest)
  return !!s.isPublic && !!s.isVerified          // comunidad: solo aprobadas
}

/** Si el usuario importó una canción de comunidad, oculta el original (muestra solo su copia). */
export function dedupImported(songs: Song[], userId?: string): Song[] {
  if (!userId) return songs
  const importadas = new Set(
    songs.filter(s => s.userId === userId && s.importadaDe != null).map(s => s.importadaDe!)
  )
  if (importadas.size === 0) return songs
  return songs.filter(s => !(s.remoteId != null && importadas.has(s.remoteId) && s.userId !== userId))
}
