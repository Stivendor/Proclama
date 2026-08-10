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
// En un titulo, feat/ft son metadatos; con, la coma, bullet y ampersand son parte del
// titulo en espanol. Cortar por ellos fusionaria canciones distintas
// (Con Todo Mi Ser, Ven Espiritu Santo, Santo Santo Santo).
const COLABORACION = /\(?\b(feat|ft)\b.*$/
// Se come los espacios de detrás: si no, cada línea queda indentada.
const TIMESTAMP = /\[\d{2}:\d{2}[.:]\d{2,3}\][ \t]*/g

/** Normalización común a título y artista: primer `|`, minúsculas, sin tildes, sin sufijo de versión. */
function baseKey(raw: string): string {
  return (raw || '')
    .split('|')[0]                     // títulos de YouTube: «X | VIDEO OFICIAL | Y»
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // tildes
    .replace(SUFIJO_VERSION, '')       // para proyectar, en vivo y estudio son lo mismo
}

/** Limpieza final común: solo alfanumérico y espacios simples. */
function finalize(texto: string): string {
  return texto
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Clave de artista para deduplicar y para comparar con el catálogo conocido.
 *
 * Conserva los espacios a propósito: hacen falta para cortar en `feat`/`con`
 * por límite de palabra. Por eso no sirve `normalizeSearchText()` de
 * languageUtils, que los elimina.
 *
 * lrclib devuelve el mismo artista en cuatro formas («Miel San Marcos»,
 * «… feat. Marco Barrientos», «… • Marco Barrientos», «…, Marco Barrientos»).
 * Sin quedarse con el artista principal, la deduplicación no llega a nada.
 *
 * También la usa `useLyricsSearch` para normalizar nombres de artista sueltos
 * que vienen del catálogo, antes de compararlos con `knownArtists`.
 */
export function artistKey(raw: string): string {
  return finalize(baseKey(raw).split(ARTISTA_SECUNDARIO)[0])
}

/**
 * Clave de título para deduplicar.
 *
 * A diferencia de `artistKey`, solo corta metadatos de colaboración
 * (`feat`/`ft`): `con`, la coma, `•` y `&` son parte legítima de muchos
 * títulos en español y no deben tratarse como separadores.
 */
export function titleKey(raw: string): string {
  return finalize(baseKey(raw).replace(COLABORACION, ''))
}

/**
 * Un registro malformado es aquel cuyo `artistName` es una copia del
 * `trackName` — típicamente un título de YouTube volcado en los dos campos.
 *
 * Compara los dos campos con la MISMA normalización a propósito. Usar
 * `titleKey` en uno y `artistKey` en el otro rompe la simetría: para un
 * título con coma, `artistKey` corta donde `titleKey` no, las claves
 * difieren y la basura se cuela.
 */
function esMalformado(track: LrclibTrack): boolean {
  return finalize(baseKey(track.trackName)) === finalize(baseKey(track.artistName))
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
 * `knownArtists` son claves ya pasadas por artistKey.
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
    const k = titleKey(x.track.trackName)
    porTitulo.set(k, (porTitulo.get(k) ?? 0) + 1)
  }
  const limpios = conLetra.filter(x => {
    const kt = titleKey(x.track.trackName)
    return !(esMalformado(x.track) && (porTitulo.get(kt) ?? 0) > 1)
  })

  // 3. Deduplicar. De cada grupo gana la letra más larga.
  const mejores = new Map<string, { track: LrclibTrack; lyrics: string }>()
  for (const x of limpios) {
    const k = `${titleKey(x.track.trackName)}|${artistKey(x.track.artistName)}`
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
    knownArtist: knownArtists.has(artistKey(x.track.artistName)),
    alreadyInLibrary: false,
  }))

  return [
    ...resultados.filter(r => r.knownArtist),
    ...resultados.filter(r => !r.knownArtist),
  ]
}

const LRCLIB_URL = 'https://lrclib.net/api/search'
/** lrclib no tiene rate limit, pero una petición colgada bloquea el modal. */
const TIMEOUT_MS = 6000

/**
 * Combina la señal de quien llama con un vencimiento propio.
 *
 * `AbortSignal.any` es de 2024 (Safari 17.4, Firefox 124): en un iPad viejo de
 * iglesia, que es justo el público de esta app, no existe y `searchLrclib`
 * lanzaría en la primera línea siempre, sin degradar. Si no está disponible,
 * se combina a mano con un AbortController propio, sin depender tampoco de
 * `AbortSignal.timeout` (misma familia de API, mismo riesgo de ausencia).
 */
function combinarSenales(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; limpiar: () => void } {
  if (typeof AbortSignal.any === 'function') {
    const timeout = AbortSignal.timeout(timeoutMs)
    const combinado = signal ? AbortSignal.any([signal, timeout]) : timeout
    return { signal: combinado, limpiar: () => {} }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort)
  return {
    signal: ctrl.signal,
    limpiar: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

/**
 * Un único fetch por búsqueda: /api/search ya devuelve `plainLyrics` inline,
 * así que elegir un resultado no vuelve a tocar la red. La v1 hacía un segundo
 * viaje a /api/get y por eso se sentía lenta.
 */
export async function searchLrclib(query: string, signal?: AbortSignal): Promise<LrclibTrack[]> {
  const { signal: combinado, limpiar } = combinarSenales(signal, TIMEOUT_MS)
  try {
    const res = await fetch(`${LRCLIB_URL}?q=${encodeURIComponent(query)}`, {
      headers: { 'Lrclib-Client': 'Proclama/2.0 (https://proclama.lat)' },
      signal: combinado,
    })
    if (!res.ok) throw new Error(`lrclib respondió ${res.status}`)
    return (await res.json()) as LrclibTrack[]
  } finally {
    limpiar()
  }
}
