import { supabase } from '@/services/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type CollaboratorRow = {
  id: string
  name: string
  token: string
  revokedAt: string | null
  lastSeenAt: string | null
  createdAt: string
}

export type CollabSong = { id: number; title: string; artist: string; key: string; language: string }
export type CollabSongFull = { id: number; title: string; artist: string; key: string; lyrics: string }

export type CollabSetlist = {
  id: string
  name: string
  date: string | null       // 'YYYY-MM-DD'
  songIds: number[]          // remoteIds de songs
  notes: string | null
  updatedBy: string
  updatedAt: string
}

// ─── Token ────────────────────────────────────────────────────────────────────
export function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ─── Gestión (operador autenticado, RLS directo) ─────────────────────────────
export async function createCollaborator(
  ownerId: string,
  name: string
): Promise<{ id: string; token: string } | null> {
  const token = generateToken()
  const { data, error } = await supabase
    .from('collaborators')
    .insert({ owner_id: ownerId, name: name.trim(), token })
    .select('id, token')
    .single()
  if (error || !data) {
    console.warn('[Collab] Error creating collaborator:', error?.message)
    return null
  }
  return { id: data.id, token: data.token }
}

export async function listCollaborators(ownerId: string): Promise<CollaboratorRow[]> {
  const { data, error } = await supabase
    .from('collaborators')
    .select('id, name, token, revoked_at, last_seen_at, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((r: any) => ({
    id: r.id, name: r.name, token: r.token,
    revokedAt: r.revoked_at, lastSeenAt: r.last_seen_at, createdAt: r.created_at,
  }))
}

export async function revokeCollaborator(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('collaborators')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}

export function collabLink(token: string): string {
  return `${window.location.origin}/colaborar/${token}`
}

// ─── Vista pública (anónimo, via RPC) ─────────────────────────────────────────
function mapSetlistRow(r: any): CollabSetlist {
  return {
    id: r.id, name: r.name, date: r.date,
    songIds: r.song_ids ?? [], notes: r.notes,
    updatedBy: r.updated_by ?? 'owner', updatedAt: r.updated_at,
  }
}

export async function collabInfo(token: string): Promise<{ collaboratorName: string; churchName: string } | null> {
  const { data, error } = await supabase.rpc('collab_info', { p_token: token })
  if (error) {
    // invalid_token se lanza con SQLSTATE 28000 desde _collab_auth
    if (error.code === '28000' || (error.message ?? '').includes('invalid_token')) return null
    throw new Error(error.message)
  }
  if (!data || data.length === 0) return null
  return { collaboratorName: data[0].collaborator_name, churchName: data[0].church_name }
}

export async function collabSearchSongs(token: string, query: string, offset = 0): Promise<CollabSong[]> {
  const { data, error } = await supabase.rpc('collab_search_songs', {
    p_token: token, p_query: query, p_offset: offset,
  })
  if (error || !data) return []
  return data as CollabSong[]
}

export async function collabGetSong(token: string, songId: number): Promise<CollabSongFull | null> {
  const { data, error } = await supabase.rpc('collab_get_song', { p_token: token, p_song_id: songId })
  if (error || !data || data.length === 0) return null
  return data[0] as CollabSongFull
}

export async function collabListSetlists(token: string): Promise<CollabSetlist[]> {
  const { data, error } = await supabase.rpc('collab_list_setlists', { p_token: token })
  if (error || !data) return []
  return data.map(mapSetlistRow)
}

export async function collabUpsertSetlist(
  token: string,
  sl: { id?: string; name: string; date: string | null; songIds: number[]; notes: string | null }
): Promise<CollabSetlist | null> {
  const { data, error } = await supabase.rpc('collab_upsert_setlist', {
    p_token: token,
    p_id: sl.id ?? null,
    p_name: sl.name,
    p_date: sl.date,
    p_song_ids: sl.songIds,
    p_notes: sl.notes,
  })
  if (error || !data || data.length === 0) {
    console.warn('[Collab] upsert failed:', error?.message)
    return null
  }
  return mapSetlistRow(data[0])
}

export async function collabDeleteSetlist(token: string, id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('collab_delete_setlist', { p_token: token, p_id: id })
  return !error && data === true
}
