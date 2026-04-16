import { useState, useMemo, memo } from 'react'
import { Plus, List, Play, Trash2, Calendar, Edit2, GripVertical, Menu, Search, X, Globe, Pencil } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '@/db'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import type { Setlist, Song } from '@/types'
import OnlineSearchModal from '@/components/OnlineSearchModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { containsIgnoreAccents } from '@/utils/text'

const SortableSongItem = memo(function SortableSongItem({ songId, song, onRemove, onActivate, onEdit }: { songId: number; song: Song | undefined; onRemove: () => void; onActivate: (s: Song) => void; onEdit: (s: Song) => void }) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {song?.key && <span className="song-key-sm">{song.key}</span>}
        <button
          className="btn-icon sm"
          onClick={(e) => { e.stopPropagation(); song && onEdit(song); }}
          title="Editar canción"
        >
          <Pencil size={12} />
        </button>
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
  const { setActiveSetlist, setActiveView, setEditingSong, user, isSidebarOpen, toggleSidebar } = useAppStore(useShallow(s => ({
    setActiveSetlist: s.setActiveSetlist,
    setActiveView: s.setActiveView,
    setEditingSong: s.setEditingSong,
    user: s.user,
    isSidebarOpen: s.isSidebarOpen,
    toggleSidebar: s.toggleSidebar,
  })))
  const [editingSetlist, setEditingSetlist] = useState<Setlist | null>(null)
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [songSearch, setSongSearch] = useState('')
  const [showOnlineSearch, setShowOnlineSearch] = useState(false)
  const [confirmDeleteSl, setConfirmDeleteSl] = useState<Setlist | null>(null)
  const [creating, setCreating] = useState(false)

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

  // Batch load all songs for the editing setlist
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

  const setlists = useMemo(() => {
    return localSetlists.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [localSetlists])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const createSetlist = async () => {
    if (!newName.trim() || creating) return
    setCreating(true)
    const now = new Date()
    try {
      const newSl: Omit<Setlist, 'id'> = {
        name: newName,
        date: now,
        songIds: [],
        createdAt: now,
        updatedAt: now,
        userId: user?.id
      }

      await db.setlists.add(newSl as Setlist)
      setNewName('')
      setShowNew(false)
    } catch (e: any) {
      alert('Error al crear setlist: ' + e.message)
    } finally {
      setCreating(false)
    }
  }

  const deleteSetlist = async (sl: Setlist) => {
    setConfirmDeleteSl(sl)
  }

  const confirmDeleteSetlist = async () => {
    const sl = confirmDeleteSl
    if (!sl || !sl.id) return
    setConfirmDeleteSl(null)
    
    await db.setlists.delete(sl.id)
    if (editingSetlist?.id === sl.id) setEditingSetlist(null)
  }

  const updateSetlistInState = async (id: number, updates: Partial<Setlist>) => {
    await db.setlists.update(id, updates)
    if (editingSetlist?.id === id) {
      setEditingSetlist({ ...editingSetlist, ...updates } as any)
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
      .filter(s => !songSearch ||
        containsIgnoreAccents(s.title, songSearch) ||
        containsIgnoreAccents(s.artist || '', songSearch) ||
        s.tags?.some(t => containsIgnoreAccents(t, songSearch))
      )
      .slice(0, 50)
  }, [allSongs, editingSetlist, songSearch])

  return (
    <div className="setlists-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
          )}
          <h1>Setlists</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={15} /> Nuevo Setlist
          </button>
        </div>
      </div>

      {showNew && (
        <div className="new-setlist-form">
          <input
            type="text" placeholder='Nombre del setlist (ej. "Domingo 9 Mar — Mañana")'
            value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createSetlist()}
            autoFocus
            disabled={creating}
          />
          <button className="btn-primary" onClick={createSetlist} disabled={creating || !newName.trim()}>
            {creating ? 'Creando...' : 'Crear'}
          </button>
          <button className="btn-ghost" onClick={() => setShowNew(false)} disabled={creating}>Cancelar</button>
        </div>
      )}

      <div className="setlists-body">
        {/* Lista de setlists */}
        <div className="setlists-list">
          {setlists.length === 0 && (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="setlist-name">{sl.name}</div>
                </div>
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
                          onEdit={(s) => { setEditingSong(s); setActiveView('editor') }}
                        />
                      )
                    })}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Agregar canciones */}
            <div className="setlist-add-section">
              <div className="add-section-toolbar">
                <button className="btn-ghost sm" onClick={() => setShowOnlineSearch(true)}>
                  <Globe size={14} /> Buscar online
                </button>
                <div className="search-box sm">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar canción..."
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

              <div className="add-songs-list highlight">
                {filteredSongs.length === 0 ? (
                  <p className="empty-hint">No se encontraron canciones</p>
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

    </div>
  )
}
