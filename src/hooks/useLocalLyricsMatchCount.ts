import { useEffect, useRef, useState } from 'react'
import { db } from '@/db'
import { containsIgnoreAccents } from '@/utils/text'
import type { Song } from '@/types'

/**
 * Cuántas canciones de la biblioteca local coinciden con `query`, mirando
 * título, artista y letra completa — igual que el filtro de `LibraryView`
 * (`src/pages/LibraryView.tsx` alrededor de la línea 292), para no dar un
 * número más bajo del que el usuario vería si pegara el mismo texto ahí.
 */
export function countLocalLyricsMatches(query: string, songs: Song[]): number {
  return songs.filter(s =>
    containsIgnoreAccents(s.title, query) ||
    containsIgnoreAccents(s.artist || '', query) ||
    containsIgnoreAccents(s.lyrics, query)
  ).length
}

/**
 * Recuento de coincidencias locales para el estado vacío del buscador online.
 *
 * Solo se calcula mientras `enabled` es true: leer toda la biblioteca de
 * Dexie es caro (hay una nota de rendimiento abierta sobre eso), así que no
 * tiene sentido hacerlo en cada tecleo, solo cuando internet ya dio cero
 * resultados y el usuario necesita saber si su biblioteca sí los tiene.
 *
 * Ignora respuestas fuera de orden: si `query` cambia mientras el conteo
 * anterior sigue en vuelo, ese resultado se descarta al llegar en vez de
 * pintarse encima del recuento de la búsqueda nueva (la misma clase de
 * carrera que ya causó un bug en este modal con los resultados de lrclib).
 */
export function useLocalLyricsMatchCount(query: string, enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(null)
  const vigente = useRef(0)

  useEffect(() => {
    if (!enabled || !query) {
      setCount(null)
      return
    }

    const propio = ++vigente.current
    setCount(null)

    db.songs.toArray().then(songs => {
      if (vigente.current === propio) setCount(countLocalLyricsMatches(query, songs))
    })
  }, [query, enabled])

  return count
}
