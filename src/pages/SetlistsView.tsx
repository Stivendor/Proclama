import { useState, useEffect, useMemo, memo } from 'react'
import { Plus, List, Play, Trash2, Calendar, Edit2, GripVertical, Menu, Search, X, Globe, Cloud, CloudOff } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '@/db'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import type { Setlist, Song } from '@/types'
import * as supabaseService from '@/services/supabase'
import OnlineSearchModal from '@/components/OnlineSearchModal'
import ConfirmDialog from '@/components/ConfirmDialog'

const SortableSongItem = memo(function SortableSongItem({ songId, song, onRemove, onActivate }: { songId: number; song: Song | undefined; onRemove: () => void; onActivate: (s: Song) => void }) {
  const activeTitle = useProjectionStore(s => s.state.songTitle)
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: songId })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const isActive = song?.title === activeTitle

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`setlist-song-item ${isActive ? 'active' : ''}`}
      onClick={() => song && onActivate(song)}
    >
      <span className="drag-handle" {...attributes} {...listeners} title="Reordenar"><GripVertical size={14} /></span>
      <div className="setlist-song-info">
        <span className="setlist-song-name">{song?.title ?? '...'}</span>
        {song?.artist && <span className="setlist-song-artist">{song.artist}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {song?.key && <span className="song-key-sm">{song.key}</span>}
        <button
          className="btn-icon danger sm"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Quitar de la lista"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
})

