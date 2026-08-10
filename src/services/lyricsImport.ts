import { db } from '@/db'
import { createSong } from '@/services/supabase'
import { detectLanguage } from '@/services/languageUtils'
import type { LyricsResult } from '@/services/lyricsSearch'
import type { Song } from '@/types'

/**
 * Importa un resultado del buscador online a la biblioteca del usuario.
 *
 * Dexie primero, a propósito: la canción tiene que ser proyectable al
 * instante, sin conexión y sin esperar la aprobación del admin.
 *
 * is_public=true + is_verified=false significa «invisible para terceros» desde
 * la migración 20260810154735, y es exactamente lo que PendingSongsPage ya
 * consulta, así que la canción entra sola en la cola sin tocar el panel admin.
 *
 * El upload puede fallar por RLS: songs_insert_premium exige is_premium(), que
 * mira profiles.plan y no sigue a FOUNDING_PHASE. Para un usuario en plan
 * `free`, createSong devuelve null, la canción se queda en local y no llega a
 * la cola. Es el comportamiento aceptado, no un error que mostrar: desde su
 * punto de vista no ha fallado nada.
 *
 * Vive en su propio archivo para que lyricsSearch.ts siga sin depender de
 * Dexie ni de Supabase.
 */
export async function importLyricsResult(
  result: LyricsResult,
  userId: string | null,
): Promise<Song> {
  const ahora = new Date()
  const song: Omit<Song, 'id'> = {
    title: result.title,
    artist: result.artist,
    lyrics: result.lyrics,
    key: '',
    tags: [],
    language: detectLanguage(result.lyrics),
    sourceUrl: `https://lrclib.net/api/get/${result.id}`,
    usageCount: 0,
    isPublic: true,
    isVerified: false,
    userId: userId ?? undefined,
    createdAt: ahora,
    updatedAt: ahora,
  }

  const localId = (await db.songs.add(song as Song)) as number

  if (userId) {
    const remota = await createSong(song)
    if (remota?.remoteId) await db.songs.update(localId, { remoteId: remota.remoteId })
  }

  return { ...song, id: localId }
}
