import { useEffect } from 'react'
import { supabase } from '@/services/supabase'
import { db } from '@/db'
import { splitSongIds, mergeRemoteSongIds, resolveConflict } from '@/services/setlistSync'
import type { Setlist } from '@/types'

export function useSetlistsRealtime(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`setlists_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'setlists', filter: `user_id=eq.${userId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as any
            const songs = await db.songs.toArray()
            const remoteIdByLocal = new Map<number, number>()
            const localByRemote = new Map<number, number>()
            for (const s of songs) {
              if (s.id != null && s.remoteId != null) {
                remoteIdByLocal.set(s.id, s.remoteId)
                localByRemote.set(s.remoteId, s.id)
              }
            }

            const local = await db.setlists.where('remoteId').equals(row.id).first()
            if (!local) {
              const songIds = mergeRemoteSongIds(row.song_ids ?? [], localByRemote, [])
              await db.setlists.add({
                remoteId: row.id,
                userId: row.user_id,
                name: row.name,
                date: row.date ? new Date(row.date + 'T00:00:00') : new Date(row.created_at),
                songIds,
                notes: row.notes ?? undefined,
                updatedBy: row.updated_by ?? 'owner',
                lastSyncedAt: row.updated_at,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
              } as Setlist)
              return
            }
            if (resolveConflict(local.updatedAt, local.lastSyncedAt, row.updated_at) !== 'pull') return
            const { localOnly } = splitSongIds(local.songIds, remoteIdByLocal)
            const songIds = mergeRemoteSongIds(row.song_ids ?? [], localByRemote, localOnly)
            await db.setlists.update(local.id!, {
              name: row.name,
              date: row.date ? new Date(row.date + 'T00:00:00') : local.date,
              songIds,
              notes: row.notes ?? undefined,
              updatedBy: row.updated_by ?? 'owner',
              lastSyncedAt: row.updated_at,
              updatedAt: new Date(row.updated_at),
            })
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id as string | undefined
            if (!deletedId) return
            const local = await db.setlists.where('remoteId').equals(deletedId).first()
            if (local?.id != null) await db.setlists.delete(local.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])
}
