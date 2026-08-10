import { cleanLyricsText } from '@/services/lyricsParser'

/** Una entrada cruda del endpoint /api/search de lrclib.net. */
export interface LrclibTrack {
  id: number
  trackName: string
  artistName: string
  albumName?: string
  duration?: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

/** Un resultado ya limpio, deduplicado y listo para pintar. */
export interface LyricsResult {
  id: number
  title: string
  artist: string
  lyrics: string
  /** El artista aparece en el catálogo comunitario. Solo afecta al orden. */
  knownArtist: boolean
  /** Ya existe en la Dexie del usuario. Lo rellena el hook, no el pipeline. */
  alreadyInLibrary: boolean
}

const SUFIJO_VERSION = /\((en vivo|live|acustico|acoustic|en directo)\)/g
const ARTISTA_SECUNDARIO = /\bfeat\b|\bft\b|\bcon\b|[,•&]/
// Se come los espacios de detrás: si no, cada línea queda indentada.
const TIMESTAMP = /\[\d{2}:\d{2}[.:]\d{2,3}\][ \t]*/g

/**
 * Clave de comparación para deduplicar.
 *
 * Conserva los espacios a propósito: hacen falta para cortar en `feat`/`con`
 * por límite de palabra. Por eso no sirve `normalizeSearchText()` de
 * languageUtils, que los elimina.
 *
 * lrclib devuelve el mismo artista en cuatro formas («Miel San Marcos»,
 * «… feat. Marco Barrientos», «… • Marco Barrientos», «…, Marco Barrientos»).
 * Sin quedarse con el artista principal, la deduplicación no llega a nada.
 */
export function dedupeKey(raw: string): string {
  return (raw || '')
    .split('|')[0]                     // títulos de YouTube: «X | VIDEO OFICIAL | Y»
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // tildes
    .replace(SUFIJO_VERSION, '')       // para proyectar, en vivo y estudio son lo mismo
    .split(ARTISTA_SECUNDARIO)[0]
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Letra utilizable, o cadena vacía si no hay ninguna. */
export function extractLyrics(track: LrclibTrack): string {
  const crudo = track.plainLyrics || (track.syncedLyrics || '').replace(TIMESTAMP, '')
  return cleanLyricsText(crudo)
}

/** Título presentable: sin la cola de YouTube, sin comillas, sin gritos. */
export function cleanTitle(raw: string): string {
  const base = (raw || '').split('|')[0].replace(/["']/g, '').replace(/\s+/g, ' ').trim()
  const letras = base.replace(/[^\p{L}]/gu, '')
  if (letras.length > 3 && letras === letras.toUpperCase()) {
    return base.toLowerCase().replace(/(^|\s)\p{L}/gu, c => c.toUpperCase())
  }
  return base
}

/**
 * Convierte la respuesta cruda de lrclib en la lista que ve el usuario.
 * `knownArtists` son claves ya pasadas por dedupeKey.
 */
export function buildResults(tracks: LrclibTrack[], knownArtists: Set<string>): LyricsResult[] {
  // 1. Fuera instrumentales y lo que se queda sin letra utilizable.
  const conLetra = tracks
    .filter(t => !t.instrumental)
    .map(t => ({ track: t, lyrics: extractLyrics(t) }))
    .filter(x => x.lyrics.length > 0)

  // 2. Fuera registros malformados (artistName es en realidad el título), pero
  //    solo si otra entrada cubre ese mismo título: si es el único resultado,
  //    vale más uno feo que ninguno.
  const porTitulo = new Map<string, number>()
  for (const x of conLetra) {
    const k = dedupeKey(x.track.trackName)
    porTitulo.set(k, (porTitulo.get(k) ?? 0) + 1)
  }
  const limpios = conLetra.filter(x => {
    const kt = dedupeKey(x.track.trackName)
    const ka = dedupeKey(x.track.artistName)
    return !(kt === ka && (porTitulo.get(kt) ?? 0) > 1)
  })

  // 3. Deduplicar. De cada grupo gana la letra más larga.
  const mejores = new Map<string, { track: LrclibTrack; lyrics: string }>()
  for (const x of limpios) {
    const k = `${dedupeKey(x.track.trackName)}|${dedupeKey(x.track.artistName)}`
    const previo = mejores.get(k)
    if (!previo || x.lyrics.length > previo.lyrics.length) mejores.set(k, x)
  }

  // 4. Map conserva el orden de inserción, así que dentro de cada bloque se
  //    respeta el orden que dio lrclib.
  const resultados: LyricsResult[] = [...mejores.values()].map(x => ({
    id: x.track.id,
    title: cleanTitle(x.track.trackName),
    artist: cleanTitle(x.track.artistName),
    lyrics: x.lyrics,
    knownArtist: knownArtists.has(dedupeKey(x.track.artistName)),
    alreadyInLibrary: false,
  }))

  return [
    ...resultados.filter(r => r.knownArtist),
    ...resultados.filter(r => !r.knownArtist),
  ]
}
