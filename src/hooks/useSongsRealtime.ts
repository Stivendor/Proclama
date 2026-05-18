import { useEffect } from 'react'
import { supabase, mapRowToSong } from '@/services/supabase'
import { db } from '@/db'

export function useSongsRealtime(userId: string | null | undefined) {
  useEffect(() => {
    const channel = supabase
      .channel('songs_all')
      .on<Record<string, any>>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songs'
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as any
            if (!row?.id) return

            const song = mapRowToSong(row as any)

            if (payload.eventType === 'INSERT') {
              const existing = await db.songs
                .where('remoteId')
                .equals(row.id)
                .first()

              if (!existing) {
                await db.songs.add(song as any)
              }
            } else {
              const existing = await db.songs
                .where('remoteId')
                .equals(row.id)
                .first()

              if (existing?.id != null) {
                await db.songs.update(existing.id, song as any)
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id as number | undefined
            if (!deletedId) return

            const local = await db.songs
              .where('remoteId')
              .equals(deletedId)
              .first()

            if (local?.id != null) {
              await db.songs.delete(local.id)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])
}
