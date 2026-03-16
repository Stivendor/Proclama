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
    churchId: row.church_id,
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
    church_id: song.churchId,
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

// ─── Funciones para Iglesias (Churches) ────────────────────────────────────
export async function fetchChurchByCode(code: string) {
  const { data, error } = await supabase
    .from('churches')
    .select('id, code, name, created_at')
    .eq('code', code.toUpperCase())
    .single()
  
  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching church:', error)
    }
    return null
  }
  return data
}

// ─── Funciones para Songs ──────────────────────────────────────────────────
export async function fetchSongs(churchId: string): Promise<Song[]> {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('church_id', churchId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching songs:', error)
    return []
  }
  return (data as SupabaseSongRow[]).map(mapRowToSong)
}

/**
 * Busca canciones por texto en título, artista o letra.
 * Utiliza búsqueda de texto completo para mayor precisión.
 */
export async function searchSongs(query: string, churchId: string): Promise<Song[]> {
  if (!query) return fetchSongs(churchId)

  // Búsqueda simple por ILIKE en título/artista y Full Text Search en lyrics
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('church_id', churchId)
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

export async function updateSong(id: number, churchId: string, updates: Partial<Omit<Song, 'id'>>): Promise<Song | null> {
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
    .eq('church_id', churchId)
    .select()
    .single()

  if (error) {
    console.error('Error updating song in Supabase:', error.message)
    return null
  }
  return mapRowToSong(data as SupabaseSongRow)
}

export async function deleteSong(id: number, churchId: string) {
  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('id', id)
    .eq('church_id', churchId)

  if (error) console.error('Error deleting song:', error)
}

// ─── Funciones para Setlists ──────────────────────────────────────────────
export async function fetchSetlists(churchId: string) {
  const { data, error } = await supabase
    .from('setlists')
    .select('*')
    .eq('church_id', churchId)
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

export async function updateSetlist(id: number, churchId: string, updates: any) {
  const { data, error } = await supabase
    .from('setlists')
    .update(updates)
    .eq('id', id)
    .eq('church_id', churchId)
    .select()
  
  if (error) console.error('Error updating setlist:', error)
  return data?.[0] || null
}

export async function deleteSetlist(id: number, churchId: string) {
  const { error } = await supabase
    .from('setlists')
    .delete()
    .eq('id', id)
    .eq('church_id', churchId)
  
  if (error) console.error('Error deleting setlist:', error)
}

// ─── Funciones para Settings ──────────────────────────────────────────────
export async function fetchSettings(churchId: string) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('church_id', churchId)
    .single()
  
  if (error) console.warn('No settings found:', error)
  return data || null
}

export async function updateSettings(churchId: string, updates: any) {
  const { data, error } = await supabase
    .from('app_settings')
    .update(updates)
    .eq('church_id', churchId)
    .select()
  
  if (error) console.error('Error updating settings:', error)
  return data?.[0] || null
}
