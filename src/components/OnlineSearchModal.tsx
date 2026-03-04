import { useState } from 'react'
import { Search, Download, X, Loader, Music2 } from 'lucide-react'
import { searchSongs, fetchLyrics } from '@/services/genius'
import { cleanLyricsText } from '@/services/lyricsParser'
import { db } from '@/db'
import type { GeniusSong } from '@/services/genius'

export default function OnlineSearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeniusSong[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<number | null>(null)
  const [importedLyrics, setImportedLyrics] = useState<{ song: GeniusSong; lyrics: string } | null>(null)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await searchSongs(query)
      setResults(res)
      if (res.length === 0) setError('No se encontraron resultados. Prueba con otro término.')
    } catch {
      setError('Error al buscar. Verifica tu conexión a internet.')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (song: GeniusSong) => {
    setImporting(song.id)
    try {
      const lyrics = await fetchLyrics(song.artist, song.title)
      if (lyrics) {
        setImportedLyrics({ song, lyrics: cleanLyricsText(lyrics) })
      } else {
        setError(`No se encontró la letra de "${song.title}". Puedes agregarla manualmente.`)
      }
    } catch {
      setError('Error al obtener la letra.')
    } finally {
      setImporting(null)
    }
  }

  const handleSave = async () => {
    if (!importedLyrics) return
    const { song, lyrics } = importedLyrics
    const now = new Date()
    await db.songs.add({
      title: song.title,
      artist: song.artist,
      lyrics,
      key: '',
      tags: [],
      language: 'Español',
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
      sourceUrl: song.url
    })
    alert(`✅ "${song.title}" agregada a tu biblioteca`)
    setImportedLyrics(null)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2><Search size={18} /> Buscar letras online</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          {!importedLyrics ? (
            <>
              <div className="search-box">
                <Search size={16} />
                <input
                  type="text" placeholder="Buscar canción..."
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
                {results.map(song => (
                  <div key={song.id} className="search-result-item">
                    {song.thumbnailUrl && (
                      <img src={song.thumbnailUrl} alt="" className="result-thumb" />
                    )}
                    {!song.thumbnailUrl && <div className="result-thumb-placeholder"><Music2 size={20} /></div>}
                    <div className="result-info">
                      <div className="result-title">{song.title}</div>
                      <div className="result-artist">{song.artist}</div>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => handleImport(song)}
                      disabled={importing === song.id}
                    >
                      {importing === song.id
                        ? <><Loader size={12} className="spin" /> Obteniendo...</>
                        : <><Download size={12} /> Importar</>}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="lyrics-preview">
              <h3>{importedLyrics.song.title}</h3>
              <p className="dim">{importedLyrics.song.artist}</p>
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
