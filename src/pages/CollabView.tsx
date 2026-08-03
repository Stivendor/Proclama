import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, GripVertical, Search, X, Music, Eye, ArrowLeft, ListMusic } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  collabInfo, collabSearchSongs, collabGetSong, collabListSetlists,
  collabUpsertSetlist, collabDeleteSetlist, CollabOwnerNotPremiumError,
  type CollabSong, type CollabSetlist, type CollabSongFull,
} from '@/services/collab'

type Status = 'loading' | 'ok' | 'invalid' | 'inactive' | 'error'

// 'YYYY-MM-DD' se parsea a mano: new Date('2026-07-12') es UTC y en Colombia muestra el día anterior.
function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return 'Sin fecha'
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function songCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'canción' : 'canciones'}`
}

function SortableRow({ song, position, onRemove, onView }: {
  song: CollabSong
  position: number
  onRemove: () => void
  onView: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <li ref={setNodeRef} style={style} className={`collab-song-row${isDragging ? ' dragging' : ''}`}>
      <span className="collab-song-index" aria-hidden="true">{position}</span>
      <button
        className="collab-drag"
        aria-label={`Cambiar el orden de ${song.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} />
      </button>
      <div className="collab-song-info">
        <span className="collab-song-title">{song.title}</span>
        {song.artist && <span className="collab-song-artist">{song.artist}</span>}
      </div>
      {song.key && <span className="song-key-sm">{song.key}</span>}
      <button className="collab-row-action" onClick={onView} aria-label={`Ver la letra de ${song.title}`}>
        <Eye size={15} />
      </button>
      <button className="collab-row-action danger" onClick={onRemove} aria-label={`Quitar ${song.title} del repertorio`}>
        <Trash2 size={15} />
      </button>
    </li>
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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
      try {
        const info = await collabInfo(token)
        if (!alive) return
        if (!info) { setStatus('invalid'); return }
        setWho(info)
        setStatus('ok')
        await refreshSetlists()
      } catch (e) {
        if (!alive) return
        setStatus(e instanceof CollabOwnerNotPremiumError ? 'inactive' : 'error')
      }
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

  // Escape cierra la letra abierta
  useEffect(() => {
    if (!viewingSong) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setViewingSong(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewingSong])

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

  if (status === 'loading') {
    return (
      <div className="collab-page collab-page-center">
        <div className="collab-notice"><p>Cargando tus repertorios…</p></div>
      </div>
    )
  }

  if (status !== 'ok') {
    const notice = {
      invalid: {
        title: 'Enlace no válido',
        body: 'Este enlace fue revocado o no existe. Pide uno nuevo al administrador de Proclama.',
      },
      inactive: {
        title: 'Enlace en pausa',
        body: 'La iglesia que te compartió este enlace no tiene el plan Pro activo. Guarda el enlace: vuelve a funcionar apenas lo renueven.',
      },
      error: {
        title: 'Sin conexión',
        body: 'No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.',
      },
    }[status]
    return (
      <div className="collab-page collab-page-center">
        <div className="collab-notice">
          <span className="collab-notice-icon"><Music size={26} /></span>
          <h2>{notice.title}</h2>
          <p>{notice.body}</p>
          {status === 'error' && (
            <button className="btn-primary" onClick={() => window.location.reload()}>Reintentar</button>
          )}
        </div>
      </div>
    )
  }

  const songCount = editing?.songIds.length ?? 0

  return (
    <div className="collab-page">
      <header className="collab-topbar">
        <div className="collab-topbar-inner">
          <div className="collab-identity">
            <span className="collab-eyebrow">{who?.churchName}</span>
            <h1>Hola, {who?.collaboratorName}</h1>
          </div>
          <span className={`collab-save-state ${saveState}`} role="status" aria-live="polite">
            {editing
              ? saveState === 'saving' ? 'Guardando…'
                : saveState === 'error' ? 'Sin conexión — reintenta'
                : 'Guardado'
              : ''}
          </span>
        </div>
      </header>

      <main className="collab-main">
        {!editing ? (
          <section className="collab-home">
            <div className="collab-panel collab-create">
              <label className="collab-field-label" htmlFor="collab-new-name">Crear un repertorio</label>
              <div className="collab-create-row">
                <input
                  id="collab-new-name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createSetlist()}
                  placeholder="Ej. Domingo 12 de julio"
                />
                <button className="btn-primary" onClick={createSetlist} disabled={!newName.trim()}>
                  <Plus size={16} /> Crear
                </button>
              </div>
            </div>

            <div className="collab-section-head">
              <h2>Repertorios</h2>
              {setlists.length > 0 && <span className="collab-count">{setlists.length}</span>}
            </div>

            {setlists.length === 0 ? (
              <div className="collab-empty">
                <span className="collab-notice-icon"><ListMusic size={24} /></span>
                <p>Todavía no hay repertorios.</p>
                <p className="collab-empty-hint">Ponle un nombre arriba y empieza a agregar canciones.</p>
              </div>
            ) : (
              <ul className="collab-list">
                {setlists.map(sl => (
                  <li key={sl.id}>
                    <button
                      className="collab-setlist-card"
                      onClick={() => { setSearch(''); setResults([]); setEditing(sl) }}
                    >
                      <span className="collab-card-date">{formatDate(sl.date)}</span>
                      <strong className="collab-card-name">{sl.name}</strong>
                      <span className="collab-card-meta">
                        <ListMusic size={13} /> {songCountLabel(sl.songIds.length)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section className="collab-editor">
            <div className="collab-editor-bar">
              <button className="collab-back" onClick={() => { setEditing(null); refreshSetlists() }}>
                <ArrowLeft size={16} /> Repertorios
              </button>
              <button
                className="collab-delete"
                onClick={async () => {
                  if (!confirm(`¿Eliminar "${editing.name}"? Esta acción no se puede deshacer.`)) return
                  await collabDeleteSetlist(token, editing.id)
                  setEditing(null)
                  refreshSetlists()
                }}
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>

            <div className="collab-editor-grid">
              <div className="collab-panel collab-fields">
                  <label className="collab-field">
                    <span className="collab-field-label">Nombre</span>
                    <input
                      className="collab-name-input"
                      value={editing.name}
                      onChange={e => setEditing({ ...editing, name: e.target.value })}
                      onBlur={() => save(editing)}
                    />
                  </label>
                  <label className="collab-field collab-field-date">
                    <span className="collab-field-label">Fecha</span>
                    <input
                      type="date"
                      value={editing.date ?? ''}
                      onChange={e => { const u = { ...editing, date: e.target.value || null }; setEditing(u); save(u) }}
                    />
                  </label>
                </div>

                <div className="collab-panel collab-order-panel">
                  <div className="collab-panel-head">
                    <h2>Orden del servicio</h2>
                    <span className="collab-count">{songCountLabel(songCount)}</span>
                  </div>

                  {songCount === 0 ? (
                    <p className="collab-empty-hint collab-order-empty">
                      Busca una canción y tócala para agregarla al orden.
                    </p>
                  ) : (
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
                        <ol className="collab-order">
                          {editing.songIds.map((id, i) => (
                            <SortableRow
                              key={id}
                              position={i + 1}
                              song={songCache.get(id) ?? { id, title: `Canción #${id}`, artist: '', key: '', language: '' }}
                              onRemove={() => { const u = { ...editing, songIds: editing.songIds.filter(x => x !== id) }; setEditing(u); save(u) }}
                              onView={async () => setViewingSong(await collabGetSong(token, id))}
                            />
                          ))}
                        </ol>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>

                <aside className="collab-aside">
                <div className="collab-panel collab-add">
                  <div className="collab-panel-head">
                    <h2>Agregar canciones</h2>
                  </div>
                  <div className="collab-search">
                    <Search size={15} className="collab-search-icon" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar por título o artista"
                      aria-label="Buscar canciones"
                    />
                    {search && (
                      <button className="collab-search-clear" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {(() => {
                    const available = results.filter(s => !editing.songIds.includes(s.id))
                    if (available.length === 0) {
                      return (
                        <p className="collab-empty-hint collab-results-empty">
                          {search
                            ? `Ninguna canción coincide con "${search}".`
                            : 'Escribe para buscar en la biblioteca de la iglesia.'}
                        </p>
                      )
                    }
                    return (
                      <ul className="collab-results">
                        {available.map(s => (
                          <li key={s.id}>
                            <button
                              className="collab-result-row"
                              onClick={() => {
                                const u = { ...editing, songIds: [...editing.songIds, s.id] }
                                setEditing(u)
                                save(u)
                              }}
                            >
                              <div className="collab-song-info">
                                <span className="collab-song-title">{s.title}</span>
                                {s.artist && <span className="collab-song-artist">{s.artist}</span>}
                              </div>
                              {s.key && <span className="song-key-sm">{s.key}</span>}
                              <span className="collab-result-add" aria-hidden="true"><Plus size={15} /></span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  })()}
                </div>
              </aside>

              <div className="collab-panel collab-notes-panel">
                <label className="collab-field">
                  <span className="collab-field-label">Notas para el equipo</span>
                  <textarea
                    className="collab-notes"
                    value={editing.notes ?? ''}
                    onChange={e => setEditing({ ...editing, notes: e.target.value })}
                    onBlur={() => save(editing)}
                    placeholder="Tonalidades, quién dirige, transiciones…"
                  />
                </label>
              </div>
            </div>
          </section>
        )}
      </main>

      {viewingSong && (
        <div className="modal-overlay collab-overlay" onClick={() => setViewingSong(null)}>
          <div
            className="collab-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Letra de ${viewingSong.title}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="collab-modal-head">
              <div>
                <h3>{viewingSong.title}</h3>
                {viewingSong.artist && <p>{viewingSong.artist}</p>}
              </div>
              <button className="collab-row-action" onClick={() => setViewingSong(null)} aria-label="Cerrar letra">
                <X size={16} />
              </button>
            </div>
            <pre className="collab-lyrics">{viewingSong.lyrics}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
