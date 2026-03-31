import { createClient } from '@supabase/supabase-js'
import type { Song, Setlist, ChurchNote } from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase config missing. Check .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

type SupabaseSongRow = {
  id: number
  user_id: string | null
  church_id: string | null
  title: string
  artist: string | null
  lyrics: string | null
  key: string | null
  tags: string[] | null
  language: string | null
  is_public: boolean
  is_verified: boolean
  source_url?: string | null
  usage_count: number | null
  created_at: string | null
  updated_at: string | null
}

function mapRowToSong(row: SupabaseSongRow): Song {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    title: row.title,
    artist: row.artist ?? '',
    lyrics: row.lyrics ?? '',
    key: row.key ?? '',
    tags: row.tags ?? [],
    language: row.language ?? 'Español',
    isPublic: row.is_public,
    isVerified: row.is_verified,
    sourceUrl: row.source_url ?? undefined,
    usageCount: row.usage_count ?? 0,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
  }
}

function mapSongToPayload(song: Omit<Song, 'id'>) {
  return {
    title: song.title,
    artist: song.artist,
    lyrics: song.lyrics,
    key: song.key,
    tags: song.tags,
    language: song.language,
    is_public: song.isPublic,
    is_verified: song.isVerified,
    source_url: song.sourceUrl ?? null,
    usage_count: song.usageCount,
    updated_at: song.updatedAt.toISOString(),
    ...(song.userId && { user_id: song.userId })
  }
}

// ─── Funciones para Songs ──────────────────────────────────────────────────
export async function fetchSongs(): Promise<Song[]> {
  const allData: SupabaseSongRow[] = []
  let from = 0
  const step = 1000

  while (true) {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .range(from, from + step - 1)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching songs:', error)
      break
    }
    if (!data || data.length === 0) break
    
    allData.push(...(data as SupabaseSongRow[]))
    if (data.length < step) break
    from += step
  }
  
  return allData.map(mapRowToSong)
}

/**
 * Busca canciones por texto en título, artista o letra.
 * Utiliza búsqueda de texto completo para mayor precisión.
 */
export async function searchSongs(query: string): Promise<Song[]> {
  if (!query) return fetchSongs()

  // Búsqueda simple por ILIKE en título/artista y Full Text Search en lyrics
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .or(`title.ilike.%${query}%,artist.ilike.%${query}%,lyrics.fts.${query}`)
    .order('usage_count', { ascending: false })

  if (error) {
    console.error('Error searching songs:', error)
    return []
  }

  return (data as SupabaseSongRow[]).map(mapRowToSong)
}

export async function createSong(song: Omit<Song, 'id'>): Promise<Song | null> {
  const payload = mapSongToPayload(song)
  
  const { data, error } = await supabase
    .from('songs')
    .insert([payload])
    .select()
    .single()

  if (error) {
    console.error('Error creating song in Supabase:', error.message, error.details)
    return null
  }
  return mapRowToSong(data as SupabaseSongRow)
}

export async function updateSong(id: number, updates: Partial<Omit<Song, 'id'>>): Promise<Song | null> {
  const currentUpdatedAt = updates.updatedAt ?? new Date()
  const payload = {
    ...(updates.title !== undefined && { title: updates.title }),
    ...(updates.artist !== undefined && { artist: updates.artist }),
    ...(updates.lyrics !== undefined && { lyrics: updates.lyrics }),
    ...(updates.key !== undefined && { key: updates.key }),
    ...(updates.tags !== undefined && { tags: updates.tags }),
    ...(updates.language !== undefined && { language: updates.language }),
    ...(updates.isPublic !== undefined && { is_public: updates.isPublic }),
    ...(updates.isVerified !== undefined && { is_verified: updates.isVerified }),
    ...(updates.sourceUrl !== undefined && { source_url: updates.sourceUrl }),
    ...(updates.usageCount !== undefined && { usage_count: updates.usageCount }),
    ...(updates.userId !== undefined && { user_id: updates.userId }),
    updated_at: currentUpdatedAt.toISOString()
  }

  const { data, error } = await supabase
    .from('songs')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating song in Supabase:', error.message)
    return null
  }
  return mapRowToSong(data as SupabaseSongRow)
}

export async function deleteSong(id: number) {
  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('id', id)

  if (error) console.error('Error deleting song:', error)
}

// ─── Funciones para Setlists ──────────────────────────────────────────────
/**
 * Mapea una fila de Supabase (con underscore) al objeto Setlist del frontend (camelCase)
 */
function mapRowToSetlist(row: any): Setlist {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    date: new Date(row.date),
    songIds: row.song_ids || [],
    notes: row.notes || '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  }
}

export async function fetchSetlists(): Promise<Setlist[]> {
  const { data, error } = await supabase
    .from('setlists')
    .select('*')
    .order('date', { ascending: false })
  
  if (error) {
    console.error('Error fetching setlists:', error)
    return []
  }
  return (data || []).map(mapRowToSetlist)
}

