/**
 * Servicio de letras — usa múltiples fuentes con fallback automático.
 * No requiere tokens ni tiene problemas de CORS.
 *
 * Fuentes (en orden de prioridad):
 * 1. lrclib.net   — gratuita, sin token, excelente cobertura, sin CORS
 * 2. lyrics.ovh   — fallback (a veces funciona)
 */

export interface GeniusSong {
  id: number
  title: string
  artist: string
  url: string
  thumbnailUrl?: string
}

// ─── lrclib.net ───────────────────────────────────────────────────────────────

export async function searchLrcLib(query: string): Promise<GeniusSong[]> {
  try {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { 'Lrclib-Client': 'Proclama/1.0' } })
    if (!res.ok) return []
    const data: any[] = await res.json()
    // Deduplicar por título+artista
    const seen = new Set<string>()
    return data
      .filter(item => {
        const key = `${item.trackName}|${item.artistName}`.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((item, i) => ({
        id: item.id ?? i,
        title: item.trackName ?? '',
        artist: item.artistName ?? '',
        url: '',
        thumbnailUrl: undefined
      }))
      .slice(0, 12)
  } catch {
    return []
  }
}

export async function fetchLyricsLrcLib(
  artist: string,
  title: string
): Promise<string | null> {
  try {
    // Búsqueda exacta primero
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
    const res = await fetch(url, { headers: { 'Lrclib-Client': 'Proclama/1.0' } })
    if (res.ok) {
      const data = await res.json()
      // Preferir letra plana (sin timestamps) sobre letra sincronizada
      const lyrics = data.plainLyrics || stripTimestamps(data.syncedLyrics)
      if (lyrics) return lyrics
    }
    // Si no encontró exacto, buscar y tomar el primero
    const results = await searchLrcLib(`${artist} ${title}`)
    if (results.length === 0) return null
    return fetchLyricsById(results[0].id)
  } catch {
    return null
  }
}

async function fetchLyricsById(id: number): Promise<string | null> {
  try {
    const res = await fetch(`https://lrclib.net/api/get/${id}`, {
      headers: { 'Lrclib-Client': 'Proclama/1.0' }
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.plainLyrics || stripTimestamps(data.syncedLyrics) || null
  } catch {
    return null
  }
}

function stripTimestamps(synced: string | null | undefined): string {
  if (!synced) return ''
  // Elimina timestamps tipo [00:12.34]
  return synced.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim()
}

// ─── lyrics.ovh (fallback) ────────────────────────────────────────────────────

export async function searchLyricsOvh(query: string): Promise<GeniusSong[]> {
  try {
    const url = `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.data ?? []).map((item: any, i: number) => ({
      id: item.id ?? i,
      title: item.title ?? '',
      artist: item.artist?.name ?? '',
      url: '',
      thumbnailUrl: item.album?.cover_small
    }))
  } catch {
    return []
  }
}

export async function fetchLyricsOvh(
  artist: string,
  title: string
): Promise<string | null> {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data.lyrics ?? null
  } catch {
    return null
  }
}

// ─── Función principal con fallback automático ────────────────────────────────

/**
 * Busca canciones combinando lrclib + lyrics.ovh.
 * Deduplicados y ordenados por relevancia.
 */
export async function searchSongs(query: string): Promise<GeniusSong[]> {
  const [lrc, ovh] = await Promise.allSettled([
    searchLrcLib(query),
    searchLyricsOvh(query)
  ])

  const lrcResults = lrc.status === 'fulfilled' ? lrc.value : []
  const ovhResults = ovh.status === 'fulfilled' ? ovh.value : []

  // Merge sin duplicados (por título+artista)
  const seen = new Set<string>()
  const merged: GeniusSong[] = []
  for (const s of [...lrcResults, ...ovhResults]) {
    const key = `${s.title}|${s.artist}`.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(s)
    }
  }
  return merged.slice(0, 15)
}

/**
 * Obtiene la letra con fallback automático: lrclib → lyrics.ovh
 */
export async function fetchLyrics(
  artist: string,
  title: string
): Promise<string | null> {
  const lyrics = await fetchLyricsLrcLib(artist, title)
  if (lyrics) return lyrics
  return fetchLyricsOvh(artist, title)
}
