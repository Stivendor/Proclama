const CHRISTIAN_ARTISTS = [
  // ─── IPUC y Pentecostal colombiano ───
  'ipuc', 'ministerio ipuc', 'coro ipuc', 'voces ipuc',
  'pastor wilson', 'avivamiento', 'renuevo',
  'generación de paz', 'fuego pentecostal',

  // ─── Pentecostal latinoamericano ───
  'miel san marcos', 'marcos witt', 'coalo zamorano',
  'generación 12', 'ingrid rosario', 'christine d\'clario',
  'evan craft', 'twice estefano', 'redimi2', 'alex zurdo',
  'funky', 'rescate', 'tercer cielo', 'jesús adrián romero',
  'aliento', 'danilo montero', 'samuel hernández',
  'jacobo ramos', 'elevation español', 'hillsong en español',
  'new wine español', 'canal de adoración', 'remik gonzález',
  'canciones de vida', 'ministerio apasionado', 'musica cristiana',

  // ─── Pentecostal / carismático internacional ───
  'hillsong', 'hillsong united', 'hillsong worship', 'hillsong young & free',
  'elevation worship', 'bethel music', 'bethel worship',
  'maverick city music', 'jesus culture', 'planet shakers',
  'gateway worship', 'cross point music', 'life.church worship',
  'kari jobe', 'chris tomlin', 'phil wickham', 'crowder',
  'lauren daigle', 'cody carnes', 'pat barrett',
  'steffany gretzinger', 'amanda cook', 'brian johnson',
  'jenn johnson', 'william mcdowell', 'tasha cobbs leonard',
  'israel houghton', 'ron kenoly', 'don moen', 'paul baloche',
  'darlene zschech', 'michael w. smith', 'amy grant',

  // ─── Contemporáneo cristiano general ───
  'casting crowns', 'newsboys', 'tobymac', 'skillet',
  'for king & country', 'switchfoot', 'third day',
  'mercy me', 'david crowder band', 'lecrae',
  'andy mineo', 'trip lee', 'kb', 'propaganda',
  'needtobreathe', 'building 429', 'tenth avenue north',
  'matthew west', 'mark schultz', 'jeremy camp',
  'lincoln brewster', 'vertical worship', 'passion',
  'passion music', 'louie giglio',

  // ─── Himnos y música tradicional ───
  'himno', 'himnario', 'himnos de la fe',
  'hymn', 'hymns', 'gospel',
  'traditional hymn', 'worship hymn',

  // ─── Palabras clave de título (por si el artista no está) ───
  'worship', 'alabanza', 'adoración', 'santísimo',
  'espíritu santo', 'jehová', 'jesucristo',
]

export interface GeniusSong {
  id: number
  title: string
  artist: string
  url: string
  thumbnailUrl?: string
}

export async function searchExternalSongs(query: string): Promise<GeniusSong[]> {
  try {
    const res = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`,
      { headers: { 'Lrclib-Client': 'Proclama/1.0' } }
    )
    if (!res.ok) return []
    const data: any[] = await res.json()
    const seen = new Set<string>()

    const all = data
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

    const christian = all.filter(s =>
      CHRISTIAN_ARTISTS.some(a =>
        s.artist.toLowerCase().includes(a) ||
        s.title.toLowerCase().includes(a)
      )
    )
    const rest = all.filter(s =>
      !CHRISTIAN_ARTISTS.some(a =>
        s.artist.toLowerCase().includes(a) ||
        s.title.toLowerCase().includes(a)
      )
    )

    return [...christian, ...rest].slice(0, 15)
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
    const results = await searchExternalSongs(`${artist} ${title}`)
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