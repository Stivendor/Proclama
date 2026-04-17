import { useEffect, useState, memo } from 'react'
import { Search, Music2, Edit2, Trash2, Play, Plus, Menu, ShieldCheck, Clock, Lock, Check, X, Library } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useShallow } from 'zustand/react/shallow'
import { db } from '@/db'
import { useAppStore, useProjectionStore } from '@/stores'
import type { Song } from '@/types'
import OnlineSearchModal from '@/components/OnlineSearchModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { fetchSongs, fetchSongsCount, deleteSong as deleteSongRemote, updateSong as updateSongRemote } from '@/services/supabase'
import { usePlan, FREE_SONG_LIMIT, FREE_PROJECTION_LIMIT } from '@/hooks/usePlan'
import { containsIgnoreAccents } from '@/utils/text'

export default function LibraryView() {
  const { searchQuery, setSearchQuery, setActiveView, setEditingSong, user, userRole, isSidebarOpen, toggleSidebar, authStatus } = useAppStore(useShallow(s => ({
    searchQuery: s.searchQuery, setSearchQuery: s.setSearchQuery, setActiveView: s.setActiveView, 
    setEditingSong: s.setEditingSong, user: s.user, userRole: s.userRole, 
    isSidebarOpen: s.isSidebarOpen, toggleSidebar: s.toggleSidebar,
    authStatus: s.authStatus
  })))
  const loadSong = useProjectionStore(s => s.loadSong)
  const { canCreateSong, canUseGenius, canProjectSong, isPremium } = usePlan()
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)

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

  // Auto-dismiss blocked message after 5 seconds
  useEffect(() => {
    if (!blockedMessage) return
    const timer = setTimeout(() => setBlockedMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [blockedMessage])
  const [confirmDelete, setConfirmDelete] = useState<Song | null>(null)
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
      setLoadingRemote(true)
      setRemoteError(null)
      try {
        const remoteSongs = await fetchSongs()
        if (cancelled) return

        // Operación atómica: limpiar y reemplazar en una sola transacción
        // Esto evita que useLiveQuery vea el estado intermedio (tabla vacía) y crashee con DexieError2
        await db.transaction('rw', db.songs, async () => {
          await db.songs.clear()
          if (remoteSongs.length > 0) {
            await db.songs.bulkPut(remoteSongs)
          }
        })
      } catch (err) {
        console.error('Error syncing songs from Supabase:', err)
        if (!cancelled) setRemoteError('No se pudo sincronizar con Supabase. Usando datos locales.')
      } finally {
        if (!cancelled) setLoadingRemote(false)
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

  const [filter, setFilter] = useState<'all' | 'pending'>('all')

  // Obtener ranking de canciones por uso
  const songRanking = useLiveQuery(async () => {
    const all = await db.songs.toArray()
    // Ordenar por uso descendente
    all.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))
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

    // 2. Filter by Moderation Status (Pending)
    if (filter === 'pending') {
      results = results.filter(s => s.isPublic && !s.isVerified)
    }

    // 3. Filter by Tags
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
  }, [searchQuery, selectedTag, selectedLang, filter]) ?? []

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

  const handleEdit = (song: Song) => {
    setEditingSong(song)
    setActiveView('editor')
  }

  const handleDelete = async (song: Song) => {
    setConfirmDelete(song)
  }

  const confirmDeleteSong = async () => {
    const song = confirmDelete
    if (!song) return
    setConfirmDelete(null)
    if (song.id != null) {
      await deleteSongRemote(song.id)
      await db.songs.delete(song.id)
    }
  }

  const handleLoad = async (song: Song) => {
    loadSong(song)
    if (song.id != null) {
      const newUsage = (song.usageCount || 0) + 1
      await updateSongRemote(song.id, { usageCount: newUsage })
      await db.songs.update(song.id, { usageCount: newUsage })
    }
  }

  const handleApprove = async (song: Song) => {
    if (song.id == null) return
    try {
      await updateSongRemote(song.id, { isVerified: true })
      await db.songs.update(song.id, { isVerified: true })
    } catch (err) {
      console.error('Error approving song:', err)
      setRemoteError('Error al aprobar la canción.')
    }
  }

  const handleReject = async (song: Song) => {
    if (song.id == null) return
    try {
      await updateSongRemote(song.id, { isPublic: false, isVerified: false })
      await db.songs.update(song.id, { isPublic: false, isVerified: false })
    } catch (err) {
      console.error('Error rejecting song:', err)
      setRemoteError('Error al rechazar la canción.')
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
              {songs.length} de {totalRemoteSongs ? totalRemoteSongs.toLocaleString('es') : '...'}
              {totalRemoteSongs && totalRemoteSongs > songs.length && '+'} canciones
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="btn-ghost"
            onClick={() => setShowOnlineSearch(true)}
            title={!canUseGenius ? 'Función premium — actualiza tu plan' : undefined}
          >
            <Search size={15} /> Buscar online
            {!canUseGenius && <Lock size={12} style={{ marginLeft: 4, opacity: 0.7 }} />}
          </button>
          <button
            className="btn-primary"
            onClick={() => { if (canCreateSong(ownSongCount)) { setEditingSong(null); setActiveView('editor') } }}
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

          {userRole === 'admin' && (
            <div className="moderation-tab-selector">
              <button 
                type="button"
                className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Catálogo
              </button>
              <button 
                type="button"
                className={`tab-btn ${filter === 'pending' ? 'active' : ''}`}
                onClick={() => setFilter('pending')}
                aria-label="Ver canciones pendientes de moderación"
              >
                Pendientes {songs.filter(s => s.isPublic && !s.isVerified).length > 0 && <span className="notifier"></span>}
              </button>
            </div>
          )}

          <div className="song-list-scroll">
            {songs.length === 0 ? (
              <div className="library-empty">
                <Music2 size={48} opacity={0.2} style={{ marginBottom: 12 }} />
                <h3>Tu biblioteca está vacía</h3>
                <p>Agrega canciones manualmente o búscalas en nuestra base de datos online.</p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button className="btn-primary" onClick={() => { setEditingSong(null); setActiveView('editor') }}>
                    <Plus size={16} /> Crear canción
                  </button>
                  <button className="btn-ghost" onClick={() => setShowOnlineSearch(true)}>
                    <Search size={16} /> Buscar online
                  </button>
                </div>
              </div>
            ) : (
              songs.map(song => {
                const rank = songRanking.get(song.id ?? 0) ?? 0
                const blocked = !isPremium && rank > FREE_PROJECTION_LIMIT
                return (
                <SongListItem 
                  key={song.id} 
                  song={song}
                  rank={rank}
                  blocked={blocked}
                  onEdit={handleEdit} 
                  onLoad={handleLoad} 
                  onDelete={handleDelete}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onBlocked={() => setBlockedMessage(`Solo usuarios premium pueden proyectar canciones más allá del top ${FREE_PROJECTION_LIMIT}`)}
                />
              )
              })
            )}
          </div>
        </div>

        {/* Lado Derecho: Selector de Estrofas (Control en Vivo) */}
        <div className="library-preview-pane">
          <LiveSelection />
        </div>
      </div>

      {showOnlineSearch && <OnlineSearchModal onClose={() => setShowOnlineSearch(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          message={`¿Eliminar "${confirmDelete.title}"?`}
          onConfirm={confirmDeleteSong}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
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
      {blockedMessage && (
        <div role="alert" aria-live="assertive" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-elevated)', border: '1px solid var(--red)',
          borderRadius: 'var(--radius)', padding: '12px 20px', fontSize: 13,
          zIndex: 2000, boxShadow: '0 4px 20px rgba(220,38,38,0.3)',
          display: 'flex', alignItems: 'center', gap: '10px',
          color: 'var(--red)'
        }}>
          <Lock size={16} />
          {blockedMessage}
        </div>
      )}
    </div>
  )
}

const SongListItem = memo(function SongListItem({ 
  song, rank, blocked, onEdit, onLoad, onDelete, onApprove, onReject, onBlocked 
}: { 
  song: Song, 
  rank?: number,
  blocked?: boolean,
  onEdit: (s: Song) => void, 
  onLoad: (s: Song) => void, 
  onDelete: (s: Song) => void,
  onApprove: (s: Song) => void,
  onReject: (s: Song) => void,
  onBlocked?: () => void
}) {
  const activeTitle = useProjectionStore(s => s.state.songTitle)
  const { user, userRole } = useAppStore(useShallow(s => ({ user: s.user, userRole: s.userRole })))
  const isActive = activeTitle === song.title

  const handleClick = () => {
    if (blocked) {
      onBlocked?.()
      return
    }
    onLoad(song)
  }

  const getStatusIcon = () => {
    if (!song.isPublic) return <span title="Solo visible para ti"><Lock size={12} className="status-icon-private" /></span>
    if (song.isPublic && !song.isVerified) return <span title="Pendiente de verificación"><Clock size={12} className="status-icon-pending" /></span>
    if (song.isPublic && song.isVerified) return <span title="Canción verificada"><ShieldCheck size={12} className="status-icon-verified" /></span>
    return null
  }

  const isPending = song.isPublic && !song.isVerified

  return (
    <div 
      className={`song-card-compact ${isActive ? 'active' : ''} ${blocked ? 'blocked' : ''}`}
      onClick={handleClick}
    >
      <div className="song-card-info">
        <div className="song-card-title-row">
          <div className="song-card-title">{song.title}</div>
          {getStatusIcon()}
          {blocked && <span title={`Top ${FREE_PROJECTION_LIMIT}+ — Solo premium`}><Lock size={12} className="status-icon-blocked" /></span>}
          {rank && rank > 0 && !blocked && <span className="rank-badge" title={`#${rank} en uso`}>#{rank}</span>}
        </div>
        <div className="song-card-artist">{song.artist || 'Sin artista'}</div>
      </div>
      <div className="song-card-actions-mini">
        {/* Acciones de Moderación (Solo Admin & Solo si está pendiente) */}
        {userRole === 'admin' && isPending && (
          <>
            <button 
              className="btn-icon-xs success" 
              onClick={(e) => { e.stopPropagation(); onApprove(song); }} 
              title="Aprobar y verificar"
            >
              <Check size={12} />
            </button>
            <button 
              className="btn-icon-xs warning" 
              onClick={(e) => { e.stopPropagation(); onReject(song); }} 
              title="Rechazar (volver privada)"
            >
              <X size={12} />
            </button>
          </>
        )}

        {(userRole === 'admin' || user?.id === song.userId) && (
          <button className="btn-icon-xs" onClick={(e) => { e.stopPropagation(); onEdit(song); }} aria-label={`Editar ${song.title}`} title="Editar">
            <Edit2 size={12} />
          </button>
        )}
        
        {userRole === 'admin' && (
          <button className="btn-icon-xs danger" onClick={(e) => { e.stopPropagation(); onDelete(song); }} aria-label={`Eliminar ${song.title}`} title="Eliminar permanentemente">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
})

const LiveSelection = memo(function LiveSelection() {
  const { slides, currentSlide, songTitle, goToSlide, clearSong, hideText } = useProjectionStore(useShallow(s => ({
    slides: s.state.slides,
    currentSlide: s.state.currentSlide,
    songTitle: s.state.songTitle,
    goToSlide: s.goToSlide,
    clearSong: s.clearSong,
    hideText: s.state.hideText
  })))

  if (!songTitle) {
    return (
      <div className="live-selection-empty" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px', textAlign: 'center', padding: '24px' }}>
        <Play size={48} opacity={0.1} style={{ marginBottom: 12 }} />
        <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', margin: 0 }}>Proyección inactiva</h3>
        <p style={{ fontSize: '14px', maxWidth: '300px' }}>Selecciona una canción de la lista a la izquierda para comenzar a proyectarla en vivo.</p>
      </div>
    )
  }

  return (
    <div className="live-selection">
      <div className="live-selection-header">
        <div>
          <h2>{songTitle}</h2>
          <div className="live-meta">Estrofas: {slides.length}</div>
        </div>
      </div>

      <div className="live-slides-grid">
        {slides.map((slide, i) => {
          const isActive = i === currentSlide;
          const isHiddenAndActive = isActive && hideText;
          
          return (
            <button
              key={i}
              className={`live-slide-card ${isActive ? 'active' : ''} ${isHiddenAndActive ? 'is-hidden-preview' : ''}`}
              onClick={() => goToSlide(i)}
              title={isHiddenAndActive ? "Presiona para mostrar el texto" : ""}
            >
              <span className="live-slide-number">{i + 1}</span>
              <div className="live-slide-content">
                {slide.lines.map((line, li) => (
                  <div key={li} className="live-slide-line">{line}</div>
                ))}
              </div>
              {slide.label && <span className="live-slide-label">{slide.label}</span>}
              {isHiddenAndActive && <div className="hidden-indicator-preview">OCULTO</div>}
            </button>
          );
        })}
      </div>

      <style>{`
        .live-slide-card.is-hidden-preview {
          opacity: 0.5;
          filter: grayscale(1);
          border-style: dashed;
        }
        .hidden-indicator-preview {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(220, 38, 38, 0.1);
          color: var(--red);
          font-weight: 900;
          font-size: 1.5rem;
          letter-spacing: 4px;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
})
