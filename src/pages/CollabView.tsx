import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, GripVertical, Search, X, Music, Eye, ArrowLeft } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  collabInfo, collabSearchSongs, collabGetSong, collabListSetlists,
  collabUpsertSetlist, collabDeleteSetlist,
  type CollabSong, type CollabSetlist, type CollabSongFull,
} from '@/services/collab'

type Status = 'loading' | 'ok' | 'invalid'

function SortableRow({ song, onRemove, onView }: {
  song: CollabSong
  onRemove: () => void
  onView: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: song.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="setlist-song-item">
      <span className="drag-handle" {...attributes} {...listeners}><GripVertical size={14} /></span>
      <div className="setlist-song-info">
        <span className="setlist-song-name">{song.title}</span>
        {song.artist && <span className="setlist-song-artist">{song.artist}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {song.key && <span className="song-key-sm">{song.key}</span>}
        <button className="btn-icon-xs" onClick={onView} title="Ver letra"><Eye size={12} /></button>
        <button className="btn-icon-xs danger" onClick={onRemove} title="Quitar"><Trash2 size={12} /></button>
      </div>
    </div>
  )
}

export default function CollabView() {
  const { token = '' } = useParams<{ token: string }>()
  const [status, setStatus] = useState<Status>('loading')
  const [who, setWho] = useState<{ collaboratorName: string; churchName: string } | null>(null)
  const [setlists, setSetlists] = useState<CollabSetlist[]>([])
  const [editing, setEditing] = useState<CollabSetlist | null>(null)
  const [songCache, setSongCache] = useState<Map<number, CollabSong>>(new Map())
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<CollabSong[]>([])
  const [viewingSong, setViewingSong] = useState<CollabSongFull | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [newName, setNewName] = useState('')
  const saveSeq = useRef(0)
  const searchSeq = useRef(0)

  const sensors = useSensors(useSensor(PointerSensor))

  const refreshSetlists = useCallback(async () => {
    const lists = await collabListSetlists(token)
    setSetlists(lists)
    // cachear datos de las canciones referenciadas que no tengamos
    const missing = new Set<number>()
    for (const sl of lists) for (const id of sl.songIds) if (!songCache.has(id)) missing.add(id)
    if (missing.size > 0) {
      const found = new Map(songCache)
      // ponytail: N consultas de a 1 via collab_get_song sería peor; búsqueda vacía
      // pagina por popularidad y no garantiza traerlas — se cargan on-demand al ver la letra.
      // Para el listado basta id; título se completa con collab_get_song en paralelo (máx 50).
      const ids = [...missing].slice(0, 50)
      const songs = await Promise.all(ids.map(id => collabGetSong(token, id)))
      songs.forEach(s => { if (s) found.set(s.id, { id: s.id, title: s.title, artist: s.artist, key: s.key, language: '' }) })
      setSongCache(found)
    }
  }, [token, songCache])

  // Carga inicial + validación del token
  useEffect(() => {
    let alive = true
    ;(async () => {
      const info = await collabInfo(token)
      if (!alive) return
      if (!info) { setStatus('invalid'); return }
      setWho(info)
      setStatus('ok')
      await refreshSetlists()
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Refetch al volver el foco a la pestaña
  useEffect(() => {
    const onFocus = () => { if (status === 'ok' && !editing) refreshSetlists() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [status, editing, refreshSetlists])

  // Búsqueda con debounce
  const isEditing = editing != null
  useEffect(() => {
    if (!editing) return
    const seq = ++searchSeq.current
    const t = setTimeout(async () => {
      const r = await collabSearchSongs(token, search, 0)
      if (seq !== searchSeq.current) return // respuesta obsoleta: llegó después de una búsqueda más nueva
      setResults(r)
      setSongCache(prev => {
        const next = new Map(prev)
        r.forEach(s => next.set(s.id, s))
        return next
      })
    }, 300)
    return () => clearTimeout(t)
  }, [search, isEditing, token])

  const save = async (updated: CollabSetlist) => {
    const seq = ++saveSeq.current
    setSaveState('saving')
    const saved = await collabUpsertSetlist(token, {
      id: updated.id || undefined,
      name: updated.name,
      date: updated.date,
      songIds: updated.songIds,
      notes: updated.notes,
    })
    if (seq !== saveSeq.current) return // respuesta obsoleta: llegó después de un save más nuevo
    if (saved) {
      setSaveState('saved')
      setEditing(saved)
      setSetlists(prev => prev.map(s => (s.id === saved.id ? saved : s)))
    } else {
      setSaveState('error')
    }
  }

  const createSetlist = async () => {
    if (!newName.trim()) return
    const created = await collabUpsertSetlist(token, {
      name: newName.trim(), date: new Date().toISOString().slice(0, 10), songIds: [], notes: null,
    })
    if (created) {
      setNewName('')
      setSetlists(prev => [created, ...prev])
      setEditing(created)
    }
  }

  if (status === 'loading') return <div className="collab-page"><p>Cargando…</p></div>

  if (status === 'invalid') {
    return (
      <div className="collab-page collab-invalid">
        <Music size={40} />
        <h2>Enlace no válido</h2>
        <p>Este enlace fue revocado o no existe. Pide uno nuevo al administrador de Proclama.</p>
      </div>
    )
  }

  return (
    <div className="collab-page">
      <header className="collab-header">
        <div>
          <h1>Hola, {who?.collaboratorName}</h1>
          <p>{who?.churchName}</p>
        </div>
        {editing && (
          <span className={`collab-save-state ${saveState}`}>
            {saveState === 'saving' ? 'Guardando…' : saveState === 'error' ? 'Sin conexión — reintenta' : 'Guardado'}
          </span>
        )}
      </header>

      {!editing ? (
        <section>
          <div className="collab-new">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createSetlist()}
              placeholder="Nombre del repertorio (ej. Domingo 12 julio)"
            />
            <button className="btn-primary" onClick={createSetlist}><Plus size={16} /> Nuevo</button>
          </div>
          <div className="collab-list">
            {setlists.map(sl => (
              <button key={sl.id} className="collab-setlist-card" onClick={() => { setSearch(''); setResults([]); setEditing(sl) }}>
                <strong>{sl.name}</strong>
                <span>{sl.date ?? ''} · {sl.songIds.length} canciones</span>
              </button>
            ))}
            {setlists.length === 0 && <p className="collab-empty">Aún no hay repertorios. Crea el primero.</p>}
          </div>
        </section>
      ) : (
        <section className="collab-editor">
          <button className="btn-ghost" onClick={() => { setEditing(null); refreshSetlists() }}>
            <ArrowLeft size={14} /> Volver
          </button>

          <input
            className="collab-name-input"
            value={editing.name}
            onChange={e => setEditing({ ...editing, name: e.target.value })}
            onBlur={() => save(editing)}
          />
          <input
            type="date"
            value={editing.date ?? ''}
            onChange={e => { const u = { ...editing, date: e.target.value || null }; setEditing(u); save(u) }}
          />

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(ev) => {
            const { active, over } = ev
            if (over && active.id !== over.id) {
              const oldI = editing.songIds.indexOf(Number(active.id))
              const newI = editing.songIds.indexOf(Number(over.id))
              const u = { ...editing, songIds: arrayMove(editing.songIds, oldI, newI) }
              setEditing(u)
              save(u)
            }
          }}>
            <SortableContext items={editing.songIds} strategy={verticalListSortingStrategy}>
              {editing.songIds.map(id => (
                <SortableRow
                  key={id}
                  song={songCache.get(id) ?? { id, title: `Canción #${id}`, artist: '', key: '', language: '' }}
                  onRemove={() => { const u = { ...editing, songIds: editing.songIds.filter(x => x !== id) }; setEditing(u); save(u) }}
                  onView={async () => setViewingSong(await collabGetSong(token, id))}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className="collab-search">
            <Search size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar canción para agregar…"
            />
          </div>
          <div className="collab-results">
            {results.filter(s => !editing.songIds.includes(s.id)).map(s => (
              <div key={s.id} className="setlist-song-item" onClick={() => {
                const u = { ...editing, songIds: [...editing.songIds, s.id] }
                setEditing(u)
                save(u)
              }}>
                <div className="setlist-song-info">
                  <span className="setlist-song-name">{s.title}</span>
                  {s.artist && <span className="setlist-song-artist">{s.artist}</span>}
                </div>
                <Plus size={14} />
              </div>
            ))}
          </div>

          <textarea
            className="collab-notes"
            value={editing.notes ?? ''}
            onChange={e => setEditing({ ...editing, notes: e.target.value })}
            onBlur={() => save(editing)}
            placeholder="Notas para el servicio…"
          />

          <button
            className="btn-danger-ghost"
            onClick={async () => {
              if (!confirm('¿Eliminar este repertorio?')) return
              await collabDeleteSetlist(token, editing.id)
              setEditing(null)
              refreshSetlists()
            }}
          >
            <Trash2 size={14} /> Eliminar repertorio
          </button>
        </section>
      )}

      {viewingSong && (
        <div className="modal-overlay" onClick={() => setViewingSong(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{viewingSong.title}</h3>
              <button className="btn-icon-xs" onClick={() => setViewingSong(null)}><X size={14} /></button>
            </div>
            <pre className="collab-lyrics">{viewingSong.lyrics}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
