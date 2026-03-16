import { useState } from 'react'
import { Search, Download, X, Loader, Music2, Database, Globe } from 'lucide-react'
import { searchSongs as searchOnline, fetchLyrics } from '@/services/genius'
import { searchSongs as searchSupabase } from '@/services/supabase'
import { cleanLyricsText } from '@/services/lyricsParser'
import { db } from '@/db'
import { createSong } from '@/services/supabase'
import type { GeniusSong } from '@/services/genius'
import type { Song } from '@/types'

type SearchResult = {
  id: number
  title: string
  artist: string
  source: 'supabase' | 'online'
  lyrics?: string
  url?: string
  thumbnailUrl?: string
}

export default function OnlineSearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<number | null>(null)
  const [importedLyrics, setImportedLyrics] = useState<{ result: SearchResult; lyrics: string } | null>(null)
  const [error, setError] = useState('')
  const [searchMode, setSearchMode] = useState<'cristiana' | 'todo'>('cristiana')

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults([])
    try {
      // 1. Siempre buscar primero en nuestra base de datos cristiana
      const supabaseResults = await searchSupabase(query)
      const localResults: SearchResult[] = supabaseResults.map(s => ({
        id: s.id!,
        title: s.title,
        artist: s.artist,
        source: 'supabase' as const,
        lyrics: s.lyrics
      }))

      let onlineResults: SearchResult[] = []

      // 2. Solo buscar online si el modo lo permite
      if (searchMode === 'todo') {
        const online = await searchOnline(query)
        onlineResults = online
          .filter(o => !localResults.some(l =>
            l.title.toLowerCase() === o.title.toLowerCase() &&
            l.artist.toLowerCase() === o.artist.toLowerCase()
          ))
          .map(o => ({
            id: o.id,
            title: o.title,
            artist: o.artist,
            source: 'online' as const,
            url: o.url,
            thumbnailUrl: o.thumbnailUrl
          }))
      }

      const combined = [...localResults, ...onlineResults]
      setResults(combined)
      if (combined.length === 0) setError('No se encontraron resultados. Prueba con otro término.')
    } catch {
      setError('Error al buscar. Verifica tu conexión a internet.')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (result: SearchResult) => {
    setImporting(result.id)
    try {
      if (result.source === 'supabase' && result.lyrics) {
        // Ya tenemos la letra de nuestra base de datos
        setImportedLyrics({ result, lyrics: result.lyrics })
      } else {
        // Buscar la letra online
        const lyrics = await fetchLyrics(result.artist, result.title)
        if (lyrics) {
          setImportedLyrics({ result, lyrics: cleanLyricsText(lyrics) })
        } else {
          setError(`No se encontró la letra de "${result.title}". Puedes agregarla manualmente.`)
        }
      }
    } catch {
      setError('Error al obtener la letra.')
    } finally {
      setImporting(null)
    }
  }

  const handleSave = async () => {
    if (!importedLyrics) return
    const { result, lyrics } = importedLyrics
    const now = new Date()
    const payload = {
      title: result.title,
      artist: result.artist,
      lyrics,
      key: '',
      tags: [] as string[],
      language: 'Español',
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
      sourceUrl: result.url || ''
    }

    if (result.source === 'supabase') {
      // Ya existe en Supabase, solo guardar en Dexie local
      await db.songs.add(payload)
    } else {
      // Guardar en Supabase y Dexie
      const created = await createSong(payload)
      if (created) {
        await db.songs.add(created)
      } else {
        await db.songs.add(payload)
      }
    }
    setImportedLyrics(null)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2><Search size={18} /> Buscar letras</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {!importedLyrics ? (
            <>
              <div className="search-mode-toggle">
                <button
                  className={`mode-btn ${searchMode === 'cristiana' ? 'active' : ''}`}
                  onClick={() => setSearchMode('cristiana')}
                  title="Solo canciones cristianas de nuestra base de datos"
                >
                  <Database size={14} /> Biblioteca cristiana
                </button>
                <button
                  className={`mode-btn ${searchMode === 'todo' ? 'active' : ''}`}
                  onClick={() => setSearchMode('todo')}
                  title="Buscar también en internet (puede incluir resultados seculares)"
                >
                  <Globe size={14} /> + Internet
                </button>
              </div>

              <div className="search-box">
                <Search size={16} />
                <input
                  type="text" placeholder="Buscar canción o artista..."
                  value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  autoFocus
                />
                <button className="btn-primary" onClick={handleSearch} disabled={loading}>
                  {loading ? <Loader size={14} className="spin" /> : 'Buscar'}
                </button>
              </div>

              {error && <div className="search-error">{error}</div>}

              <div className="search-results">
                {results.map(result => (
                  <div key={`${result.source}-${result.id}`} className="search-result-item">
                    <div className="result-thumb-placeholder">
                      {result.source === 'supabase'
                        ? <Database size={18} />
                        : <Globe size={18} />
                      }
                    </div>
                    <div className="result-info">
                      <div className="result-title">{result.title}</div>
                      <div className="result-artist">
                        {result.artist || 'Artista desconocido'}
                        {result.source === 'supabase' && (
                          <span className="result-badge">✝ Biblioteca</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => handleImport(result)}
                      disabled={importing === result.id}
                    >
                      {importing === result.id
                        ? <><Loader size={12} className="spin" /> Cargando...</>
                        : <><Download size={12} /> {result.source === 'supabase' ? 'Usar' : 'Importar'}</>}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="lyrics-preview">
              <h3>{importedLyrics.result.title}</h3>
              <p className="dim">{importedLyrics.result.artist}</p>
              <textarea
                className="lyrics-textarea"
                value={importedLyrics.lyrics}
                onChange={e => setImportedLyrics(p => p ? { ...p, lyrics: e.target.value } : p)}
                rows={16}
              />
              <div className="modal-actions">
                <button className="btn-ghost" onClick={() => setImportedLyrics(null)}>← Volver</button>
                <button className="btn-primary" onClick={handleSave}>
                  <Download size={14} /> Guardar en biblioteca
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
