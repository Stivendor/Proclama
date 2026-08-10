import { useEffect, useState, memo } from 'react'
import { Search, Music2, Edit2, Trash2, Play, Plus, Menu, ShieldCheck, Clock, Lock, Check, X, Library, LayoutGrid, List, Globe, Download } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useShallow } from 'zustand/react/shallow'
import { db } from '@/db'
import { useAppStore, useProjectionStore } from '@/stores'
import type { Song } from '@/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import LyricsSearchModal from '@/components/songs/LyricsSearchModal'
import ProInterestBadge from '@/components/pricing/ProInterestBadge'
import { fetchSongs, fetchSongsCount, deleteSong as deleteSongRemote, updateSong as updateSongRemote, createSong, fetchProfile } from '@/services/supabase'
import { usePlan, FREE_SONG_LIMIT } from '@/hooks/usePlan'
import { containsIgnoreAccents } from '@/utils/text'
import { LiveSelection } from '@/components/projection/LiveSelection'
import { inUnifiedLibrary, dedupImported } from '@/utils/librarySongs'

export default function LibraryView() {
  const { searchQuery, setSearchQuery, openEditor, user, userRole, isSidebarOpen, toggleSidebar, authStatus, recentSongs, clearRecentSongs } = useAppStore(useShallow(s => ({
    searchQuery: s.searchQuery, setSearchQuery: s.setSearchQuery,
    openEditor: s.openEditor, user: s.user, userRole: s.userRole,
    isSidebarOpen: s.isSidebarOpen, toggleSidebar: s.toggleSidebar,
    authStatus: s.authStatus,
    recentSongs: s.recentSongs,
    clearRecentSongs: s.clearRecentSongs
  })))
  const loadSong = useProjectionStore(s => s.loadSong)
  const { canCreateSong } = usePlan()

  // Conteo de canciones propias del usuario (para el límite free)
  const ownSongCount = useLiveQuery(async () => {
    try {
      if (!user?.id) return 0
      return await db.songs.where('userId').equals(user.id).count()
    } catch {
      return 0
    }
  }, [user?.id]) ?? 0
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [showOnlineSearch, setShowOnlineSearch] = useState(false)
  const [onlineResults, setOnlineResults] = useState<Song[]>([])
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [selectedLang, setSelectedLang] = useState<string>('')
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [totalRemoteSongs, setTotalRemoteSongs] = useState<number | null>(null)

  // Obtener el total de canciones en Supabase para mostrar en el header
  useEffect(() => {
    const fetchTotal = async () => {
      const count = await fetchSongsCount()
      setTotalRemoteSongs(count)
    }
    fetchTotal()
  }, [])

  // Auto-dismiss remote error after 10 seconds
  useEffect(() => {
    if (!remoteError) return
    const timer = setTimeout(() => setRemoteError(null), 10000)
    return () => clearTimeout(timer)
  }, [remoteError])

  // Ctrl+K y «/» abren el buscador online, salvo mientras se escribe en un campo.
  // El listener queda siempre montado: Ctrl+K es un atajo nativo del navegador
  // (barra de búsqueda en Firefox, omnibox en Chrome) y hay que ganarle la carrera
  // con preventDefault sin importar dónde esté el foco, incluido con el modal abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const escribiendo = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowOnlineSearch(true)
      } else if (e.key === '/' && !escribiendo) {
        e.preventDefault()
        setShowOnlineSearch(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const [confirmDelete, setConfirmDelete] = useState<Song | null>(null)
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(localSearch)
    }, 250)
    return () => clearTimeout(t)
  }, [localSearch, setSearchQuery])

  useEffect(() => {
    if (!searchQuery && localSearch) setLocalSearch('')
  }, [searchQuery])

  // Sincronizar Supabase -> Dexie al montar y cuando cambie el usuario o el estado de auth.
  // IMPORTANTE: Se usa user?.id (string primitivo) en lugar del objeto user completo para
  // garantizar que Google OAuth (que reemplaza el objeto user) siempre dispare el re-sync.
  const userId = user?.id ?? null
  useEffect(() => {
    // Solo sincronizar cuando la sesión está resuelta (no durante loading)
    // Ahora sync para todos los usuarios, incluso guests
    if (authStatus === 'loading') return

    let cancelled = false

    const sync = async () => {
      let isFirstLoad = false
      try {
        const localSongs = await db.songs.toArray()
        isFirstLoad = localSongs.length === 0

        // Only block UI with loading indicator on first load
        if (isFirstLoad) {
          setLoadingRemote(true)
        }
        setRemoteError(null)

        // Determine incremental sync starting point
        let lastLocalUpdatedAt: string | undefined = undefined
        if (localSongs.length > 0) {
          const maxTime = Math.max(...localSongs.map(s => s.updatedAt ? new Date(s.updatedAt).getTime() : 0))
          if (maxTime > 0) {
            // 5 second buffer to prevent race conditions or clock skew
            lastLocalUpdatedAt = new Date(maxTime - 5000).toISOString()
          }
        }

        // Smart Sync: Merge remote songs into local Dexie optimized with Aggressive Deduplication & Retries
        const fetchWithRetry = async (retries = 3, delay = 1000): Promise<Song[]> => {
          try {
            const songs = await fetchSongs(lastLocalUpdatedAt)
            // If it's first load, we expect songs. If empty and we are authenticated, retry.
            if (isFirstLoad && songs.length === 0 && user && retries > 0) {
              await new Promise(resolve => setTimeout(resolve, delay))
              return fetchWithRetry(retries - 1, delay * 2)
            }
            return songs
          } catch (err) {
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, delay))
              return fetchWithRetry(retries - 1, delay * 2)
            }
            throw err
          }
        }

        const allRemoteSongs = await fetchWithRetry()
        if (cancelled) return

        // --- PASO 0: Deduplicar la lista remota (por si hay basura en la nube) ---
        const uniqueRemoteMap = new Map<string, Song>()
        for (const rs of allRemoteSongs) {
          const key = `${rs.title.toLowerCase().trim()}|${(rs.artist || '').toLowerCase().trim()}`
          // Si ya existe, nos quedamos con la que tenga más uso o sea más nueva
          if (uniqueRemoteMap.has(key)) {
            const existing = uniqueRemoteMap.get(key)!
            if ((rs.usageCount || 0) > (existing.usageCount || 0)) {
              uniqueRemoteMap.set(key, rs)
            }
          } else {
            uniqueRemoteMap.set(key, rs)
          }
        }
        const remoteSongs = Array.from(uniqueRemoteMap.values())

        // --- PASO 1: Limpieza de duplicados locales existentes ---
        const uniqueLocal = new Map<string, Song>()
        const duplicatesToDelete: number[] = []

        for (const s of localSongs) {
          const key = `${s.title.toLowerCase().trim()}|${(s.artist || '').toLowerCase().trim()}`
          if (uniqueLocal.has(key)) {
            const existing = uniqueLocal.get(key)!
            // Criterio para decidir cuál borrar: preferimos la que tenga remoteId
            if (!existing.remoteId && s.remoteId) {
              duplicatesToDelete.push(existing.id!)
              uniqueLocal.set(key, s)
            } else {
              duplicatesToDelete.push(s.id!)
            }
          } else {
            uniqueLocal.set(key, s)
          }
        }

        // --- PASO 2: Procesar canciones remotas y fusionar ---
        const localByRemoteId = new Map(
          Array.from(uniqueLocal.values()).filter(s => s.remoteId).map(s => [s.remoteId, s])
        )
        const localByTitleArtist = new Map(
          Array.from(uniqueLocal.values()).filter(s => !s.remoteId).map(s => [`${s.title.toLowerCase().trim()}|${(s.artist || '').toLowerCase().trim()}`, s])
        )

        await db.transaction('rw', db.songs, async () => {
          // Eliminar duplicados identificados en el paso 1
          if (duplicatesToDelete.length > 0) {
            await db.songs.bulkDelete(duplicatesToDelete)
          }

          const toAdd: Song[] = []
          const toUpdate: { id: number, changes: Partial<Song> }[] = []

          for (const rs of remoteSongs) {
            let existing = localByRemoteId.get(rs.remoteId)

            if (!existing) {
              const key = `${rs.title.toLowerCase().trim()}|${(rs.artist || '').toLowerCase().trim()}`
              existing = localByTitleArtist.get(key)

              if (existing) {
                toUpdate.push({ id: existing.id!, changes: { remoteId: rs.remoteId } })
              }
            }

            if (!existing) {
              toAdd.push(rs)
            } else if (existing.localOverride) {
              // La canción tiene ediciones locales del usuario — no sobreescribir con datos remotos.
              // Solo actualizamos campos que no afectan el contenido editado (ej. usageCount).
              toUpdate.push({ id: existing.id!, changes: { usageCount: rs.usageCount } })
            } else if (rs.userId === user?.id || userRole === 'admin') {
              toUpdate.push({ id: existing.id!, changes: rs })
            }
          }

          if (toAdd.length > 0) await db.songs.bulkAdd(toAdd)
          for (const item of toUpdate) {
            await db.songs.update(item.id, item.changes)
          }
        })
      } catch (err) {
        console.error('Error syncing songs from Supabase:', err)
        if (!cancelled) setRemoteError('No se pudo sincronizar con Supabase. Usando datos locales.')
      } finally {
        if (!cancelled && isFirstLoad) setLoadingRemote(false)
      }
    }
    sync()
    return () => {
      cancelled = true
      setRemoteError(null)
    }
    // userId y authStatus son valores primitivos → comparación estable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authStatus])

  const songRanking = useLiveQuery(async () => {
    const all = await db.songs.toArray()
    // Ordenar por uso descendente y luego alfabético para consistencia
    all.sort((a, b) => {
      const usageA = a.usageCount ?? 0
      const usageB = b.usageCount ?? 0
      if (usageB !== usageA) return usageB - usageA
      return a.title.localeCompare(b.title, 'es')
    })
    // Crear mapa de id -> rank
    const rankMap = new Map<number, number>()
    all.forEach((song, index) => {
      if (song.id) rankMap.set(song.id, index + 1)
    })
    return rankMap
  }, []) ?? new Map()

  const songs = useLiveQuery(async () => {
    // Ordenar: canciones más usadas primero (por usageCount), luego alfabéticamente
    let results = await db.songs.orderBy('title').toArray()
    results.sort((a, b) => {
      const usageA = a.usageCount ?? 0
      const usageB = b.usageCount ?? 0
      if (usageB !== usageA) return usageB - usageA // Más usadas primero
      return a.title.localeCompare(b.title, 'es') // Luego alfabético
    })

    // Biblioteca unificada: mías (cualquier estado) + comunidad aprobada, sin duplicados importados
    results = dedupImported(
      results.filter(s => inUnifiedLibrary(s, user?.id, userRole === 'admin')),
      user?.id
    )

    // 1. Filter by Search Query
    if (searchQuery) {
      const titleMatches = results.filter(s =>
        containsIgnoreAccents(s.title, searchQuery) ||
        containsIgnoreAccents(s.artist || '', searchQuery)
      )
      const lyricMatches = results.filter(s =>
        !titleMatches.includes(s) && (
          containsIgnoreAccents(s.lyrics, searchQuery) ||
          s.tags.some(t => containsIgnoreAccents(t, searchQuery))
        )
      )
      results = [...titleMatches, ...lyricMatches]
    }
    if (selectedTag) {
      results = results.filter(s => s.tags.includes(selectedTag))
    }

    // 4. Filter by Language
    if (selectedLang) {
      results = results.filter(s => s.language === selectedLang)
    }

    // 5. Apply view limit (slice) as the final step
    // This ensures we always find matches in the full local database
    return results.slice(0, 50)
  }, [searchQuery, selectedTag, selectedLang, user?.id, userRole]) ?? []

  const allTags = useLiveQuery(async () => {
    const all = await db.songs.toArray()
    const tags = new Set<string>()
    all.forEach(s => s.tags.forEach(t => tags.add(t)))
    return [...tags].sort()
  }) ?? []

  const allLangs = useLiveQuery(async () => {
    const all = await db.songs.toArray()
    return [...new Set(all.map(s => s.language))].sort()
  }) ?? []

  /** Abre el editor en modo crear con el título pre-llenado desde la búsqueda. */
  const createSongFromSearch = () => {
    const title = searchQuery.trim()
    if (!title || !canCreateSong(ownSongCount)) return
    openEditor({
      title, artist: '', lyrics: '', key: '', tags: [], language: 'Español',
      usageCount: 0, isPublic: false, isVerified: false,
      createdAt: new Date(), updatedAt: new Date(),
    } as Song)
  }

  const handleEdit = (song: Song) => {
    openEditor(song)
  }

  const handleDelete = async (song: Song) => {
    setConfirmDelete(song)
  }

  const confirmDeleteSong = async () => {
    const song = confirmDelete
    if (!song) return
    setConfirmDelete(null)
    if (song.id != null) {
      if (song.remoteId && (song.userId === user?.id || userRole === 'admin')) {
        await deleteSongRemote(song.remoteId)
      }
      await db.songs.delete(song.id)
    }
  }

  const handleLoad = async (song: Song) => {
    // La proyección nunca se bloquea: cualquier usuario proyecta cualquier canción.
    loadSong(song)
    if (song.id != null) {
      const newUsage = (song.usageCount || 0) + 1
      try {
        if (song.remoteId) await updateSongRemote(song.remoteId, { usageCount: newUsage })
      } catch (err) {
        console.warn('Could not update remote usage count (likely RLS):', err)
      }
      await db.songs.update(song.id, { usageCount: newUsage })
    }
  }

  const handleExport = async () => {
    const all = await db.songs.toArray()
    const json = JSON.stringify(all, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `proclama-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const songs: Song[] = JSON.parse(text)
      const toAdd = songs.map(({ id, ...rest }) => ({
        ...rest,
        createdAt: new Date(rest.createdAt),
        updatedAt: new Date()
      }))
      await db.songs.bulkAdd(toAdd)
      setImportStatus(`✅ ${toAdd.length} canciones importadas`)
      setTimeout(() => setImportStatus(null), 4000)
    } catch {
      setImportStatus('Error al importar. Verifica el formato del archivo.')
      setTimeout(() => setImportStatus(null), 4000)
    }
    e.target.value = ''
  }

  const handleImportFromCommunity = async (song: Song) => {
    const existing = await db.songs
      .filter(s =>
        s.title.toLowerCase().trim() === song.title.toLowerCase().trim() &&
        (s.artist || '').toLowerCase().trim() === (song.artist || '').toLowerCase().trim()
      )
      .first()

    if (existing) {
      setImportStatus(`⚠️ "${song.title}" ya está en tu cancionero`)
      setTimeout(() => setImportStatus(null), 4000)
      return
    }

    const newSong: Omit<Song, 'id'> = {
      title: song.title,
      artist: song.artist,
      lyrics: song.lyrics,
      key: song.key,
      tags: [...(song.tags || [])],
      language: song.language || 'Español',
      usageCount: 0,
      isPublic: false,
      isVerified: false,
      importadaDe: song.remoteId,
      userId: user?.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    try {
      await db.songs.add(newSong as Song)
      setImportStatus(`✅ "${song.title}" importada a tu cancionero`)
    } catch {
      setImportStatus(`Error al importar "${song.title}"`)
    }
    setTimeout(() => setImportStatus(null), 4000)
  }

  const handlePublish = async (song: Song) => {
    if (!user?.id) {
      setImportStatus('Inicia sesión para poder publicar canciones en la comunidad')
      setTimeout(() => setImportStatus(null), 4000)
      return
    }

    const now = new Date()
    try {
      const isVerified = false
      if (song.remoteId) {
        await updateSongRemote(song.remoteId, { isPublic: true, isVerified, updatedAt: now })
        await db.songs.update(song.id!, { isPublic: true, isVerified, updatedAt: now })
      } else {
        const created = await createSong({
          ...song,
          userId: user.id, // Explicitly set user.id so RLS can authorize the insert
          isPublic: true,
          isVerified,
          createdAt: now,
          updatedAt: now,
        })
        if (!created) {
          setImportStatus('Error al publicar. Verifica tu conexión e intenta de nuevo.')
          setTimeout(() => setImportStatus(null), 4000)
          return
        }
        if (created?.remoteId) {
          await db.songs.update(song.id!, { isPublic: true, isVerified, remoteId: created.remoteId, updatedAt: now })
        }
      }
      setImportStatus(`✅ "${song.title}" publicada en la comunidad${isVerified ? '' : ' (pendiente de revisión)'}`)
    } catch (err: any) {
      console.error('Error in handlePublish:', err)
      setImportStatus(`Error al publicar "${song.title}"`)
    }
    setTimeout(() => setImportStatus(null), 4000)
  }

  return (
    <div className="library-view">
      {/* Header */}
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar} aria-label="Abrir menú lateral">
              <Menu size={20} />
            </button>
          )}
          <div>
            <h1><Library size={18} style={{ display: 'inline', marginRight: 8 }} />Biblioteca</h1>
            <span className="song-count">
              {songs.length} de {totalRemoteSongs ? totalRemoteSongs.toLocaleString('es') : '...'} canciones
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="online-search-trigger"
            onClick={() => setShowOnlineSearch(true)}
            aria-label="Buscar canciones en internet"
          >
            <Globe size={14} opacity={0.6} />
            <span>Buscar online…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <ProInterestBadge source="online_search" align="right" />
          <button
            className="btn-primary"
            onClick={() => { if (canCreateSong(ownSongCount)) { openEditor() } }}
            disabled={!canCreateSong(ownSongCount)}
            aria-label="Crear nueva canción"
            title={!canCreateSong(ownSongCount) ? `Límite de ${FREE_SONG_LIMIT} canciones propias alcanzado — actualiza tu plan` : undefined}
          >
            <Plus size={15} /> Nueva
            {!canCreateSong(ownSongCount) && <Lock size={12} style={{ marginLeft: 4, opacity: 0.7 }} />}
          </button>
        </div>
      </div>

      <div className="library-grid">
        {/* Lado Izquierdo: Lista y Filtros */}
        <div className="library-sidebar-list">
          <div className="library-filters-compact">
            <div className="search-box">
              <Search size={14} />
              <input
                type="search"
                placeholder="Buscar…"
                value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
                aria-label="Buscar canciones"
              />
            </div>
          </div>

          {!localSearch && recentSongs && recentSongs.length > 0 && (
            <div className="recent-songs-section">
              <div className="recent-songs-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={12} opacity={0.6} />
                  <span>Utilizadas recientemente</span>
                </div>
                <button
                  className="btn-icon-xs danger"
                  onClick={() => setShowConfirmClear(true)}
                  title="Borrar historial"
                  style={{ marginLeft: 'auto', background: 'transparent' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="recent-songs-list">
                {recentSongs.map(rs => (
                  <button
                    key={rs.id}
                    className="btn-recent-song"
                    onClick={() => handleLoad(rs)}
                    title={`Cargar ${rs.title}`}
                  >
                    {rs.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="song-list-scroll">
            {songs.length === 0 && onlineResults.length === 0 ? (
              <div className="library-empty">
                <Music2 size={48} opacity={0.2} style={{ marginBottom: 12 }} />
                <h3>No hay canciones aquí</h3>
                <p>Crea una canción nueva o ajusta tu búsqueda.</p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button className="btn-primary" onClick={() => { if (searchQuery.trim()) { createSongFromSearch() } else if (canCreateSong(ownSongCount)) { openEditor() } }}>
                    <Plus size={16} /> {searchQuery.trim() ? `Crear «${searchQuery.trim()}»` : 'Crear canción'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {songs.map(song => {
                  const rank = songRanking.get(song.id ?? 0) ?? Infinity
                  return (
                    <SongListItem
                      key={song.id}
                      song={song}
                      rank={rank}
                      onEdit={handleEdit}
                      onLoad={handleLoad}
                      onDelete={handleDelete}
                      onPublish={handlePublish}
                    />
                  )
                })}
                {searchQuery.trim() && canCreateSong(ownSongCount) && (
                  <button
                    className="cross-tab-hint"
                    onClick={createSongFromSearch}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% - 12px)',
                      margin: '6px', padding: '8px 12px', fontSize: 12, textAlign: 'left',
                      background: 'transparent', border: '1px dashed var(--border)',
                      borderRadius: 'var(--radius)', color: 'var(--gold)', cursor: 'pointer'
                    }}
                  >
                    <Plus size={14} />
                    <span>Crear «{searchQuery.trim()}» como canción nueva</span>
                  </button>
                )}
                {onlineResults.length > 0 && (
                  <div style={{
                    borderTop: '1px solid var(--border)',
                    margin: '8px 6px',
                    paddingTop: 8
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 11, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      marginBottom: 4, padding: '0 6px'
                    }}>
                      <Globe size={12} /> Resultados en línea
                    </div>
                    {onlineResults.map(song => (
                      <SongListItem
                        key={song.remoteId ?? song.title}
                        song={song}
                        onEdit={handleEdit}
                        onLoad={handleLoad}
                        onDelete={handleDelete}
                        showImport
                        onImport={handleImportFromCommunity}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Lado Derecho: Selector de Estrofas (Control en Vivo) */}
        <div className="library-preview-pane">
          <LiveSelection />
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message={`¿Eliminar "${confirmDelete.title}"?`}
          onConfirm={confirmDeleteSong}
          onCancel={() => setConfirmDelete(null)}
          danger={true}
          confirmLabel="Eliminar"
        />
      )}
      {showConfirmClear && (
        <ConfirmDialog
          message="¿Seguro que quieres eliminar el historial de canciones?"
          onConfirm={() => {
            clearRecentSongs()
            setShowConfirmClear(false)
          }}
          onCancel={() => setShowConfirmClear(false)}
          danger={true}
          confirmLabel="Eliminar"
        />
      )}

      {showOnlineSearch && <LyricsSearchModal onClose={() => setShowOnlineSearch(false)} />}

      {importStatus && (
        <div role="status" aria-live="polite" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '10px 20px', fontSize: 13,
          zIndex: 2000, boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          {importStatus}
        </div>
      )}
    </div>
  )
}

const SongListItem = memo(function SongListItem({
  song, rank, onEdit, onLoad, onDelete, showImport, onImport, onPublish
}: {
  song: Song,
  rank?: number,
  onEdit: (s: Song) => void,
  onLoad: (s: Song) => void,
  onDelete: (s: Song) => void,
  showImport?: boolean
  onImport?: (s: Song) => void
  onPublish?: (s: Song) => void
}) {
  const activeTitle = useProjectionStore(s => s.state.songTitle)
  const { user, userRole, guestMode } = useAppStore(useShallow(s => ({ user: s.user, userRole: s.userRole, guestMode: s.guestMode })))
  const isActive = activeTitle === song.title

  const handleClick = () => {
    onLoad(song)
  }

  const getStatusIcon = () => {
    if (!song.isPublic && song.rejectionReason) return <span title={`Rechazada: ${song.rejectionReason}`}><X size={12} style={{ color: 'var(--red, #e5484d)' }} /></span>
    if (!song.isPublic) return <span title="No publicada — solo visible para ti"><Lock size={12} className="status-icon-private" /></span>
    if (song.isPublic && !song.isVerified) return <span title="Pendiente de verificación"><Clock size={12} className="status-icon-pending" /></span>
    if (song.isPublic && song.isVerified) return <span title="Canción verificada"><ShieldCheck size={12} className="status-icon-verified" /></span>
    return null
  }

  const isPending = song.isPublic && !song.isVerified

  return (
    <div
      className={`song-card-compact ${isActive ? 'active' : ''}`}
      onClick={handleClick}
    >
      <div className="song-card-info">
        <div className="song-card-title-row">
          <div className="song-card-title">{song.title}</div>
          {getStatusIcon()}
          {rank && rank > 0 && <span className="rank-badge" title={`#${rank} en uso`}>#{rank}</span>}
        </div>
        <div className="song-card-artist">{song.artist || 'Sin artista'}</div>
      </div>
      <div className="song-card-actions-mini">
        {showImport ? (
          <button className="btn-icon-xs" onClick={(e) => { e.stopPropagation(); onImport?.(song); }} aria-label={`Importar ${song.title}`} title="Importar a mi cancionero">
            <Download size={12} />
          </button>
        ) : (
          <>
            {user && user?.id === song.userId && !song.isPublic && (
              <button className="btn-icon-xs" onClick={(e) => { e.stopPropagation(); onPublish?.(song); }} aria-label={`Publicar ${song.title}`} title="Publicar en la comunidad" style={{ color: 'var(--green)' }}>
                <Globe size={12} />
              </button>
            )}
            {(song.isPublic || user?.id === song.userId || userRole === 'admin') && (
              <button className="btn-icon-xs" onClick={(e) => { e.stopPropagation(); onEdit(song); }} aria-label={`Editar ${song.title}`} title="Editar">
                <Edit2 size={12} />
              </button>
            )}
            {(userRole === 'admin' || user?.id === song.userId) && (
              <button className="btn-icon-xs danger" onClick={(e) => { e.stopPropagation(); onDelete(song); }} aria-label={`Eliminar ${song.title}`} title="Eliminar permanentemente">
                <Trash2 size={12} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
})

