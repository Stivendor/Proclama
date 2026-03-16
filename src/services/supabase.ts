import { createClient } from '@supabase/supabase-js'
import type { Song } from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase config missing. Check .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

type SupabaseSongRow = {
  id: number
  church_id: string
  title: string
  artist: string | null
  lyrics: string | null
  key: string | null
  tags: string[] | null
  language: string | null
  source_url?: string | null
  usage_count: number | null
  created_at: string | null
  updated_at: string | null
}

function mapRowToSong(row: SupabaseSongRow): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist ?? '',
    lyrics: row.lyrics ?? '',
    key: row.key ?? '',
    tags: row.tags ?? [],
    language: row.language ?? 'Español',
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
    source_url: song.sourceUrl ?? null,
    usage_count: song.usageCount,
    updated_at: song.updatedAt.toISOString()
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
    ...(updates.sourceUrl !== undefined && { source_url: updates.sourceUrl }),
    ...(updates.usageCount !== undefined && { usage_count: updates.usageCount }),
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
export async function fetchSetlists() {
  const { data, error } = await supabase
    .from('setlists')
    .select('*')
    .order('date', { ascending: false })
  
  if (error) console.error('Error fetching setlists:', error)
  return data || []
}

export async function createSetlist(setlist: any) {
  const { data, error } = await supabase
    .from('setlists')
    .insert([setlist])
    .select()
  
  if (error) console.error('Error creating setlist:', error)
  return data?.[0] || null
}

export async function updateSetlist(id: number, updates: any) {
  const { data, error } = await supabase
    .from('setlists')
    .update(updates)
    .eq('id', id)
    .select()
  
  if (error) console.error('Error updating setlist:', error)
  return data?.[0] || null
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