export default function SetlistsView() {
  const loadSong = useProjectionStore(s => s.loadSong)
  const { setActiveSetlist, user, userPlan, isSidebarOpen, toggleSidebar, setActiveView, authStatus } = useAppStore(useShallow(s => ({
    setActiveSetlist: s.setActiveSetlist,
    user: s.user,
    userPlan: s.userPlan,
    isSidebarOpen: s.isSidebarOpen,
    toggleSidebar: s.toggleSidebar,
    setActiveView: s.setActiveView,
    authStatus: s.authStatus
  })))
  const [editingSetlist, setEditingSetlist] = useState<Setlist | null>(null)
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [cloudSetlists, setCloudSetlists] = useState<Setlist[]>([])
  const [songSearch, setSongSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedLang, setSelectedLang] = useState('')
  const [loading, setLoading] = useState(false)
  const [showOnlineSearch, setShowOnlineSearch] = useState(false)
  const [confirmDeleteSl, setConfirmDeleteSl] = useState<Setlist | null>(null)

  const localSetlists = useLiveQuery(async () => {
    try {
      return await db.setlists.orderBy('date').reverse().toArray()
    } catch {
      return []
    }
  }) ?? []

  const allSongs = useLiveQuery(async () => {
    try {
      return await db.songs.orderBy('title').toArray()
    } catch {
      return []
    }
  }) ?? []

  // Batch load all songs for the editing setlist (fixes N+1 query pattern)
  const setlistSongs = useLiveQuery(
    async () => {
      try {
        if (!editingSetlist) return []
        const songs = await db.songs.bulkGet(editingSetlist.songIds)
        return songs.filter((s): s is Song => !!s)
      } catch {
        return []
      }
    },
    [editingSetlist?.songIds]
  ) ?? []

  // Extraer tags y lenguajes únicos para los filtros
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    allSongs.forEach(s => s.tags?.forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [allSongs])

  const allLangs = useMemo(() => {
    const langs = new Set<string>()
    allSongs.forEach(s => s.language && langs.add(s.language))
    return Array.from(langs).sort()
  }, [allSongs])

  // Cargar setlists de Supabase si hay usuario.
  // Usa userId (string primitivo) + authStatus para detectar login con Google OAuth.
  const userId = user?.id ?? null
  useEffect(() => {
    // No hacer nada hasta que auth esté resuelto
    if (authStatus === 'loading') return

    setCloudSetlists([])
    if (!userId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const loadData = async () => {
      try {
        const data = await supabaseService.fetchSetlists()
        if (!cancelled) setCloudSetlists(data || [])
      } catch (err) {
        console.error('Failed to load setlists:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()

    // Safety timeout: si en 8 segundos no ha terminado, quitar el loading
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 8000)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [userId, authStatus])

  const setlists = user ? cloudSetlists : localSetlists

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const createSetlist = async () => {
    if (!newName.trim()) return
    const now = new Date()
    const newSl: Omit<Setlist, 'id'> = {
      name: newName,
      date: now,
      songIds: [],
      createdAt: now,
      updatedAt: now,
      userId: user?.id
    }

    if (user) {
      if (userPlan !== 'premium' && (user as any).role !== 'admin') {
        alert('La sincronización en la nube es una función Premium. Tu setlist se guardará localmente.')
        try {
          await db.setlists.add(newSl as Setlist)
          setNewName('')
          setShowNew(false)
        } catch (e: any) {
          alert('Error al crear setlist local: ' + e.message)
        }
        return
      }

      const created = await supabaseService.createSetlist(newSl)
      if (created) {
        setNewName('')
        setShowNew(false)
        const updated = await supabaseService.fetchSetlists()
        setCloudSetlists(updated)
      } else {
        alert('Error al crear el setlist en la nube. Verifica tu conexión.')
      }
    } else {
      try {
        await db.setlists.add(newSl as Setlist)
        setNewName('')
        setShowNew(false)
      } catch (e: any) {
        alert('Error al crear setlist local: ' + e.message)
      }
    }
  }

  const deleteSetlist = async (sl: Setlist) => {
    setConfirmDeleteSl(sl)
  }

  const confirmDeleteSetlist = async () => {
    const sl = confirmDeleteSl
    if (!sl) return
    setConfirmDeleteSl(null)
    if (user && sl.id) {
      await supabaseService.deleteSetlist(sl.id)
      setCloudSetlists(cloudSetlists.filter(s => s.id !== sl.id))
    } else if (sl.id) {
      await db.setlists.delete(sl.id)
    }
    if (editingSetlist?.id === sl.id) setEditingSetlist(null)
  }

  const updateSetlistInState = async (id: number, updates: Partial<Setlist>) => {
    if (user) {
      const updated = await supabaseService.updateSetlist(id, updates)
      if (updated) {
        setCloudSetlists(cloudSetlists.map(s => s.id === id ? updated : s))
        if (editingSetlist?.id === id) setEditingSetlist(updated)
      }
    } else {
      await db.setlists.update(id, updates)
      if (editingSetlist?.id === id) setEditingSetlist({ ...editingSetlist, ...updates })
    }
  }

  const addSongToSetlist = async (songId: number) => {
    if (!editingSetlist?.id) return
    if (editingSetlist.songIds.includes(songId)) return
    const updatedIds = [...editingSetlist.songIds, songId]
    await updateSetlistInState(editingSetlist.id, { songIds: updatedIds, updatedAt: new Date() })
  }

  const removeSongFromSetlist = async (songId: number) => {
    if (!editingSetlist?.id) return
    const updatedIds = editingSetlist.songIds.filter(id => id !== songId)
    await updateSetlistInState(editingSetlist.id, { songIds: updatedIds, updatedAt: new Date() })
  }

  const handleDragEnd = async (event: any) => {
    if (!editingSetlist?.id) return
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = editingSetlist.songIds.indexOf(active.id)
      const newIndex = editingSetlist.songIds.indexOf(over.id)
      const newOrder = arrayMove(editingSetlist.songIds, oldIndex, newIndex)
      await updateSetlistInState(editingSetlist.id, { songIds: newOrder, updatedAt: new Date() })
    }
  }

  const activateSetlist = async (sl: Setlist) => {
    setActiveSetlist(sl)
    if (sl.songIds.length > 0) {
      const song = await db.songs.get(sl.songIds[0])
      if (song) loadSong(song)
    }
  }

  const filteredSongs = useMemo(() => {
    if (!editingSetlist) return []
    return allSongs
      .filter(s => !editingSetlist.songIds.includes(s.id!))
      .filter(s => {
        const search = songSearch.toLowerCase()
        const matchSearch = !search ||
          s.title.toLowerCase().includes(search) ||
          (s.artist?.toLowerCase() || '').includes(search) ||
          s.tags?.some(t => t.toLowerCase().includes(search))

        const matchTag = !selectedTag || s.tags?.includes(selectedTag)
        const matchLang = !selectedLang || s.language === selectedLang

        return matchSearch && matchTag && matchLang
      })
      .slice(0, 50)
  }, [allSongs, editingSetlist, songSearch, selectedTag, selectedLang])

  return (
    <div className="setlists-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
          )}
          <h1>Setlists {user && <span className="badge">Nube</span>}</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={15} /> Nuevo Setlist
        </button>
      </div>

      {/* Banner de sincronización para usuarios no autenticados */}
      {!user && (
        <div className="sync-banner">
          <CloudOff size={18} />
          <span>Modo local activo — tus setlists se guardan en este dispositivo</span>
          <button className="sync-banner-btn" onClick={() => setActiveView('settings')}>
            <Cloud size={14} /> Sincronizar en la nube
          </button>
        </div>
      )}

      {showNew && (
        <div className="new-setlist-form">
          <input
            type="text" placeholder='Nombre del setlist (ej. "Domingo 9 Mar — Mañana")'
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createSetlist()}
            autoFocus
          />
          <button className="btn-primary" onClick={createSetlist}>Crear</button>
          <button className="btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
        </div>
      )}

      <div className="setlists-body">
        {/* Lista de setlists */}
        <div className="setlists-list">
          {loading && <p className="loading-hint">Cargando setlists...</p>}
          {!loading && setlists.length === 0 && (
            <div className="library-empty">
              <List size={48} opacity={0.2} style={{ marginBottom: 12 }} />
              <h3>Aún no tienes Setlists</h3>
              <p>Agrupa canciones para tu próximo servicio o evento, manteniendo un orden listo para proyectar.</p>
              <div style={{ marginTop: '16px' }}>
                <button className="btn-primary" onClick={() => setShowNew(true)}>
                  <Plus size={16} /> Crear Setlist
                </button>
              </div>
            </div>
          )}
          {setlists.map(sl => (
            <div key={sl.id} className={`setlist-card ${editingSetlist?.id === sl.id ? 'selected' : ''}`}>
              <div className="setlist-card-info" onClick={() => setEditingSetlist(sl)}>
                <div className="setlist-name">{sl.name}</div>
                <div className="setlist-meta">
                  <Calendar size={12} />
                  {new Date(sl.date).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                  · {sl.songIds.length} canciones
                </div>
              </div>
              <div className="song-card-actions">
                <button className="btn-icon" onClick={() => activateSetlist(sl)} title="Activar en vivo">
                  <Play size={14} />
                </button>
                <button className="btn-icon" onClick={() => setEditingSetlist(sl)} title="Editar">
                  <Edit2 size={14} />
                </button>
                <button className="btn-icon danger" onClick={() => deleteSetlist(sl)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Editor de setlist */}
        {editingSetlist && (
          <div className="setlist-editor">
            <div className="editor-header-row">
              <h3>{editingSetlist.name}</h3>
              <button className="btn-icon sm" onClick={() => setEditingSetlist(null)} title="Cerrar editor">
                <X size={16} />
              </button>
            </div>

            {/* Orden de canciones con drag & drop */}
            <div className="setlist-songs-section">
              <h4>Orden del servicio</h4>
              {editingSetlist.songIds.length === 0 ? (
                <p className="empty-hint">Agrega canciones buscando abajo</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={editingSetlist.songIds} strategy={verticalListSortingStrategy}>
                    {editingSetlist.songIds.map((id, index) => {
                      const song = setlistSongs[index]
                      return (
                        <SortableSongItem
                          key={id}
                          songId={id}
                          song={song}
                          onRemove={() => removeSongFromSetlist(id)}
                          onActivate={loadSong}
                        />
                      )
                    })}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Agregar canciones */}
            <div className="setlist-add-section">
              <div className="section-header-row">
                <h4>Agregar cualquier canción</h4>
                <div className="add-section-toolbar">
                  <button className="btn-ghost sm" onClick={() => setShowOnlineSearch(true)}>
                    <Globe size={14} /> Buscar online
                  </button>
                  <div className="search-box sm">
                    <Search size={14} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Buscar por título, artista o etiqueta..."
                      value={songSearch}
                      onChange={e => setSongSearch(e.target.value)}
                    />
                    {songSearch && (
                      <button className="clear-search" onClick={() => setSongSearch('')}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="filters-row-compact">
                <select className="filter-select-sm" value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
                  <option value="">Todas las etiquetas</option>
                  {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="filter-select-sm" value={selectedLang} onChange={e => setSelectedLang(e.target.value)}>
                  <option value="">Todos los idiomas</option>
                  {allLangs.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="add-songs-list highlight">
                {filteredSongs.length === 0 ? (
                  <p className="empty-hint">No se encontraron canciones con esos filtros</p>
                ) : (
                  filteredSongs.map(s => (
                    <button key={s.id} className="add-song-btn-large" onClick={() => addSongToSetlist(s.id!)}>
                      <div className="add-song-btn-main">
                        <Plus size={14} className="add-icon" />
                        <div className="song-info">
                          <span className="title">{s.title}</span>
                          <span className="artist">{s.artist || 'Sin artista'}</span>
                        </div>
                      </div>
                      {s.key && <span className="song-key-sm">{s.key}</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {showOnlineSearch && <OnlineSearchModal onClose={() => setShowOnlineSearch(false)} />}
      {confirmDeleteSl && (
        <ConfirmDialog
          message={`¿Eliminar "${confirmDeleteSl.name}"?`}
          onConfirm={confirmDeleteSetlist}
          onCancel={() => setConfirmDeleteSl(null)}
        />
      )}

      <style>{`
        .sync-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed var(--border);
          border-radius: 8px;
          margin: 0 20px 16px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .sync-banner svg:first-child { color: var(--text-muted); }
        .sync-banner-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: var(--gold);
          color: black;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          margin-left: auto;
          transition: all 0.15s;
        }
        .sync-banner-btn:hover {
          background: var(--gold-hover);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  )
}
