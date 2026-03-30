import { useEffect, useState } from 'react'
import { Search, Music2, Edit2, Trash2, Play, Plus, Menu, ShieldCheck, Clock, Lock } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { useAppStore, useProjectionStore } from '@/stores'
import type { Song } from '@/types'
import OnlineSearchModal from '@/components/OnlineSearchModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { fetchSongs, deleteSong as deleteSongRemote, updateSong as updateSongRemote } from '@/services/supabase'

export default function LibraryView() {
  const { searchQuery, setSearchQuery, setActiveView, setEditingSong, user, userRole, isSidebarOpen, toggleSidebar } = useAppStore()
  const { loadSong } = useProjectionStore()
  const [showOnlineSearch, setShowOnlineSearch] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [selectedLang, setSelectedLang] = useState<string>('')
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Song | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)

  // Sincronizar Supabase -> Dexie al montar y cuando cambie el filtro de búsqueda principal
  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      setLoadingRemote(true)
      setRemoteError(null)
      try {
        const remoteSongs = await fetchSongs()
        if (cancelled) return
        
        // Limpiar Dexie y poner lo nuevo de Supabase para asegurar coherencia (especialmente al cambiar de usuario)
        await db.songs.clear()
        await db.songs.bulkPut(remoteSongs)
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const [filter, setFilter] = useState<'all' | 'pending'>('all')

  const songs = useLiveQuery(async () => {
    let query = db.songs.orderBy('title')
    
    // Aplicar filtros manuales
    let results = await query.toArray()
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      results = results.filter(s => 
        s.title.toLowerCase().includes(q) || 
        s.artist.toLowerCase().includes(q) ||
        s.lyrics.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    if (selectedTag) {
      results = results.filter(s => s.tags.includes(selectedTag))
    }

    if (selectedLang) {
      results = results.filter(s => s.language === selectedLang)
    }

    if (filter === 'pending') {
      results = results.filter(s => s.isPublic && !s.isVerified)
    }
    
    return results
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
            <h1>Biblioteca</h1>
            <span className="song-count">{songs.length} canciones</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => setShowOnlineSearch(true)}>
            <Search size={15} /> Buscar online
          </button>
          <button className="btn-primary" onClick={() => { setEditingSong(null); setActiveView('editor') }} aria-label="Crear nueva canción">
            <Plus size={15} /> Nueva
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
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
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
              songs.map(song => (
                <SongListItem 
                  key={song.id} 
                  song={song} 
                  onEdit={handleEdit} 
                  onLoad={handleLoad} 
                  onDelete={handleDelete}
                />
              ))
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
    </div>
  )
}

function SongListItem({ song, onEdit, onLoad, onDelete }: { song: Song, onEdit: (s: Song) => void, onLoad: (s: Song) => void, onDelete: (s: Song) => void }) {
  const activeTitle = useProjectionStore(s => s.state.songTitle)
  const { user, userRole } = useAppStore()
  const isActive = activeTitle === song.title

  const getStatusIcon = () => {
    if (!song.isPublic) return <span title="Solo visible para ti"><Lock size={12} className="status-icon-private" /></span>
    if (song.isPublic && !song.isVerified) return <span title="Pendiente de verificación"><Clock size={12} className="status-icon-pending" /></span>
    if (song.isPublic && song.isVerified) return <span title="Canción verificada"><ShieldCheck size={12} className="status-icon-verified" /></span>
    return null
  }

  return (
    <div 
      className={`song-card-compact ${isActive ? 'active' : ''}`}
      onClick={() => onLoad(song)}
    >
      <div className="song-card-info">
        <div className="song-card-title-row">
          <div className="song-card-title">{song.title}</div>
          {getStatusIcon()}
        </div>
        <div className="song-card-artist">{song.artist || 'Sin artista'}</div>
      </div>
      {(userRole === 'admin' || user?.id === song.userId) && (
        <div className="song-card-actions-mini">
          <button className="btn-icon-xs" onClick={(e) => { e.stopPropagation(); onEdit(song); }} aria-label={`Editar ${song.title}`} title="Editar">
            <Edit2 size={12} />
          </button>
          {userRole === 'admin' && (
            <button className="btn-icon-xs danger" onClick={(e) => { e.stopPropagation(); onDelete(song); }} aria-label={`Eliminar ${song.title}`} title="Eliminar">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function LiveSelection() {
  const { state, goToSlide, nextSlide, prevSlide, clearSong } = useProjectionStore()
  const { slides, currentSlide, songTitle } = state

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
        <button className="btn-icon danger" onClick={clearSong} title="Cerrar">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="live-slides-grid">
        {slides.map((slide, i) => (
          <button
            key={i}
            className={`live-slide-card ${i === currentSlide ? 'active' : ''}`}
            onClick={() => goToSlide(i)}
          >
            <span className="live-slide-number">{i + 1}</span>
            <div className="live-slide-content">
              {slide.lines.map((line, li) => (
                <div key={li} className="live-slide-line">{line}</div>
              ))}
            </div>
            {slide.label && <span className="live-slide-label">{slide.label}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
