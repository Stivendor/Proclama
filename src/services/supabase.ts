import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase config missing. Check .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Funciones para Songs ──────────────────────────────────────────────────
export async function fetchSongs() {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) console.error('Error fetching songs:', error)
  return data || []
}

export async function createSong(song: any) {
  const { data, error } = await supabase
    .from('songs')
    .insert([song])
    .select()
  
  if (error) console.error('Error creating song:', error)
  return data?.[0] || null
}

export async function updateSong(id: number, updates: any) {
  const { data, error } = await supabase
    .from('songs')
    .update(updates)
    .eq('id', id)
    .select()
  
  if (error) console.error('Error updating song:', error)
  return data?.[0] || null
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
  const { data, error } = await supabase
    .from('app_settings')
    .update(updates)
    .eq('id', 1)
    .select()
  
  if (error) console.error('Error updating settings:', error)
  return data?.[0] || null
}
