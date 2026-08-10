import { useState, useEffect, useRef } from 'react'
import { searchLrclib, buildResults, titleKey, artistKey } from '@/services/lyricsSearch'
import type { LrclibTrack, LyricsResult } from '@/services/lyricsSearch'
import { fetchCommunityArtists } from '@/services/supabase'
import { db } from '@/db'

const DEBOUNCE_MS = 300
const MIN_CHARS = 3

/**
 * Estado del buscador online.
 *
 * Los puntos que la v1 no tenía y por los que se sentía lenta: debounce,
 * abort de la petición anterior, caché por query mientras vive el modal, y
 * un único fetch (la letra viene inline en /api/search).
 *
 * La caché guarda la respuesta cruda de lrclib, no los resultados ya
 * construidos: `buildResults` y el cruce con Dexie dependen de la lista de
 * artistas conocidos y de la biblioteca local, que pueden cambiar entre una
 * búsqueda y la siguiente. Cachear el resultado final congelaría ese estado
 * (sin ranking si `fetchCommunityArtists` no había llegado aún, o
 * `alreadyInLibrary` desactualizado tras importar una canción). Repetir una
 * query pasa igual por el debounce; lo único que ahorra la caché es la red.
 */
export function useLyricsSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LyricsResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const cache = useRef(new Map<string, LrclibTrack[]>())
  const artists = useRef<Set<string> | null>(null)
  const abort = useRef<AbortController | null>(null)

  // La lista de artistas se pide una vez y no bloquea: si falla o aún no ha
  // llegado, los resultados salen en el orden de lrclib.
  // La normalización se hace aquí, no en supabase.ts, para no cerrar un ciclo
  // de imports con lyricsSearch.ts.
  useEffect(() => {
    let vivo = true
    fetchCommunityArtists().then(nombres => {
      if (vivo) artists.current = new Set(nombres.map(artistKey))
    })
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    const limpia = query.trim()

    if (limpia.length < MIN_CHARS) {
      abort.current?.abort()
      setResults([])
      setLoading(false)
      setError('')
      return
    }

    setLoading(true)
    setError('')

    const temporizador = setTimeout(async () => {
      abort.current?.abort()
      const ctrl = new AbortController()
      abort.current = ctrl

      try {
        const enCache = cache.current.get(limpia)
        const crudos = enCache ?? await searchLrclib(limpia, ctrl.signal)
        if (!enCache) cache.current.set(limpia, crudos)

        const base = buildResults(crudos, artists.current ?? new Set())

        // Marcar lo que el usuario ya tiene, para no importarlo dos veces.
        const locales = await db.songs.toArray()
        const claves = new Set(locales.map(s => `${titleKey(s.title)}|${artistKey(s.artist || '')}`))
        const marcados = base.map(r => ({
          ...r,
          alreadyInLibrary: claves.has(`${titleKey(r.title)}|${artistKey(r.artist)}`),
        }))

        if (ctrl.signal.aborted) return
        setResults(marcados)
      } catch (err) {
        if (ctrl.signal.aborted || (err as Error)?.name === 'AbortError') return
        setResults([])
        setError(
          navigator.onLine
            ? 'No se pudo completar la búsqueda. Intenta de nuevo.'
            : 'Sin conexión.'
        )
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(temporizador)
      // El cleanup corre al cambiar la query y al desmontar. En ambos casos la
      // petición anterior ya no le sirve a nadie: si no se aborta aquí, una
      // respuesta tardía puede pintarse sobre resultados más nuevos (incluida
      // la rama de caché, que ahora también pasa por este mismo camino) o
      // actualizar un componente ya desmontado.
      abort.current?.abort()
    }
  }, [query])

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    empty: query.trim().length >= MIN_CHARS && !loading && !error && results.length === 0,
  }
}
