export interface GeniusSong {
  id: number
  title: string
  artist: string
  url: string
  thumbnailUrl?: string
}

export async function searchSongs(query: string): Promise<GeniusSong[]> {
  try {
    const res = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`,
      { headers: { 'Lrclib-Client': 'Proclama/1.0' } }
    )
    if (!res.ok) return []
    const data: any[] = await res.json()
    const seen = new Set<string>()
    return data
      .filter(item => {
        const key = `${item.trackName}|${item.artistName}`.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map(item => ({
        id: item.id,
        title: item.trackName ?? '',
        artist: item.artistName ?? '',
        url: '',
        thumbnailUrl: undefined
      }))
      .slice(0, 15)
  } catch {
    return []
  }
}

export async function fetchLyrics(artist: string, title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
      { headers: { 'Lrclib-Client': 'Proclama/1.0' } }
    )
    if (res.ok) {
      const data = await res.json()
      const lyrics = data.plainLyrics || stripTimestamps(data.syncedLyrics)
      if (lyrics) return lyrics
    }
    const results = await searchSongs(`${artist} ${title}`)
    if (results.length === 0) return null
    const res2 = await fetch(
      `https://lrclib.net/api/get/${results[0].id}`,
      { headers: { 'Lrclib-Client': 'Proclama/1.0' } }
    )
    if (!res2.ok) return null
    const data2 = await res2.json()
    return data2.plainLyrics || stripTimestamps(data2.syncedLyrics) || null
  } catch {
    return null
  }
}

function stripTimestamps(synced: string | null | undefined): string {
  if (!synced) return ''
  return synced.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim()
}