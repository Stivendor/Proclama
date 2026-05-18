import { useState } from 'react'
import { Search, X, Loader, Cloud, CloudOff, ShieldCheck, Globe, Plus, Lock, CheckCircle2 } from 'lucide-react'
import { fetchLyrics } from '@/services/genius'
import { createSong } from '@/services/supabase'
import { cleanLyricsText } from '@/services/lyricsParser'
import { db } from '@/db'
import { useAppStore } from '@/stores'
import { usePlan } from '@/hooks/usePlan'
import { useOnlineSearch, type OnlineSearchResult } from '@/hooks/useOnlineSearch'
import type { Song } from '@/types'
import PremiumFeatureModal from '@/components/PremiumFeatureModal'

interface SearchResult extends OnlineSearchResult {
  internalSong?: Song
}

export default function OnlineSearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const { results, loading, error, search, setResults } = useOnlineSearch()
  const [importing, setImporting] = useState<number | null>(null)
  const [importedLyrics, setImportedLyrics] = useState<{ song: SearchResult; lyrics: string } | null>(null)
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uiError, setUiError] = useState('')

  const { isPremium, canUseGenius, canSync } = usePlan()
  const { user, userRole, setActiveView } = useAppStore()


  const openPremiumModal = () => {
    setShowPremiumModal(true)
  }

  const handleSearch = () => {
    search(query)
  }

  const handleImport = async (item: SearchResult) => {
    if (!canUseGenius) {
      openPremiumModal()
      return
    }

    if (item.alreadyInLibrary && item.internalSong) {
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
      } else {
        setUiError(`No se encontro la letra de "${item.title}". Puedes agregarla manualmente.`)
      }
    } catch {
      setUiError('Error al obtener la letra.')
    } finally {
      setImporting(null)
    }
  }

  const handleSave = async () => {
    if (!importedLyrics) return

    const { song, lyrics } = importedLyrics
    setSaving(true)
    setUiError('')

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
        language: 'Español',
        usageCount: 0,
        isPublic: user ? isPublic : false,
        isVerified: userRole === 'admin' ? isPublic : false,
        createdAt: now,
        updatedAt: now,
        sourceUrl: song.url,
      }

      if (canSync && user) {
        try {
          const created = await createSong(payload)
          if (created) {
            await db.songs.put(created)
          } else {
            console.warn('[OnlineSearch] No se pudo guardar en la nube, guardando solo local')
            await db.songs.put(payload)
          }
        } catch (cloudErr) {
          console.warn('[OnlineSearch] Error en nube, guardando solo local:', cloudErr)
          await db.songs.put(payload)
        }
      } else {
        await db.songs.put(payload)
      }

      useAppStore.getState().setToast(`✅ "${title}" importada a Mi Cancionero`)
      setImportedLyrics(null)
      onClose()
    } catch (err) {
      console.error('handleSave error:', err)
      setUiError(err instanceof Error ? err.message : 'Error al guardar la cancion.')
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
              {uiError && <div className="search-error" role="alert" aria-live="polite">{uiError}</div>}

              <div className="search-results">
                {results.map((item) => (
                  <div key={`ext-${item.id}`} className="search-result-item">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="result-thumb" />
                    ) : (
                      <div className="result-thumb-placeholder">
                        <Globe size={20} />
                      </div>
                    )}

                    <div className="result-info">
                      <div className="result-title-row">
                        <span className="result-title">{item.title}</span>
                        {item.alreadyInLibrary && (
                          <span className="already-in-library-badge">
                            <CheckCircle2 size={10} />
                            En biblioteca
                          </span>
                        )}
                      </div>
                      <div className="result-artist">{item.artist}</div>
                    </div>

                    <button
                      className={`btn-${item.alreadyInLibrary ? 'ghost' : 'primary'} sm`}
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
                          {canUseGenius ? (item.alreadyInLibrary ? 'Re-importar' : 'Importar') : 'Requiere Pro'}
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
                .already-in-library-badge {
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  font-size: 9px;
                  background: rgba(34, 197, 94, 0.15);
                  color: #22c55e;
                  padding: 2px 6px;
                  border-radius: 10px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }
                .search-result-item {
                  transition: all 0.2s ease;
                }
                .search-result-item:hover {
                  background: rgba(255, 255, 255, 0.03);
                }
                @media (max-width: 640px) {
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

                {uiError && <div className="search-error" style={{ marginBottom: '16px' }} role="alert" aria-live="polite">{uiError}</div>}

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
