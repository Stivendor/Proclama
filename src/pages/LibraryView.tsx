import { useEffect, useState } from 'react'
import { Search, Music2, Edit2, Trash2, Play, Download, Upload, Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { useAppStore, useProjectionStore } from '@/stores'
import type { Song } from '@/types'
import OnlineSearchModal from '@/components/OnlineSearchModal'
import { fetchSongs, deleteSong as deleteSongRemote, updateSong as updateSongRemote } from '@/services/supabase'

export default function LibraryView() {
  const { searchQuery, setSearchQuery, setActiveView, setEditingSong, user, church } = useAppStore()
  const { loadSong } = useProjectionStore()
  const [showOnlineSearch, setShowOnlineSearch] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [selectedLang, setSelectedLang] = useState<string>('')
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)

  // Sincronizar Supabase -> Dexie al montar y cuando cambie el filtro de búsqueda principal
  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      setLoadingRemote(true)
      setRemoteError(null)
      try {
        const remoteSongs = await fetchSongs(church!.id)
        if (cancelled) return
        await db.songs.clear()
        await db.songs.bulkAdd(remoteSongs)
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
  }, [])

  const songs = useLiveQuery(async () => {
    let query = db.songs.orderBy('title')
    const all = await query.toArray()

    return all.filter(s => {
      const q = searchQuery.toLowerCase()
      const matchSearch = !q ||
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.lyrics.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      const matchTag = !selectedTag || s.tags.includes(selectedTag)
      const matchLang = !selectedLang || s.language === selectedLang
      return matchSearch && matchTag && matchLang
    })
  }, [searchQuery, selectedTag, selectedLang]) ?? []

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
    if (confirm(`¿Eliminar "${song.title}"?`)) {
      // Primero remoto, luego local
      if (song.id != null) {
        await deleteSongRemote(song.id, church!.id)
        await db.songs.delete(song.id)
      }
    }
  }

  const handleLoad = async (song: Song) => {
    loadSong(song)
    if (song.id != null) {
      const newUsage = (song.usageCount || 0) + 1
      await updateSongRemote(song.id, church!.id, { usageCount: newUsage })
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
      alert(`✅ ${toAdd.length} canciones importadas`)
    } catch {
      alert('Error al importar. Verifica el formato del archivo.')
    }
    e.target.value = ''
  }

  return (
    <div className="library-view">
      {/* Header */}
      <div className="view-header">
        <div>
          <h1>Biblioteca</h1>
          <span className="song-count">{songs.length} canciones</span>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => setShowOnlineSearch(true)}>
            <Search size={15} /> Buscar online
          </button>
          <label className="btn-ghost" title="Importar JSON">
            <Upload size={15} /> Importar
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
          <button className="btn-ghost" onClick={handleExport}>
            <Download size={15} /> Exportar
          </button>
          <button className="btn-primary" onClick={() => { setEditingSong(null); setActiveView('editor') }}>
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
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="song-list-scroll">
            {songs.length === 0 ? (
              <div className="library-empty">
                <Music2 size={32} opacity={0.2} />
                <p>No hay canciones</p>
              </div>
            ) : (
              songs.map(song => (
                <SongListItem 
                  key={song.id} 
                  song={song} 
                  onEdit={handleEdit} 
                  onLoad={handleLoad} 
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
    </div>
  )
}

function SongListItem({ song, onEdit, onLoad }: { song: Song, onEdit: (s: Song) => void, onLoad: (s: Song) => void }) {
  const activeTitle = useProjectionStore(s => s.state.songTitle)
  const user = useAppStore(s => s.user)
  const isActive = activeTitle === song.title

  return (
    <div 
      className={`song-card-compact ${isActive ? 'active' : ''}`}
      onClick={() => onLoad(song)}
    >
      <div className="song-card-info">
        <div className="song-card-title">{song.title}</div>
        <div className="song-card-artist">{song.artist || 'Sin artista'}</div>
      </div>
      {user && (
        <div className="song-card-actions-mini">
          <button className="btn-icon-xs" onClick={(e) => { e.stopPropagation(); onEdit(song); }} title="Editar">
            <Edit2 size={12} />
          </button>
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
      <div className="live-selection-empty">
        <Play size={48} opacity={0.1} />
        <p>Selecciona una canción para proyectar</p>
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