export async function createSetlist(setlist: Omit<Setlist, 'id'>): Promise<Setlist | null> {
  const payload = {
    name: setlist.name,
    date: setlist.date.toISOString().split('T')[0], // solo fecha YYYY-MM-DD
    user_id: setlist.userId,
    song_ids: setlist.songIds,
    notes: setlist.notes || '',
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('setlists')
    .insert([payload])
    .select()
    .single()
  
  if (error) {
    console.error('Error creating setlist:', error)
    return null
  }
  return mapRowToSetlist(data)
}

export async function updateSetlist(id: number, updates: Partial<Setlist>): Promise<Setlist | null> {
  const payload: any = {
    updated_at: new Date().toISOString()
  }
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.date !== undefined) payload.date = updates.date.toISOString().split('T')[0]
  if (updates.songIds !== undefined) payload.song_ids = updates.songIds
  if (updates.notes !== undefined) payload.notes = updates.notes

  const { data, error } = await supabase
    .from('setlists')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating setlist:', error)
    return null
  }
  return mapRowToSetlist(data)
}

export async function deleteSetlist(id: number) {
  const { error } = await supabase
    .from('setlists')
    .delete()
    .eq('id', id)
  
  if (error) console.error('Error deleting setlist:', error)
}

// ─── Funciones para Settings ──────────────────────────────────────────────
export async function fetchSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .single()
  
  if (error) console.warn('No settings found:', error)
  return data || null
}

export async function updateSettings(updates: any) {
  const { data: existing } = await supabase.from('app_settings').select('id').single()
  let result
  if (existing) {
    result = await supabase.from('app_settings').update(updates).eq('id', existing.id).select()
  } else {
    result = await supabase.from('app_settings').insert(updates).select()
  }
  
  if (result.error) console.error('Error updating settings:', result.error)
  return result.data?.[0] || null
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, plan')
    .eq('id', userId)
    .single()
  
  if (error) {
    console.warn('Error fetching profile:', error.message)
    return null
  }
  return data as { role: 'admin' | 'user'; plan: 'free' | 'premium' }
}

// ─── Funciones para Attendance Records ────────────────────────────────────────
import type { AttendanceBreakdown } from '@/types'

export async function upsertAttendance(
  userId: string,
  date: string,
  attendance: AttendanceBreakdown,
  serviceName?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('attendance_records')
    .upsert(
      {
        user_id: userId,
        date,
        service_name: serviceName ?? null,
        caballeros: attendance.caballeros,
        damas: attendance.damas,
        amigos: attendance.amigos,
        ninos: attendance.ninos,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    )

  if (error) {
    console.error('Error upserting attendance:', error.message)
    return false
  }
  return true
}

export async function fetchAllAttendance(userId: string): Promise<Array<{ date: string } & AttendanceBreakdown>> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('date, caballeros, damas, amigos, ninos')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching attendance:', error.message)
    return []
  }
  return (data ?? []) as Array<{ date: string } & AttendanceBreakdown>
}
type SupabaseChurchNoteRow = {
  id: string
  user_id: string
  date: string
  attendance: AttendanceBreakdown | null
  notices: ChurchNote['notices']
  created_at: string
  updated_at: string
}

function mapRowToChurchNote(row: SupabaseChurchNoteRow): ChurchNote {
  return {
    remoteId: row.id,
    userId: row.user_id,
    date: row.date,
    attendance: row.attendance ?? undefined,
    notices: row.notices ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function fetchChurchNote(date: string, userId: string): Promise<ChurchNote | null> {
  const { data, error } = await supabase
    .from('church_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // no rows found
    console.error('Error fetching church note:', error.message)
    return null
  }
  return mapRowToChurchNote(data as SupabaseChurchNoteRow)
}

export async function upsertChurchNote(note: ChurchNote): Promise<ChurchNote | null> {
  const payload = {
    ...(note.remoteId && { id: note.remoteId }),
    user_id: note.userId,
    date: note.date,
    attendance: note.attendance ?? null,
    notices: note.notices,
    created_at: note.createdAt,
    updated_at: note.updatedAt
  }

  const { data, error } = await supabase
    .from('church_notes')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()
    .single()

  if (error) {
    console.error('Error upserting church note:', error.message)
    return null
  }
  return mapRowToChurchNote(data as SupabaseChurchNoteRow)
}

export async function deleteChurchNote(remoteId: string): Promise<void> {
  const { error } = await supabase
    .from('church_notes')
    .delete()
    .eq('id', remoteId)

  if (error) console.error('Error deleting church note:', error.message)
}

// ─── Funciones para Terms & Conditions ────────────────────────────────────────

/**
 * Guarda la aceptación de términos en la tabla profiles.
 * Hace upsert de terms_version y terms_accepted_at para el usuario dado.
 */
export async function syncTermsAcceptance(
  userId: string,
  version: string,
  acceptedAt: string
): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({
      terms_version: version,
      terms_accepted_at: acceptedAt,
    })
    .eq('id', userId)

  if (error) {
    console.error('Error syncing terms acceptance:', error.message)
    return false
  }
  return true
}

/**
 * Recupera la aceptación de términos desde la tabla profiles.
 */
export async function fetchTermsAcceptance(
  userId: string
): Promise<{ version: string; acceptedAt: string } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('terms_version, terms_accepted_at')
    .eq('id', userId)
    .single()

  if (error) {
    console.warn('Error fetching terms acceptance:', error.message)
    return null
  }
  if (!data?.terms_version || !data?.terms_accepted_at) return null
  return { version: data.terms_version, acceptedAt: data.terms_accepted_at }
}
