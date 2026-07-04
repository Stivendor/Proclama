import { useState, useMemo, memo, useEffect, useRef } from 'react'
import { Plus, List, Play, Trash2, Calendar, Edit2, GripVertical, Menu, Search, X, Globe, Pencil, LayoutGrid, Lock, Users } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '@/db'
import { pushSetlists, deleteRemoteSetlist } from '@/services/setlistSync'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import type { Setlist, Song } from '@/types'
import OnlineSearchModal from '@/components/songs/OnlineSearchModal'
import CollaboratorsModal from '@/components/setlists/CollaboratorsModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { containsIgnoreAccents } from '@/utils/text'
import { LiveSelection } from '@/components/projection/LiveSelection'

const SortableSongItem = memo(function SortableSongItem({ 
  songId, 
  song, 
  onRemove,
  onActivate,
  onEdit,
}: {
  songId: number;
  song: Song | undefined;
  onRemove: () => void;
  onActivate: (s: Song) => void;
  onEdit: (s: Song) => void;
}) {
  const activeTitle = useProjectionStore(s => s.state.songTitle)
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: songId })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const isActive = song?.title === activeTitle

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`setlist-song-item ${isActive ? 'active' : ''}`}
      onClick={() => {
        song && onActivate(song);
      }}
    >
      <span className="drag-handle" {...attributes} {...listeners} title="Reordenar"><GripVertical size={14} /></span>
      <div className="setlist-song-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="setlist-song-name">{song?.title ?? '...'}</span>
        </div>
        {song?.artist && <span className="setlist-song-artist">{song.artist}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {song?.key && <span className="song-key-sm">{song.key}</span>}
        <button
          className="btn-icon-xs"
          onClick={(e) => { e.stopPropagation(); song && onEdit(song); }}
          title="Editar canción"
        >
          <Pencil size={12} />
        </button>
        <button
          className="btn-icon-xs danger"
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
  const { setActiveSetlist, openEditor, user, isSidebarOpen, toggleSidebar } = useAppStore(useShallow(s => ({
    setActiveSetlist: s.setActiveSetlist,
    openEditor: s.openEditor,
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
  const [showCollabs, setShowCollabs] = useState(false)

  const schedulePush = () => {
    if (!user?.id) return
    // ponytail: push directo tras cada mutación; debounce solo si se nota en red
    pushSetlists(user.id).catch(e => console.warn('[SetlistSync] push failed', e))
  }

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
      schedulePush()
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

    if (sl.remoteId) deleteRemoteSetlist(sl.remoteId).catch(() => {})
    await db.setlists.delete(sl.id)
    if (editingSetlist?.id === sl.id) setEditingSetlist(null)
  }

  const updateSetlistInState = async (id: number, updates: Partial<Setlist>) => {
    await db.setlists.update(id, updates)
    schedulePush()
    if (editingSetlist?.id === id) {
      setEditingSetlist({ ...editingSetlist, ...updates } as any)
    }
  }

  const addSongToSetlist = async (song: Song) => {
    if (!editingSetlist?.id || !song.id) return

    if (editingSetlist.songIds.includes(song.id)) return
    const updatedIds = [...editingSetlist.songIds, song.id]
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
        containsIgnoreAccents(s.lyrics, songSearch) ||
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
          {user?.id && (
            <button className="btn-ghost" onClick={() => setShowCollabs(true)} title="Colaboradores">
              <Users size={16} /> Colaboradores
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={15} /> Nuevo Setlist
          </button>
        </div>
      </div>

      {showNew && (
        <div className="new-setlist-form">
          <input
            type="text" placeholder='Nombre del setlist (ej. "Domingo 9 Mar")'
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

      <div className={`setlists-body-grid ${editingSetlist ? 'with-editor' : ''}`}>
        {/* Lista de setlists (Lateral izquierdo) */}
        <div className="setlists-sidebar-panel">
          {!editingSetlist && setlists.length === 0 && (
            <div className="library-empty">
              <List size={48} opacity={0.2} style={{ marginBottom: 12 }} />
              <h3>Aún no tienes Setlists</h3>
              <p>Agrupa canciones para tu próximo servicio o evento.</p>
              <div style={{ marginTop: '16px' }}>
                <button className="btn-primary" onClick={() => setShowNew(true)}>
                  <Plus size={16} /> Crear Setlist
                </button>
              </div>
            </div>
          )}
          
          <div className="setlist-cards-container">
            {setlists.map(sl => (
              <div key={sl.id} className={`setlist-card-compact ${editingSetlist?.id === sl.id ? 'active' : ''}`} onClick={() => setEditingSetlist(sl)}>
                <div className="setlist-card-content">
                  <div className="setlist-name-row">
                    <span className="name">{sl.name}</span>
                    {editingSetlist?.id === sl.id && <Play size={12} color="var(--gold)" />}
                  </div>
                  <div className="setlist-meta-row">
                    <Calendar size={10} />
                    <span>{new Date(sl.date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>
                    <span className="dot">·</span>
                    <span>{sl.songIds.length} temas</span>
                  </div>
                </div>
                <div className="setlist-card-actions">
                   <button className="btn-icon-xs" onClick={(e) => { e.stopPropagation(); activateSetlist(sl); }} title="Activar setlist"><Play size={12} /></button>
                   <button className="btn-icon-xs danger" onClick={(e) => { e.stopPropagation(); deleteSetlist(sl); }}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor de setlist (Centro) */}
        {editingSetlist && (
          <div className="setlist-songs-panel">
            <div className="panel-header">
              <div className="title-section">
                 <button className="btn-icon-xs" onClick={() => setEditingSetlist(null)} style={{ marginRight: 8 }}><X size={14} /></button>
                 <h3>{editingSetlist.name}</h3>
              </div>
              <div className="panel-actions">
                 <button className="btn-ghost sm" onClick={() => setShowOnlineSearch(true)} title="Buscar canciones online"><Globe size={14} /></button>
              </div>
            </div>

            <div className="setlist-content-scroll">
              <div className="search-box-container">
                <div className="search-box sm">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Agregar canción al set..."
                    value={songSearch}
                    onChange={e => setSongSearch(e.target.value)}
                  />
                  {songSearch && <button onClick={() => setSongSearch('')}><X size={12} /></button>}
                </div>
              </div>

                  {songSearch && (
                    <div className="search-results-overlay">
                       {filteredSongs.map(s => (
                         <button
                           key={s.id}
                           className="search-result-item"
                           onClick={() => {
                             addSongToSetlist(s);
                             setSongSearch('');
                           }}
                         >
                           <Plus size={12} />
                           <div className="info">
                             <span className="t">{s.title}</span>
                             <span className="a">{s.artist}</span>
                           </div>
                           {s.key && <span className="k">{s.key}</span>}
                         </button>
                       ))}
                    </div>
                  )}

              <div className="order-section">
                <div className="section-title">ORDEN DEL SERVICIO</div>
                {editingSetlist.songIds.length === 0 ? (
                  <div className="empty-state">No hay canciones. Usa la búsqueda arriba para añadir.</div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={editingSetlist.songIds} strategy={verticalListSortingStrategy}>
                      <div className="sortable-list">
                        {editingSetlist.songIds.map((id, index) => {
                          const song = setlistSongs[index]
                          return (
                            <SortableSongItem
                              key={id}
                              songId={id}
                              song={song}
                              onRemove={() => removeSongFromSetlist(id)}
                              onActivate={(s) => loadSong(s)}
                              onEdit={(s) => openEditor(s)}
                            />
                          )
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Control en Vivo (Derecha) */}
        {editingSetlist && (
          <div className="setlist-live-panel">
            <LiveSelection />
          </div>
        )}
      </div>

      <style>{`
        .setlists-body-grid {
          display: grid;
          grid-template-columns: 1fr;
          grid-template-rows: 1fr;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .setlists-body-grid.with-editor {
          grid-template-columns: 240px 320px 1fr;
        }

        .setlists-sidebar-panel {
          border-right: 1px solid var(--border);
          overflow-y: auto;
          background: var(--bg-surface);
          height: 100%;
        }
        .setlist-cards-container {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .setlist-card-compact {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        .setlist-card-compact:hover { background: var(--bg-hover); }
        .setlist-card-compact.active { background: var(--bg-elevated); border-color: var(--gold-dim); }
        .setlist-card-content { flex: 1; min-width: 0; }
        .setlist-name-row { display: flex; align-items: center; gap: 6px; font-weight: 500; font-size: 13px; }
        .setlist-name-row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .setlist-meta-row { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        .setlist-card-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.2s; }
        .setlist-card-compact:hover .setlist-card-actions { opacity: 1; }

        .setlist-songs-panel {
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          background: var(--bg-surface);
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }
        .panel-header {
          flex-shrink: 0;
          padding: 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .panel-header h3 { font-size: 15px; font-weight: 600; margin: 0; }
        .setlist-content-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
        .search-box-container { padding: 12px; position: sticky; top: 0; background: var(--bg-surface); z-index: 10; }
        .search-results-overlay { background: var(--bg-elevated); border-bottom: 1px solid var(--border); max-height: 200px; overflow-y: auto; }
        .search-result-item {
          width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 12px;
          border: none; background: none; color: var(--text-primary); text-align: left; cursor: pointer; font-size: 13px;
        }
        .search-result-item:hover { background: var(--bg-hover); }
        .search-result-item .info { flex: 1; display: flex; flex-direction: column; }
        .search-result-item .t { font-weight: 500; }
        .search-result-item .a { font-size: 11px; color: var(--text-muted); }
        .search-result-item .k { font-size: 10px; color: var(--gold); background: rgba(212, 168, 67, 0.1); padding: 1px 4px; border-radius: 4px; }

        .order-section { padding: 12px; }
        .section-title { font-size: 10px; font-weight: 700; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 8px; }
        .sortable-list { display: flex; flex-direction: column; gap: 4px; }
        .empty-state { font-size: 12px; color: var(--text-muted); text-align: center; padding: 24px 12px; font-style: italic; }

        .setlist-live-panel {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
          background: var(--bg-base);
        }

        .setlist-song-item {
          display: flex; align-items: center; gap: 8px; padding: 8px 10px;
          background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: all 0.2s;
        }
        .setlist-song-item:hover { border-color: var(--border-light); background: var(--bg-hover); }
        .setlist-song-item.active { border-color: var(--gold); box-shadow: 0 0 12px rgba(212, 168, 67, 0.1); }
        .drag-handle { color: var(--text-muted); cursor: grab; padding: 4px; display: flex; align-items: center; }
        .setlist-song-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .setlist-song-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .setlist-song-artist { font-size: 11px; color: var(--text-muted); }
        .song-key-sm { font-size: 10px; font-weight: 600; color: var(--gold); padding: 1px 4px; border-radius: 4px; }

        @media (max-width: 1100px) { .setlists-body-grid.with-editor { grid-template-columns: 200px 280px 1fr; } }
        @media (max-width: 900px) {
          .setlists-body-grid.with-editor { grid-template-columns: 1fr; }
          .setlists-sidebar-panel, .setlist-songs-panel { display: none; }
        }
        .setlist-song-item.blocked { opacity: 0.6; cursor: not-allowed; border-style: dashed; }
        .setlist-song-item.blocked:hover { background: var(--bg-elevated); border-color: var(--border); }
        .search-result-item.blocked { opacity: 0.5; cursor: not-allowed; background: rgba(0,0,0,0.05); }
        .search-result-item.blocked .t { text-decoration: line-through; opacity: 0.7; }
        .status-icon-blocked { color: var(--gold); flex-shrink: 0; }
      `}</style>

      {showOnlineSearch && <OnlineSearchModal onClose={() => setShowOnlineSearch(false)} />}
      {showCollabs && user?.id && (
        <CollaboratorsModal ownerId={user.id} onClose={() => setShowCollabs(false)} />
      )}
      {confirmDeleteSl && (
        <ConfirmDialog
          message={`¿Eliminar "${confirmDeleteSl.name}"?`}
          onConfirm={confirmDeleteSetlist}
          onCancel={() => setConfirmDeleteSl(null)}
          danger={true}
          confirmLabel="Eliminar"
        />
      )}
    </div>
  )
}
