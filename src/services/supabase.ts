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
    remoteId: row.id,
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
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  const userId = user?.id

  const allData: SupabaseSongRow[] = []
  let from = 0
  const step = 1000

  while (true) {
    let query = supabase.from('songs').select('*')

    if (userId) {
      query = query.or(`user_id.eq.${userId},is_public.eq.true`)
    } else {
      query = query.eq('is_public', true)
    }

    query = query.range(from, from + step - 1)
      .order('created_at', { ascending: false })

    const { data, error } = await query

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

export async function fetchSongsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('songs')
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.warn('Error fetching songs count:', error.message)
    return 0
  }

  return count ?? 0
}

function sanitizeSearchTerm(query: string): string {
  return query
    .trim()
    .slice(0, 80)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
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
  const safeQuery = sanitizeSearchTerm(query)
  if (!safeQuery) return []

  let request = supabase
    .from('songs')
    .select('*')
    .or(`title.ilike.%${safeQuery}%,artist.ilike.%${safeQuery}%,lyrics.fts.${safeQuery}`)
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
  const { data: { session }, error: userError } = await supabase.auth.getSession();
  const user = session?.user;
  if (userError) {
    console.error('Error resolving authenticated user for update:', userError.message)
    return null
  }
  if (!user) {
    return null
  }

  // Verificar si es admin para decidir si filtrar por user_id
  const profile = await fetchProfile(user.id)
  const isAdmin = profile?.role === 'admin'

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

  let query = supabase.from('songs').update(payload).eq('id', id)

  // Si no es admin, solo puede editar sus propias canciones
  if (!isAdmin) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query.select().single()

  if (error) {
    console.error('Error updating song in Supabase:', error.message)
    return null
  }
  return mapRowToSong(data as SupabaseSongRow)
}

export async function deleteSong(id: number): Promise<boolean> {
  const { data: { session }, error: userError } = await supabase.auth.getSession();
  const user = session?.user;
  if (userError || !user) {
    console.error('User not authenticated for delete')
    return false
  }

  const profile = await fetchProfile(user.id)
  const isAdmin = profile?.role === 'admin'

  // Borrar reportes asociados para evitar error de llave foránea
  let reportQuery = supabase.from('song_reports').delete().eq('song_id', id)
  if (!isAdmin) {
    reportQuery = reportQuery.eq('user_id', user.id)
  }
  await reportQuery

  let query = supabase.from('songs').delete().eq('id', id)

  // Si no es admin, solo puede borrar sus propias canciones
  if (!isAdmin) {
    query = query.eq('user_id', user.id)
  }

  const { error } = await query

  if (error) {
    console.error('Error deleting song:', error)
    return false
  }
  return true
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
  const { data: { session }, error: userError } = await supabase.auth.getSession();
  const user = session?.user;
  if (userError || !user) return []

  try {
    const { data, error } = await supabase
      .from('setlists')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    if (error) throw error
    return (data || []).map(mapRowToSetlist)
  } catch (err: any) {
    if (err?.name === 'AbortError') return []
    console.error('[Setlists] Error al obtener:', err)
    return []
  }
}

