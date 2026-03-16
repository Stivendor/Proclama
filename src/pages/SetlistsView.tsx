import { useState } from 'react'
import { Plus, List, Play, Trash2, Calendar, Edit2, GripVertical } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '@/db'
import { useAppStore, useProjectionStore } from '@/stores'
import type { Setlist, Song } from '@/types'

function SortableSongItem({ songId, onRemove }: { songId: number; onRemove: () => void }) {
  const song = useLiveQuery(() => db.songs.get(songId), [songId])
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: songId })

  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="setlist-song-item">
      <span className="drag-handle" {...attributes} {...listeners}><GripVertical size={14} /></span>
      <span className="setlist-song-name">{song?.title ?? '...'}</span>
      {song?.artist && <span className="setlist-song-artist">{song.artist}</span>}
      {song?.key && <span className="song-key">{song.key}</span>}
      <button className="btn-icon danger" onClick={onRemove}><Trash2 size={12} /></button>
    </div>
  )
}

export default function SetlistsView() {
  const { loadSong } = useProjectionStore()
  const { setActiveSetlist, activeSetlist, user } = useAppStore()
  const [editingSetlist, setEditingSetlist] = useState<Setlist | null>(null)
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)

  const setlists = useLiveQuery(() => db.setlists.orderBy('date').reverse().toArray()) ?? []
  const allSongs = useLiveQuery(() => db.songs.orderBy('title').toArray()) ?? []

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const createSetlist = async () => {
    if (!newName.trim()) return
    const now = new Date()
    await db.setlists.add({ name: newName, date: now, songIds: [], createdAt: now, updatedAt: now })
    setNewName('')
    setShowNew(false)
  }

  const deleteSetlist = async (sl: Setlist) => {
    if (confirm(`¿Eliminar "${sl.name}"?`)) {
      await db.setlists.delete(sl.id!)
      if (editingSetlist?.id === sl.id) setEditingSetlist(null)
    }
  }

  const addSongToSetlist = async (songId: number) => {
    if (!editingSetlist?.id) return
    if (editingSetlist.songIds.includes(songId)) return
    const updated = [...editingSetlist.songIds, songId]
    await db.setlists.update(editingSetlist.id, { songIds: updated, updatedAt: new Date() })
    setEditingSetlist(s => s ? { ...s, songIds: updated } : s)
  }

  const removeSongFromSetlist = async (songId: number) => {
    if (!editingSetlist?.id) return
    const updated = editingSetlist.songIds.filter(id => id !== songId)
    await db.setlists.update(editingSetlist.id, { songIds: updated, updatedAt: new Date() })
    setEditingSetlist(s => s ? { ...s, songIds: updated } : s)
  }

  const handleDragEnd = async (event: any) => {
    if (!editingSetlist?.id) return
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = editingSetlist.songIds.indexOf(active.id)
      const newIndex = editingSetlist.songIds.indexOf(over.id)
      const newOrder = arrayMove(editingSetlist.songIds, oldIndex, newIndex)
      await db.setlists.update(editingSetlist.id, { songIds: newOrder, updatedAt: new Date() })
      setEditingSetlist(s => s ? { ...s, songIds: newOrder } : s)
    }
  }

  const activateSetlist = async (sl: Setlist) => {
    setActiveSetlist(sl)
    // Cargar primera canción del setlist
    if (sl.songIds.length > 0) {
      const song = await db.songs.get(sl.songIds[0])
      if (song) loadSong(song)
    }
  }

  return (
    <div className="setlists-view">
      <div className="view-header">
        <h1>Setlists</h1>
        <button 
          className="btn-primary" 
          onClick={() => setShowNew(true)}
          disabled={!user}
          title={!user ? "Inicia sesión para crear setlists" : ""}
        >
          <Plus size={15} /> Nuevo Setlist
        </button>
      </div>

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
          {setlists.length === 0 && (
            <div className="library-empty">
              <List size={40} opacity={0.2} />
              <p>No hay setlists</p>
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
                {user && (
                  <>
                    <button className="btn-icon" onClick={() => setEditingSetlist(sl)} title="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button className="btn-icon danger" onClick={() => deleteSetlist(sl)}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Editor de setlist */}
        {editingSetlist && (
          <div className="setlist-editor">
            <h3>{editingSetlist.name}</h3>

            {/* Orden de canciones con drag & drop */}
            <div className="setlist-songs-section">
              <h4>Orden del servicio</h4>
              {editingSetlist.songIds.length === 0 ? (
                <p className="empty-hint">Agrega canciones desde la lista de abajo</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={editingSetlist.songIds} strategy={verticalListSortingStrategy}>
                    {editingSetlist.songIds.map(id => (
                      <SortableSongItem key={id} songId={id} onRemove={() => removeSongFromSetlist(id)} />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Agregar canciones */}
            <div className="setlist-add-section">
              <h4>Agregar canciones</h4>
              <div className="add-songs-list">
                {allSongs
                  .filter(s => !editingSetlist.songIds.includes(s.id!))
                  .map(s => (
                    <button key={s.id} className="add-song-btn" onClick={() => addSongToSetlist(s.id!)}>
                      <Plus size={12} /> {s.title}
                      {s.artist && <span className="dim"> — {s.artist}</span>}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
