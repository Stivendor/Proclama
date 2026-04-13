import { createClient } from '@supabase/supabase-js'
import type { Song, Setlist, ChurchNote, AttendanceRecord, AttendanceBreakdown } from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase config missing. Check .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

type SupabaseSongRow = {
  id: number
  user_id: string | null
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
    user_id: song.userId ?? null,
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
    created_at: song.createdAt.toISOString(),
    updated_at: song.updatedAt.toISOString(),
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
      throw new Error(error.message)
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
 * Utiliza una función RPC en Supabase que ignora acentos y tildes (unaccent).
 * @param query El texto a buscar
 * @param publicOnly Si es true, solo devolverá canciones marcadas como públicas (para descubrimiento online)
 */
export async function searchSongs(query: string, publicOnly = false, targetLanguage?: string): Promise<Song[]> {
  if (!query) return fetchSongs()

  try {
    const { data, error } = await supabase
      .rpc('search_songs_community', { 
        search_term: query, 
        public_only: publicOnly,
        target_language: targetLanguage 
      })

    if (!error && data) {
      return (data as SupabaseSongRow[]).map(mapRowToSong)
    }
    
    // Si hay error en el RPC (p. ej. no existe la función aún), caer en el fallback
    if (error) console.warn('RPC search error, falling back to basic search:', error.message)
  } catch (err) {
    console.warn('Search RPC failed, using fallback:', err)
  }

  // Fallback: Búsqueda básica (sensible a acentos)
  let request = supabase
    .from('songs')
    .select('*')
    .or(`title.ilike.%${query}%,artist.ilike.%${query}%,lyrics.fts.${query}`)
    .order('usage_count', { ascending: false })
    .limit(20)

  if (publicOnly) {
    request = request.eq('is_public', true)
  }

  if (targetLanguage) {
    request = request.eq('language', targetLanguage)
  }

  const { data, error } = await request

  if (error) {
    console.error('Error in fallback search:', error)
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
    console.error('Error creating song in Supabase:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
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
  try {
    const { data, error } = await supabase
      .from('setlists')
      .select('*')
      .order('date', { ascending: false })
    if (error) throw error
    return (data || []).map(mapRowToSetlist)
  } catch (err: any) {
    if (err?.name === 'AbortError') return []
    console.error('Error fetching setlists:', err)
    return []
  }
}

export async function createSetlist(setlist: Omit<Setlist, 'id'>): Promise<Setlist | null> {
  const payload = {
    name: setlist.name,
    date: setlist.date.toISOString().split('T')[0],
    notes: setlist.notes || '',
    song_ids: setlist.songIds || []
  }
  try {
    const { data, error } = await supabase
      .from('setlists')
      .insert([payload])
      .select()
      .single()
    if (error) throw error
    return mapRowToSetlist(data)
  } catch (err: any) {
    if (err?.name === 'AbortError') return null
    console.error('Error creating setlist:', err)
    return null
  }
}

export async function updateSetlist(id: number, updates: Partial<Setlist>): Promise<Setlist | null> {
  const payload: any = {}
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.date !== undefined) payload.date = updates.date.toISOString().split('T')[0]
  if (updates.songIds !== undefined) payload.song_ids = updates.songIds
  if (updates.notes !== undefined) payload.notes = updates.notes

  try {
    const { data, error } = await supabase
      .from('setlists')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return mapRowToSetlist(data)
  } catch (err: any) {
    if (err?.name === 'AbortError') return null
    console.error('Error updating setlist:', err)
    return null
  }
}

export async function deleteSetlist(id: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('setlists')
      .delete()
      .eq('id', id)
    if (error) throw error
  } catch (err: any) {
    if (err?.name === 'AbortError') return
    console.error('Error deleting setlist:', err)
  }
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

export async function createFeedback(message: string, userId: string | null): Promise<boolean> {
  const { error } = await supabase.from('feedback').insert({
    message: message.trim(),
    user_id: userId,
  })

  if (error) {
    console.error('Error submitting feedback:', error.message)
    return false
  }
  return true
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
    .maybeSingle()

  if (error) {
    console.warn('Error fetching terms acceptance:', error.message)
    return null
  }
  if (!data?.terms_version || !data?.terms_accepted_at) return null
  return { version: data.terms_version, acceptedAt: data.terms_accepted_at }
}

// ─── Funciones para Premium Interest ──────────────────────────────────────────

export async function registerPremiumInterest(email: string, userId: string | null = null): Promise<{ success: boolean; alreadyRegistered?: boolean }> {
  const { error } = await supabase
    .from('premium_interest')
    .insert({ email, user_id: userId, created_at: new Date().toISOString() })

  if (error) {
    // Código 23505 = unique violation (email ya registrado)
    if (error.code === '23505') return { success: true, alreadyRegistered: true }
    console.error('Error registering premium interest:', error.message)
    return { success: false }
  }
  return { success: true, alreadyRegistered: false }
}
