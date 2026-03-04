/**
 * Servicio para buscar e importar letras desde Genius API.
 * Requiere un token de acceso de https://genius.com/api-clients
 */

export interface GeniusSong {
  id: number
  title: string
  artist: string
  url: string
  thumbnailUrl?: string
}

/**
 * Busca canciones en Genius por título/artista.
 * Usa el proxy de Genius para evitar CORS (en producción usar un backend proxy).
 */
export async function searchGenius(
  query: string,
  token: string
): Promise<GeniusSong[]> {
  const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!response.ok) throw new Error(`Genius API error: ${response.status}`)

  const data = await response.json()
  const hits = data.response?.hits ?? []

  return hits
    .filter((h: any) => h.type === 'song')
    .map((h: any) => ({
      id: h.result.id,
      title: h.result.title,
      artist: h.result.primary_artist?.name ?? '',
      url: h.result.url,
      thumbnailUrl: h.result.song_art_image_thumbnail_url
    }))
    .slice(0, 10)
}

/**
 * Obtiene la letra de una canción de Genius scrapeando la página HTML.
 * NOTA: Genius no expone la letra completa en su API REST pública.
 * Se usa un servicio proxy (lyrics.ovh) como alternativa sin CORS.
 */
export async function fetchLyrics(
  artist: string,
  title: string
): Promise<string | null> {
  try {
    // lyrics.ovh es una API gratuita de letras sin clave de API
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json()
    return data.lyrics ?? null
  } catch {
    return null
  }
}

/**
 * Busca letras directamente en lyrics.ovh (no requiere token).
 */
export async function searchLyricsOvh(query: string): Promise<GeniusSong[]> {
  try {
    const url = `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`
    const response = await fetch(url)
    if (!response.ok) return []
    const data = await response.json()
    return (data.data ?? []).map((item: any) => ({
      id: item.id,
      title: item.title,
      artist: item.artist?.name ?? '',
      url: '',
      thumbnailUrl: item.album?.cover_small
    }))
  } catch {
    return []
  }
}
