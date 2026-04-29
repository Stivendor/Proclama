import { useState } from 'react'
import { Search, X, Loader, Cloud, CloudOff, ShieldCheck, Globe, Plus, Lock } from 'lucide-react'
import { searchExternalSongs, fetchLyrics } from '@/services/genius'
import { searchSongs as searchInternal, createSong } from '@/services/supabase'
import { cleanLyricsText } from '@/services/lyricsParser'
import { db } from '@/db'
import { useAppStore } from '@/stores'
import type { GeniusSong } from '@/services/genius'
import { usePlan } from '@/hooks/usePlan'
import { detectLanguage } from '@/services/languageUtils'
import type { Song } from '@/types'
import PremiumFeatureModal from '@/components/PremiumFeatureModal'

interface SearchResult extends Partial<GeniusSong> {
  internalSong?: Song
  isInternal?: boolean
}

export default function OnlineSearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<number | null>(null)
  const [importedLyrics, setImportedLyrics] = useState<{ song: SearchResult; lyrics: string } | null>(null)
  const [error, setError] = useState('')
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<'Español' | 'Inglés' | 'Cualquiera'>('Cualquiera')
  const [isPublic, setIsPublic] = useState(true)
  const [songLanguage, setSongLanguage] = useState<'Español' | 'Inglés'>('Español')
  const [saving, setSaving] = useState(false)

  const { isPremium, canUseGenius, canSync } = usePlan()
  const { user, userRole, setActiveView } = useAppStore()

  const detectedLang = query.trim().length > 3 ? detectLanguage(query) : null

  const openPremiumModal = () => {
    setShowPremiumModal(true)
  }

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')

    try {
      const langParam = selectedLanguage === 'Cualquiera' ? undefined : selectedLanguage
      let [internalRes, externalRes] = await Promise.all([
        searchInternal(query, true, langParam),
        searchExternalSongs(query),
      ])

      if (externalRes.length === 0 && query.trim().split(/\s+/).length > 2) {
        const simplified = query
          .split(/\s+/)
          .filter((word) => word.length > 3)
          .slice(0, 3)
          .join(' ')

        if (simplified && simplified !== query) {
          externalRes = await searchExternalSongs(simplified)
        }
      }

      const mappedInternal: SearchResult[] = internalRes.map((song) => ({
        id: song.id!,
        title: song.title,
        artist: song.artist,
        isInternal: true,
        internalSong: song,
      }))

      const combined = [...mappedInternal]
      externalRes.forEach((externalSong) => {
        const alreadyExists = combined.some(
          (internalSong) =>
            internalSong.title?.toLowerCase() === externalSong.title.toLowerCase() &&
            internalSong.artist?.toLowerCase() === externalSong.artist.toLowerCase(),
        )

        if (!alreadyExists) {
          combined.push({ ...externalSong, isInternal: false })
        }
      })

      setResults(combined)
      if (combined.length === 0) {
        setError('No se encontraron resultados. Prueba con otro termino.')
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Error al buscar. Verifica tu conexion a internet.')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (item: SearchResult) => {
    if (!canUseGenius) {
      openPremiumModal()
      return
    }

    if (item.isInternal && item.internalSong) {
      if (!isPremium) {
        setShowPremiumModal(true)
        return
      }

      setImportedLyrics({
        song: item,
        lyrics: item.internalSong.lyrics,
      })
      return
    }

    setImporting(item.id!)
    try {
      const lyrics = await fetchLyrics(item.artist!, item.title!)
      if (lyrics) {
        const cleaned = cleanLyricsText(lyrics)
        setImportedLyrics({
          song: item,
          lyrics: cleaned,
        })
        setSongLanguage(detectLanguage(cleaned))
      } else {
        setError(`No se encontro la letra de "${item.title}". Puedes agregarla manualmente.`)
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
    setSaving(true)
    setError('')

    try {
      const now = new Date()
      const title = song.title ?? ''
      const artist = song.artist ?? ''
      const payload = {
        userId: user?.id,
        title,
        artist,
        lyrics,
        key: '',
        tags: [],
        language: songLanguage,
        usageCount: 0,
        isPublic: user ? isPublic : false,
        isVerified: userRole === 'admin' ? isPublic : false,
        createdAt: now,
        updatedAt: now,
        sourceUrl: song.url,
      }

      if (canSync && user) {
        const created = await createSong(payload)
        if (created) {
          await db.songs.put(created)
        } else {
          throw new Error('No se pudo guardar en la nube. Verifica tu sesion o permisos e intentalo de nuevo.')
        }
      } else {
        await db.songs.put(payload)
      }

      setImportedLyrics(null)
      onClose()
    } catch (err) {
      console.error('handleSave error:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar la cancion.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2><Search size={18} /> Buscar letras online</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar modal">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {!importedLyrics ? (
            <>
              <div className="search-box">
                <Search size={16} />
                <input
                  type="search"
                  placeholder="Nombre de la cancion o artista..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  aria-label="Buscar canciones online"
                  autoFocus
                />
                <button className="btn-primary" onClick={handleSearch} disabled={loading}>
                  {loading ? <Loader size={14} className="spin" /> : 'Buscar'}
                </button>
              </div>

              {!canUseGenius && (
                <div className="pro-search-hint">
                  <div>
                    <strong>Explora los resultados gratis.</strong> Agregar canciones desde la busqueda online requiere una cuenta Premium.
                  </div>
                  <button className="btn-ghost sm" onClick={openPremiumModal}>
                    <Lock size={12} />
                    Desbloquear Pro
                  </button>
                </div>
              )}


              {error && <div className="search-error" role="alert" aria-live="polite">{error}</div>}

              <div className="search-results">
                {results.map((item) => (
                  <div key={`${item.isInternal ? 'int' : 'ext'}-${item.id}`} className="search-result-item">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="result-thumb" />
                    ) : (
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
                        <>
                          <Loader size={12} className="spin" /> Obteniendo...
                        </>
                      ) : (
                        <>
                          {canUseGenius ? <Plus size={12} /> : <Lock size={12} />}
                          {canUseGenius ? (item.isInternal ? 'Añadir' : 'Importar') : 'Requiere Pro'}
                        </>
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
                .search-detected-lang {
                  margin-bottom: 12px;
                  color: var(--text-muted);
                  font-size: 12px;
                }
                .pro-search-hint {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 12px;
                  margin-bottom: 16px;
                  padding: 12px 14px;
                  border: 1px solid rgba(212, 175, 55, 0.25);
                  border-radius: 10px;
                  background: rgba(212, 175, 55, 0.08);
                  color: var(--text-secondary);
                  font-size: 13px;
                  line-height: 1.5;
                }
                .lang-badge {
                  font-size: 10px;
                  font-weight: 800;
                  padding: 2px 5px;
                  border-radius: 4px;
                  margin-right: 8px;
                }
                .lang-badge.español {
                  background: rgba(212, 175, 55, 0.2);
                  color: var(--gold);
                }
                .lang-badge.inglés {
                  background: rgba(167, 139, 250, 0.2);
                  color: #a78bfa;
                }
                .search-result-item {
                  transition: all 0.2s ease;
                }
                .search-result-item:hover {
                  background: rgba(255, 255, 255, 0.03);
                }
                @media (max-width: 640px) {
                  .pro-search-hint {
                    flex-direction: column;
                    align-items: flex-start;
                  }
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
                onChange={(e) => setImportedLyrics((prev) => (prev ? { ...prev, lyrics: e.target.value } : prev))}
                rows={12}
                style={{ marginBottom: 12 }}
              />

              <div className="language-selector-preview">
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                  Idioma de la cancion
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <button
                    className={`lang-pill ${songLanguage === 'Español' ? 'active es' : ''}`}
                    onClick={() => setSongLanguage('Español')}
                  >
                    Español
                  </button>
                  <button
                    className={`lang-pill ${songLanguage === 'Inglés' ? 'active en' : ''}`}
                    onClick={() => setSongLanguage('Inglés')}
                  >
                    Inglés
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
                .lang-pill.active.es {
                  border-color: var(--gold);
                  background: rgba(212, 175, 55, 0.1);
                  color: var(--gold);
                }
                .lang-pill.active.en {
                  border-color: #a78bfa;
                  background: rgba(167, 139, 250, 0.1);
                  color: #a78bfa;
                }
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
                        <Cloud size={14} /> Publica
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
                            ? 'Visible para toda la congregacion.'
                            : 'Se enviara a moderacion.')
                        : 'Solo tu podras verla.'}
                    </p>
                  </div>
                ) : (
                  <div
                    className="local-only-hint"
                    style={{
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      fontSize: '13px',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                    }}
                  >
                    <CloudOff size={16} color="var(--text-muted)" />
                    <span>
                      Estas en <b>modo local</b>.{' '}
                      <button
                        className="btn-link"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          padding: 0,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontSize: 'inherit',
                        }}
                        onClick={() => {
                          setActiveView('settings')
                          onClose()
                        }}
                      >
                        Inicia sesion
                      </button>{' '}
                      para compartir canciones.
                    </span>
                  </div>
                )}

                {error && <div className="search-error" style={{ marginBottom: '16px' }} role="alert" aria-live="polite">{error}</div>}

                <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button className="btn-ghost" onClick={() => setImportedLyrics(null)}>
                    Atras
                  </button>
                  <button className="btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader size={14} className="spin" /> : 'Guardar cancion'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPremiumModal && (
        <PremiumFeatureModal
          title="Busqueda online"
          description="Busca canciones en fuentes online y agregalas a tu biblioteca local."
          benefits={[
            'Buscar por titulo o artista en fuentes online y comunidad',
            'Comparar resultados antes de importar',
            'Agregar letras a tu biblioteca local en segundos',
          ]}
          icon={Search}
          onClose={() => setShowPremiumModal(false)}
        />
      )}
    </div>
  )
}
