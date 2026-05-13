import { useState, useCallback } from 'react'
import { searchExternalSongs } from '@/services/genius'
import { db } from '@/db'
import { normalizeSearchText } from '@/services/languageUtils'
import type { GeniusSong } from '@/services/genius'

export interface OnlineSearchResult extends GeniusSong {
  alreadyInLibrary: boolean;
}

export function useOnlineSearch() {
  const [results, setResults] = useState<OnlineSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoading(true)
    setError('')

    try {
      // 1. Buscar en internet
      const externalRes = await searchExternalSongs(query)
      
      // 2. Obtener canciones locales para comparar
      const localSongs = await db.songs.toArray()
      
      // 3. Cruzar datos con normalización
      const mappedResults: OnlineSearchResult[] = externalRes.map(ext => {
        const extTitleNorm = normalizeSearchText(ext.title)
        const extArtistNorm = normalizeSearchText(ext.artist)
        
        const exists = localSongs.some(loc => 
          normalizeSearchText(loc.title) === extTitleNorm && 
          normalizeSearchText(loc.artist) === extArtistNorm
        )
        
        return { ...ext, alreadyInLibrary: exists }
      })

      setResults(mappedResults)
      if (mappedResults.length === 0) {
        setError('No se encontraron resultados en internet.')
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Error al buscar online. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }, [])

  return { results, loading, error, search, setResults }
}