export async function createSetlist(setlist: Omit<Setlist, 'id'>): Promise<Setlist | null> {
  console.log('[Setlists] Iniciando creación...', { userId: setlist.userId })
  const now = new Date().toISOString()
  const payload = {
    name: setlist.name,
    date: setlist.date.toISOString().split('T')[0],
    user_id: setlist.userId,
    notes: setlist.notes || '',
    song_ids: setlist.songIds || [],
    created_at: now,
    updated_at: now
  }
  try {
    const { data, error } = await supabase
      .from('setlists')
      .insert([payload])
      .select()
      .single()
    if (error) throw error
    console.log('[Setlists] Creación exitosa')
    return mapRowToSetlist(data)
  } catch (err: any) {
    if (err?.name === 'AbortError') return null
    console.error('[Setlists] Error al crear:', err)
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
  console.log('[Feedback] Iniciando envío...', { userId })
  const { error } = await supabase.from('feedback').insert({
    message: message.trim(),
    user_id: userId,
  })

  if (error) {
    console.error('[Feedback] Error al enviar:', error.message)
    return false
  }
  console.log('[Feedback] Envío exitoso')
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

// ─── Funciones para Pagos ───────────────────────────────────────────────────

export async function activatePremiumForUser(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({
      plan: 'premium',
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) {
    console.error('Error activating premium:', error.message)
    return false
  }
  return true
}

export async function deactivatePremiumForUser(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({
      plan: 'free',
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)

  if (error) {
    console.error('Error deactivating premium:', error.message)
    return false
  }
  return true
}

export async function isUserPremium(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return false

  const { data, error } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) return false
  return data.plan === 'premium'
}

// ─── Funciones para Device Control ────────────────────────────────────────────

export type UserDevice = {
  id: string
  deviceId: string
  deviceName: string
  lastSeen: string
  createdAt: string
  isCurrent?: boolean
}

/**
 * Registra o actualiza el dispositivo actual mediante upsert.
 * Devuelve la lista actualizada de dispositivos del usuario (con isCurrent marcado).
 */
export async function registerDevice(
  deviceId: string,
  deviceName: string
): Promise<UserDevice[]> {
  const { data: { session }, error: userError } = await supabase.auth.getSession();
  const user = session?.user;

  if (userError) {
    console.error('[Devices] Error resolving auth user:', userError.message)
    return []
  }

  if (!user) {
    console.warn('[Devices] Skipping device registration: no authenticated user')
    return []
  }

  const { error: upsertError } = await supabase
    .from('user_devices')
    .upsert(
      {
        user_id: user.id,
        device_id: deviceId,
        device_name: deviceName,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' }
    )

  if (upsertError) {
    console.error('[Devices] Error upserting device:', upsertError.message)
    return []
  }

  return fetchUserDevices(deviceId)
}

/**
 * Obtiene todos los dispositivos registrados del usuario autenticado.
 * Marca con isCurrent = true el dispositivo que coincide con currentDeviceId.
 */
export async function fetchUserDevices(currentDeviceId?: string): Promise<UserDevice[]> {
  const { data, error } = await supabase
    .from('user_devices')
    .select('id, device_id, device_name, last_seen, created_at')
    .order('last_seen', { ascending: false })

  if (error) {
    console.warn('[Devices] Error fetching devices:', error.message)
    return []
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    lastSeen: row.last_seen,
    createdAt: row.created_at,
    isCurrent: currentDeviceId ? row.device_id === currentDeviceId : false,
  }))
}

/**
 * Revoca (elimina) un dispositivo por su UUID de fila.
 * El RLS garantiza que el usuario solo puede revocar sus propios dispositivos.
 */
export async function revokeDevice(deviceRowId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_devices')
    .delete()
    .eq('id', deviceRowId)

  if (error) {
    console.error('[Devices] Error revoking device:', error.message)
    return false
  }
  return true
}

/**
 * Actualiza el nombre de un dispositivo.
 */
export async function updateDeviceName(deviceRowId: string, newName: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_devices')
    .update({ device_name: newName })
    .eq('id', deviceRowId)

  if (error) {
    console.error('[Devices] Error updating device name:', error.message)
    return false
  }
  return true
}

type SongReportOptions = {
  timeoutMs?: number
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    clearTimeout(timeoutId)
  })
}

export async function createSongReport(
  songId: number,
  reason: string,
  details: string,
  userId: string | null,
  options: SongReportOptions = {},
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? 10000

  try {
    const { error } = await withTimeout(
      supabase.from('song_reports').insert({
        song_id: songId,
        reason,
        details,
        user_id: userId,
      }),
      timeoutMs,
      'Timeout enviando reporte de cancion',
    )

    if (error) {
      console.error('[SongReport] Error al enviar:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[SongReport] Error al enviar:', err instanceof Error ? err.message : err)
    return false
  }
}

export type SongReport = {
  id: string;
  song_id: number;
  user_id: string | null;
  reason: string;
  details: string;
  created_at: string;
  songs?: {
    title: string;
    artist: string;
  };
};

export async function fetchSongReports(): Promise<SongReport[]> {
  const { data, error } = await supabase
    .from('song_reports')
    .select('*, songs(title, artist)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching song reports:', error);
    return [];
  }
  return data as unknown as SongReport[];
}

export async function fetchSongById(id: number): Promise<Song | null> {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('Error fetching song by ID:', error?.message);
    return null;
  }
  return mapRowToSong(data as SupabaseSongRow);
}
export async function fetchUserSettings(userId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('Error fetching user settings:', error.message)
    return null
  }
  return data?.settings || null
}

export async function updateUserSettings(userId: string, settings: any): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    console.error('Error updating user settings:', error.message)
    return false
  }
  return true
}
