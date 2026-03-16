import { useEffect, useState } from 'react'
import { Search, Music2, Edit2, Trash2, Play, Download, Upload, Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { useAppStore, useProjectionStore } from '@/stores'
import type { Song } from '@/types'
import OnlineSearchModal from '@/components/OnlineSearchModal'
import { fetchSongs, deleteSong as deleteSongRemote, updateSong as updateSongRemote } from '@/services/supabase'

export default function LibraryView() {
  const { searchQuery, setSearchQuery, setActiveView, setEditingSong } = useAppStore()
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
        const remoteSongs = await fetchSongs()
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
        await deleteSongRemote(song.id)
        await db.songs.delete(song.id)
      }
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

      {/* Search + filters */}
      <div className="library-filters">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por título, artista, letra o etiqueta..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <select value={selectedTag} onChange={e => setSelectedTag(e.target.value)} className="filter-select">
          <option value="">Todas las etiquetas</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={selectedLang} onChange={e => setSelectedLang(e.target.value)} className="filter-select">
          <option value="">Todos los idiomas</option>
          {allLangs.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {loadingRemote && (
        <div className="sync-status">Sincronizando con Supabase…</div>
      )}
      {remoteError && (
        <div className="sync-error">{remoteError}</div>
      )}

      {/* Song list */}
      {songs.length === 0 ? (
        <div className="library-empty">
          <Music2 size={48} opacity={0.2} />
          <p>No se encontraron canciones</p>
          {searchQuery && <span>Prueba con otro término de búsqueda</span>}
        </div>
      ) : (
        <div className="song-list">
          {songs.map(song => (
            <div key={song.id} className="song-card">
              <div className="song-card-info" onClick={() => handleLoad(song)}>
                <div className="song-card-title">{song.title}</div>
                <div className="song-card-meta">
                  {song.artist && <span>{song.artist}</span>}
                  {song.key && <span className="song-key">{song.key}</span>}
                  {song.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
              <div className="song-card-actions">
                <button className="btn-icon" onClick={() => handleLoad(song)} title="Proyectar">
                  <Play size={15} />
                </button>
                <button className="btn-icon" onClick={() => handleEdit(song)} title="Editar">
                  <Edit2 size={15} />
                </button>
                <button className="btn-icon danger" onClick={() => handleDelete(song)} title="Eliminar">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showOnlineSearch && <OnlineSearchModal onClose={() => setShowOnlineSearch(false)} />}
    </div>
  )
}
