import { db } from '@/db'
import { supabase } from '@/services/supabase'
import type { Setlist } from '@/types'

// ─── Funciones puras (testeables sin Dexie/Supabase) ─────────────────────────

/** Separa songIds locales en remoteIds (para la nube) y solo-locales (se quedan en Dexie). */
export function splitSongIds(
  songIds: number[],
  remoteIdByLocal: Map<number, number>
): { remote: number[]; localOnly: number[] } {
  const remote: number[] = []
  const localOnly: number[] = []
  for (const id of songIds) {
    const rid = remoteIdByLocal.get(id)
    if (rid != null) remote.push(rid)
    else localOnly.push(id)
  }
  return { remote, localOnly }
}

/** Convierte song_ids remotos a ids locales, conservando las canciones solo-locales al final. */
export function mergeRemoteSongIds(
  remoteSongIds: number[],
  localByRemote: Map<number, number>,
  previousLocalOnly: number[]
): number[] {
  const mapped = remoteSongIds
    .map(rid => localByRemote.get(rid))
    .filter((id): id is number => id != null)
  return [...mapped, ...previousLocalOnly]
}

/** Last-write-wins: decide la dirección del sync para un setlist. */
export function resolveConflict(
  localUpdatedAt: Date,
  localLastSyncedAt: string | undefined,
  remoteUpdatedAt: string
): 'push' | 'pull' | 'none' {
  const local = localUpdatedAt.getTime()
  const remote = new Date(remoteUpdatedAt).getTime()
  const synced = localLastSyncedAt ? new Date(localLastSyncedAt).getTime() : 0
  const localDirty = local > synced
  const remoteNewer = remote > synced
  if (remoteNewer && remote >= local) return 'pull'
  if (localDirty) return 'push'
  if (remoteNewer) return 'pull'
  return 'none'
}

// ─── Helpers Dexie ────────────────────────────────────────────────────────────

async function songMaps(): Promise<{ remoteIdByLocal: Map<number, number>; localByRemote: Map<number, number> }> {
  const songs = await db.songs.toArray()
  const remoteIdByLocal = new Map<number, number>()
  const localByRemote = new Map<number, number>()
  for (const s of songs) {
    if (s.id != null && s.remoteId != null) {
      remoteIdByLocal.set(s.id, s.remoteId)
      localByRemote.set(s.remoteId, s.id)
    }
  }
  return { remoteIdByLocal, localByRemote }
}

function rowToLocal(row: any, songIds: number[]): Omit<Setlist, 'id'> {
  return {
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
  }
}

// ─── Push (local → Supabase) ─────────────────────────────────────────────────

export async function pushSetlists(userId: string): Promise<{ synced: number; failed: number }> {
  const all = await db.setlists.toArray()
  const pending = all.filter(sl =>
    !sl.remoteId || !sl.lastSyncedAt || sl.updatedAt.getTime() > new Date(sl.lastSyncedAt).getTime()
  )
  if (pending.length === 0) return { synced: 0, failed: 0 }

  const { remoteIdByLocal } = await songMaps()
  let synced = 0
  let failed = 0

  for (const sl of pending) {
    try {
      const { remote } = splitSongIds(sl.songIds, remoteIdByLocal)
      const payload: any = {
        user_id: userId,
        name: sl.name,
        date: sl.date ? new Date(sl.date).toISOString().slice(0, 10) : null,
        song_ids: remote,
        notes: sl.notes ?? null,
        updated_by: 'owner',
        updated_at: sl.updatedAt.toISOString(),
      }
      if (sl.remoteId) payload.id = sl.remoteId

      const { data, error } = await supabase
        .from('setlists')
        .upsert(payload, { onConflict: 'id' })
        .select('id, updated_at')
        .single()

      if (error || !data) {
        console.warn('[SetlistSync] Error upserting:', error?.message)
        failed++
        continue
      }
      if (sl.id != null) {
        await db.setlists.update(sl.id, { remoteId: data.id, lastSyncedAt: data.updated_at, userId })
      }
      synced++
    } catch (err) {
      console.warn('[SetlistSync] Unexpected error:', err)
      failed++
    }
  }
  console.log(`[SetlistSync] Push: ${synced} synced, ${failed} failed`)
  return { synced, failed }
}

// ─── Pull (Supabase → local) ─────────────────────────────────────────────────

export async function pullSetlists(userId: string): Promise<{ pulled: number; skipped: number }> {
  const { data: rows, error } = await supabase
    .from('setlists')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.warn('[SetlistSync] Pull failed:', error.message)
    return { pulled: 0, skipped: 0 }
  }
  if (!rows || rows.length === 0) return { pulled: 0, skipped: 0 }

  const { remoteIdByLocal, localByRemote } = await songMaps()
  const locals = await db.setlists.toArray()
  const localByRemoteId = new Map(locals.filter(l => l.remoteId).map(l => [l.remoteId!, l]))

  let pulled = 0
  let skipped = 0

  for (const row of rows) {
    const local = localByRemoteId.get(row.id)
    if (!local) {
      const songIds = mergeRemoteSongIds(row.song_ids ?? [], localByRemote, [])
      await db.setlists.add(rowToLocal(row, songIds) as Setlist)
      pulled++
      continue
    }
    const action = resolveConflict(local.updatedAt, local.lastSyncedAt, row.updated_at)
    if (action !== 'pull') {
      skipped++
      continue
    }
    const { localOnly } = splitSongIds(local.songIds, remoteIdByLocal)
    const songIds = mergeRemoteSongIds(row.song_ids ?? [], localByRemote, localOnly)
    await db.setlists.update(local.id!, { ...rowToLocal(row, songIds) })
    pulled++
  }
  console.log(`[SetlistSync] Pull: ${pulled} pulled, ${skipped} skipped`)
  return { pulled, skipped }
}

// ─── Delete remoto ───────────────────────────────────────────────────────────

export async function deleteRemoteSetlist(remoteId: string): Promise<boolean> {
  const { error } = await supabase.from('setlists').delete().eq('id', remoteId)
  if (error) {
    console.warn('[SetlistSync] Error deleting remote setlist:', error.message)
    return false
  }
  return true
}

/** Push + pull en orden. Llamar al iniciar sesión y al reconectar. */
export async function syncSetlists(userId: string): Promise<void> {
  await pushSetlists(userId)
  await pullSetlists(userId)
}
