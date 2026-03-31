import { useState } from 'react'
import { Search, Download, X, Loader, Music2, Cloud, CloudOff } from 'lucide-react'
import { searchSongs, fetchLyrics } from '@/services/genius'
import { cleanLyricsText } from '@/services/lyricsParser'
import { db } from '@/db'
import { useAppStore } from '@/stores'
import { createSong } from '@/services/supabase'
import type { GeniusSong } from '@/services/genius'
import { usePlan } from '@/hooks/usePlan'

export default function OnlineSearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeniusSong[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<number | null>(null)
  const [importedLyrics, setImportedLyrics] = useState<{ song: GeniusSong; lyrics: string } | null>(null)
  const [error, setError] = useState('')
  const { canUseGenius, canSync } = usePlan()

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

  const { user, userRole, setActiveView } = useAppStore()
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const handleSave = async () => {
    if (!importedLyrics) return
    const { song, lyrics } = importedLyrics
    setSaving(true)
    try {
      const now = new Date()
      const payload = {
        userId: user?.id,
        title: song.title,
        artist: song.artist,
        lyrics,
        key: '',
        tags: [],
        language: 'Español',
        usageCount: 0,
        isPublic: user ? isPublic : false,
        isVerified: userRole === 'admin' ? isPublic : false,
        createdAt: now,
        updatedAt: now,
        sourceUrl: song.url
      }
      
      // Solo sincronizar con Supabase si el usuario puede
      if (canSync && user) {
        const created = await createSong(payload)
        if (created) {
          await db.songs.add(created)
        } else {
          await db.songs.add(payload)
        }
      } else {
        // Usuario free: solo guardar localmente
        await db.songs.add(payload)
      }
      
      onClose()
    } catch (err) {
      console.error(err)
      setError('Error al guardar la canción.')
    } finally {
      setSaving(false)
      setImportedLyrics(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2><Search size={18} /> Buscar letras online</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar modal"><X size={16} /></button>
        </div>

        <div className="modal-body">
          {!canUseGenius ? (
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'rgba(212, 175, 55, 0.1)', borderRadius: 8, border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                  <Search size={32} color="var(--gold)" style={{ flexShrink: 0 }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Búsqueda Online de Letras
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Encuentra y descarga letras de canciones desde Genius
                    </p>
                  </div>
                </div>

                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <p style={{ margin: '0 0 12px' }}>Con la búsqueda online puedes:</p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>Buscar canciones por título o artista en la base de datos de Genius</li>
                    <li>Importar letras completas automáticamente</li>
                    <li>Editar y ajustar las letras antes de guardar</li>
                    <li>Agregar canciones a tu biblioteca en segundos</li>
                    <li>Acceder a miles de canciones cristianas y de adoración</li>
                  </ul>
                </div>

                <div style={{ padding: 12, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  💡 Actualiza a Premium para desbloquear esta función y muchas más
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={onClose}>
                  Cerrar
                </button>
                <button className="btn-primary" onClick={onClose}>
                  Entendido
                </button>
              </div>
            </div>
          ) : !importedLyrics ? (
            <>
              <div className="search-box">
                <Search size={16} />
                <input
                  type="search"
                  placeholder="Nombre de la canción o artista…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  aria-label="Buscar canciones online"
                  autoFocus
                />
                <button className="btn-primary" onClick={handleSearch} disabled={loading}>
                  {loading ? <Loader size={14} className="spin" /> : 'Buscar'}
                </button>
              </div>

              {error && <div className="search-error" role="alert" aria-live="polite">{error}</div>}

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
              <p className="dim" style={{ marginBottom: 12 }}>{importedLyrics.song.artist}</p>
              
              <textarea
                className="lyrics-textarea"
                value={importedLyrics.lyrics}
                onChange={e => setImportedLyrics(p => p ? { ...p, lyrics: e.target.value } : p)}
                rows={12}
                style={{ marginBottom: 20 }}
              />

              <div className="modal-actions-wrapper">
                {user ? (
                  <div className="privacy-selector-group">
                    <label className="privacy-label">Visibilidad en la biblioteca</label>
                    <div className="privacy-buttons">
                      <button 
                        type="button"
                        className={`privacy-btn ${isPublic ? 'active public' : ''}`} 
                        onClick={() => setIsPublic(true)}
                      >
                        <Cloud size={14} /> Pública
                      </button>
                      <button 
                        type="button"
                        className={`privacy-btn ${!isPublic ? 'active private' : ''}`} 
                        onClick={() => setIsPublic(false)}
                      >
                        <CloudOff size={14} /> Privada
                      </button>
                    </div>
                    <p className="privacy-hint">
                      {isPublic 
                        ? (userRole === 'admin' 
                            ? '🌐 Visible para toda la congregación.' 
                            : '⏳ Se enviará a moderación.') 
                        : '🔒 Solo tú podrás verla.'}
                    </p>
                  </div>
                ) : (
                  <div className="local-only-hint" style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <CloudOff size={16} color="var(--text-muted)" />
                    <span>Estás en <b>modo local</b>. <button className="btn-link" style={{ background: 'none', border: 'none', color: 'var(--primary)', padding: 0, cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }} onClick={() => { setActiveView('settings'); onClose(); }}>Inicia sesión</button> para compartir canciones.</span>
                  </div>
                )}

                <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button className="btn-ghost" onClick={() => setImportedLyrics(null)}>Atrás</button>
                  <button className="btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader size={14} className="spin" /> : 'Guardar canción'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
