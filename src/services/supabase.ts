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
    user_id: setlist.userId,
    song_ids: setlist.songIds,
    notes: setlist.notes || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
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
  const payload: any = { updated_at: new Date().toISOString() }
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

// ─── Funciones para Attendance Records ────────────────────────────────────────

function normalizePgDate(d: string): string {
  return d.length >= 10 ? d.slice(0, 10) : d
}

type SupabaseAttendanceRow = {
  id: string
  user_id: string
  date: string
  service_name: string | null
  caballeros: number
  damas: number
  amigos: number
  ninos: number
  updated_at: string
}

function mapRowToAttendanceRecord(row: SupabaseAttendanceRow, userId: string): AttendanceRecord {
  return {
    remoteId: row.id,
    userId,
    date: normalizePgDate(row.date),
    serviceName: row.service_name ?? undefined,
    caballeros: row.caballeros,
    damas: row.damas,
    amigos: row.amigos,
    ninos: row.ninos,
    createdAt: row.updated_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Upsert en `attendance_records`.
 * `userId` debe ser el mismo que `auth.uid()` en la petición (p. ej. de una sola `getSession()` en la UI).
 * No llama a `getSession()` aquí para evitar contención del lock de GoTrue (Strict Mode / OAuth).
 */
export async function upsertAttendance(
  userId: string,
  date: string,
  attendance: AttendanceBreakdown,
  serviceName?: string,
  /** Si el upsert no devuelve fila pero ya teníamos id local, se acepta. */
  existingRemoteId?: string
): Promise<{ remoteId: string }> {
  const payload = {
    user_id: userId,
    date,
    service_name: serviceName ?? null,
    caballeros: attendance.caballeros,
    damas: attendance.damas,
    amigos: attendance.amigos,
    ninos: attendance.ninos,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('attendance_records')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select('id')

  if (error) {
    const msg = [error.message, error.details, error.hint].filter(Boolean).join(' — ')
    console.error('Error upserting attendance:', msg)
    throw new Error(msg || 'No se pudo guardar la asistencia en el servidor.')
  }

  const rows = Array.isArray(data) ? data : data != null ? [data] : []
  let id = rows[0]?.id as string | undefined

  if (!id) {
    const { data: fetched, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()
    if (fetchErr) {
      throw new Error(fetchErr.message || 'No se pudo confirmar la asistencia en el servidor.')
    }
    id = fetched?.id as string | undefined
  }

  if (id) return { remoteId: id }
  if (existingRemoteId) return { remoteId: existingRemoteId }
  throw new Error(
    'El servidor no devolvió el id del registro. Revisa en Supabase que exista la tabla attendance_records y políticas RLS para tu usuario.'
  )
}

export async function fetchAllAttendanceRecords(userId: string): Promise<AttendanceRecord[]> {
  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('id, date, service_name, caballeros, damas, amigos, ninos, updated_at')
      .eq('user_id', userId)
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching attendance records:', error.message)
      return []
    }
    return (data as SupabaseAttendanceRow[]).map(row => mapRowToAttendanceRecord(row, userId))
  } catch (err: any) {
    if (err?.name === 'AbortError') return [] // React Strict Mode — inofensivo
    console.error('Error fetching attendance records:', err)
    return []
  }
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
    // Asistencia vive solo en `attendance_records`; la columna legacy se ignora al mapear.
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

export async function fetchAllChurchNotes(userId: string): Promise<ChurchNote[]> {
  const { data, error } = await supabase
    .from('church_notes')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching all church notes:', error.message)
    return []
  }
  return (data as SupabaseChurchNoteRow[]).map(mapRowToChurchNote)
}

/** Filas crudas para migración (incluye `attendance` legacy en `church_notes`). */
export async function fetchAllChurchNotesRaw(userId: string): Promise<SupabaseChurchNoteRow[]> {
  const { data, error } = await supabase
    .from('church_notes')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching raw church notes:', error.message)
    return []
  }
  return (data ?? []) as SupabaseChurchNoteRow[]
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

/** `note.userId` debe coincidir con la sesión (pasar uid desde una sola `getSession()` en la UI). */
export async function upsertChurchNote(note: ChurchNote): Promise<ChurchNote> {
  const payload = {
    ...(note.remoteId && { id: note.remoteId }),
    user_id: note.userId,
    date: note.date,
    attendance: null,
    notices: note.notices,
    created_at: note.createdAt,
    updated_at: note.updatedAt
  }

  const { data, error } = await supabase
    .from('church_notes')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()

  if (error) {
    const msg = [error.message, error.details, error.hint].filter(Boolean).join(' — ')
    console.error('Error upserting church note:', msg)
    throw new Error(msg || 'No se pudieron guardar los avisos en el servidor.')
  }

  const rows = Array.isArray(data) ? data : data != null ? [data] : []
  let row = rows[0] as SupabaseChurchNoteRow | undefined

  if (!row) {
    const { data: fetched, error: fetchErr } = await supabase
      .from('church_notes')
      .select('*')
      .eq('user_id', note.userId)
      .eq('date', note.date)
      .maybeSingle()
    if (fetchErr || !fetched) {
      throw new Error(
        fetchErr?.message ||
        'No se pudo confirmar el guardado de avisos. Comprueba la tabla church_notes y RLS en Supabase.'
      )
    }
    row = fetched as SupabaseChurchNoteRow
  }

  return mapRowToChurchNote(row)
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
