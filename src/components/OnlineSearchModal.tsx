import { useState } from 'react'
import { Search, Download, X, Loader, Music2, Cloud, CloudOff, ShieldCheck, Globe, Plus } from 'lucide-react'
import { searchExternalSongs, fetchLyrics } from '@/services/genius'
import { searchSongs as searchInternal } from '@/services/supabase'
import { cleanLyricsText } from '@/services/lyricsParser'
import { db } from '@/db'
import { useAppStore } from '@/stores'
import { createSong } from '@/services/supabase'
import type { GeniusSong } from '@/services/genius'
import { usePlan } from '@/hooks/usePlan'
import { detectLanguage } from '@/services/languageUtils'
import type { Song } from '@/types'

// Tipo unificado para los resultados
interface SearchResult extends Partial<GeniusSong> {
  internalSong?: Song;
  isInternal?: boolean;
}

export default function OnlineSearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<number | null>(null)
  const [importedLyrics, setImportedLyrics] = useState<{ song: SearchResult; lyrics: string } | null>(null)
  const [error, setError] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState<'Español' | 'Inglés' | 'Cualquiera'>('Cualquiera')
  const { canUseGenius, canSync } = usePlan()

  // Heurística de detección mientras escribe
  const detectedLang = query.trim().length > 3 ? detectLanguage(query) : null

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      const langParam = selectedLanguage === 'Cualquiera' ? undefined : selectedLanguage
      // Búsqueda en paralelo
      let [internalRes, externalRes] = await Promise.all([
        searchInternal(query, true, langParam), // true = solo públicas
        searchExternalSongs(query)
      ])

      // Fallback para búsqueda externa: si no hay resultados y la frase es larga, simplificar
      if (externalRes.length === 0 && query.trim().split(/\s+/).length > 2) {
        // Filtrar palabras comunes y tomar las más importantes (máx 3)
        const simplified = query.split(/\s+/)
          .filter(word => word.length > 3)
          .slice(0, 3)
          .join(' ')
        
        if (simplified && simplified !== query) {
          externalRes = await searchExternalSongs(simplified)
        }
      }

      // Mapear resultados internos
      const mappedInternal: SearchResult[] = internalRes.map(s => ({
        id: s.id!,
        title: s.title,
        artist: s.artist,
        isInternal: true,
        internalSong: s
      }))

      // Unir y eliminar duplicados por título/artista (priorizando internos)
      const combined = [...mappedInternal]
      externalRes.forEach(ext => {
        const alreadyExists = combined.some(
          int => int.title?.toLowerCase() === ext.title.toLowerCase() && 
                 int.artist?.toLowerCase() === ext.artist.toLowerCase()
        )
        if (!alreadyExists) {
          combined.push({ ...ext, isInternal: false })
        }
      })

      setResults(combined)
      if (combined.length === 0) setError('No se encontraron resultados. Prueba con otro término.')
    } catch (err) {
      console.error('Search error:', err)
      setError('Error al buscar. Verifica tu conexión a internet.')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (item: SearchResult) => {
    // Si ya es un resultado interno, ya tenemos la letra
    if (item.isInternal && item.internalSong) {
      setImportedLyrics({ 
        song: item, 
        lyrics: item.internalSong.lyrics 
      })
      return
    }

    // Si es externo, hay que obtenerla
    setImporting(item.id!)
    try {
      const lyrics = await fetchLyrics(item.artist!, item.title!)
      if (lyrics) {
        const cleaned = cleanLyricsText(lyrics)
        setImportedLyrics({ 
          song: item, 
          lyrics: cleaned 
        })
        // Detectar idioma de la letra importada
        setSongLanguage(detectLanguage(cleaned))
      } else {
        setError(`No se encontró la letra de "${item.title}". Puedes agregarla manualmente.`)
      }
    } catch {
      setError('Error al obtener la letra.')
    } finally {
      setImporting(null)
    }
  }

  const { user, userRole, setActiveView } = useAppStore()
  const [isPublic, setIsPublic] = useState(true)
  const [songLanguage, setSongLanguage] = useState<'Español' | 'Inglés'>('Español')
  const [saving, setSaving] = useState(false)
  
  const handleSave = async () => {
    if (!importedLyrics) return
    const { song, lyrics } = importedLyrics
    setSaving(true)
    setError('')
    try {
      const now = new Date()
      const payload = {
        userId: user?.id,
        title: song.title,
        artist: song.artist,
        lyrics,
        key: '',
        tags: [],
        language: songLanguage,
        usageCount: 0,
        isPublic: user ? isPublic : false,
        isVerified: userRole === 'admin' ? isPublic : false,
        createdAt: now,
        updatedAt: now,
        sourceUrl: song.url
      }

      if (canSync && user) {
        const created = await createSong(payload)
        if (created) {
          // Inserción en Supabase exitosa → guardar en Dexie con el id remoto o actualizar si ya existe
          await db.songs.put(created)
        } else {
          // createSong devolvió null: Supabase rechazó (ej. RLS). Lanzar error
          // para que no quede el spinner colgado ni se haga add(null).
          throw new Error('No se pudo guardar en la nube. Verifica tu sesión o permisos e inténtalo de nuevo.')
        }
      } else {
        // Usuario sin sesión o plan free: guardar solo localmente
        await db.songs.put(payload)
      }

      // Solo llegar aquí si todo salió bien
      setImportedLyrics(null)
      onClose()
    } catch (err) {
      console.error('handleSave error:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar la canción.')
    } finally {
      setSaving(false)
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

              <div className="search-filters">
                <div className="lang-tabs">
                  {(['Cualquiera', 'Español', 'Inglés'] as const).map(l => (
                    <button 
                      key={l}
                      className={`lang-tab ${selectedLanguage === l ? 'active' : ''}`}
                      onClick={() => setSelectedLanguage(l)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="search-error" role="alert" aria-live="polite">{error}</div>}

              <div className="search-results">
                {results.map(item => (
                  <div key={`${item.isInternal ? 'int' : 'ext'}-${item.id}`} className="search-result-item">
                    {item.thumbnailUrl && (
                      <img src={item.thumbnailUrl} alt="" className="result-thumb" />
                    )}
                    {!item.thumbnailUrl && (
                      <div className="result-thumb-placeholder">
                        {item.isInternal ? <Cloud size={20} color="var(--blue)" /> : <Globe size={20} />}
                      </div>
                    )}
                    <div className="result-info">
                      <div className="result-title-row">
                        <span className="result-title">{item.title}</span>
                        {item.isInternal && (
                          <span className="source-badge">
                            {item.internalSong?.isVerified ? <ShieldCheck size={10} /> : <Cloud size={10} />}
                            Comunidad
                          </span>
                        )}
                      </div>
                      <div className="result-artist">{item.artist}</div>
                    </div>
                    {item.internalSong?.language && (
                      <span className={`lang-badge ${item.internalSong.language.toLowerCase()}`}>
                        {item.internalSong.language === 'Inglés' ? 'EN' : 'ES'}
                      </span>
                    )}
                    <button
                      className={`btn-${item.isInternal ? 'ghost' : 'primary'} sm`}
                      onClick={() => handleImport(item)}
                      disabled={importing === item.id}
                    >
                      {importing === item.id ? (
                        <><Loader size={12} className="spin" /> Obteniendo...</>
                      ) : (
                        <><Plus size={12} /> {item.isInternal ? 'Añadir' : 'Importar'}</>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <style>{`
                .result-title-row {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                }
                .source-badge {
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  font-size: 9px;
                  background: rgba(59, 130, 246, 0.15);
                  color: var(--blue);
                  padding: 2px 6px;
                  border-radius: 10px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                .search-filters {
                  display: flex;
                  justify-content: flex-end;
                  align-items: center;
                  margin-bottom: 20px;
                  gap: 12px;
                }
                .lang-tabs {
                  display: flex;
                  gap: 4px;
                  background: rgba(255,255,255,0.05);
                  padding: 3px;
                  border-radius: 8px;
                }
                .lang-tab {
                  border: none;
                  background: none;
                  color: var(--text-muted);
                  font-size: 11px;
                  padding: 4px 12px;
                  border-radius: 6px;
                  cursor: pointer;
                  font-weight: 600;
                  transition: all 0.2s;
                }
                .lang-tab.active {
                  background: var(--blue);
                  color: white;
                }
                .lang-badge {
                  font-size: 10px;
                  font-weight: 800;
                  padding: 2px 5px;
                  border-radius: 4px;
                  margin-right: 8px;
                }
                .lang-badge.español { background: rgba(212, 175, 55, 0.2); color: var(--gold); }
                .lang-badge.inglés { background: rgba(167, 139, 250, 0.2); color: #a78bfa; }
                .search-result-item {
                  transition: all 0.2s ease;
                }
                .search-result-item:hover {
                  background: rgba(255, 255, 255, 0.03);
                }
              `}</style>
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
                style={{ marginBottom: 12 }}
              />

              <div className="language-selector-preview">
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>Idioma de la canción</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <button 
                    className={`lang-pill ${songLanguage === 'Español' ? 'active es' : ''}`}
                    onClick={() => setSongLanguage('Español')}
                  >
                    🇪🇸 Español
                  </button>
                  <button 
                    className={`lang-pill ${songLanguage === 'Inglés' ? 'active en' : ''}`}
                    onClick={() => setSongLanguage('Inglés')}
                  >
                    🇺🇸 Inglés
                  </button>
                </div>
              </div>

              <style>{`
                .lang-pill {
                  border: 1px solid var(--border);
                  background: none;
                  color: var(--text-secondary);
                  padding: 6px 16px;
                  border-radius: 20px;
                  cursor: pointer;
                  font-size: 13px;
                  transition: all 0.2s;
                }
                .lang-pill.active.es { border-color: var(--gold); background: rgba(212, 175, 55, 0.1); color: var(--gold); }
                .lang-pill.active.en { border-color: #a78bfa; background: rgba(167, 139, 250, 0.1); color: #a78bfa; }
              `}</style>

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

                {error && <div className="search-error" style={{ marginBottom: '16px' }} role="alert" aria-live="polite">{error}</div>}

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
