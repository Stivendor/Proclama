import { useState, useEffect, useRef, Fragment } from 'react'
import { Search, Download, Check, Music2, X, Loader2 } from 'lucide-react'
import { useLyricsSearch } from '@/hooks/useLyricsSearch'
import { importLyricsResult } from '@/services/lyricsImport'
import type { LyricsResult } from '@/services/lyricsSearch'
import { parseLyrics } from '@/services/lyricsParser'
import { useAppStore } from '@/stores'

export default function LyricsSearchModal({ onClose, onImported }: {
  onClose: () => void
  /** Avisa al padre del título recién importado, para que pueda mostrar aviso y hacerlo encontrable. */
  onImported?: (titulo: string) => void
}) {
  const { query, setQuery, results, loading, error, empty } = useLyricsSearch()
  const user = useAppStore(s => s.user)
  const [selected, setSelected] = useState<LyricsResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<Set<number>>(new Set())
  const [importError, setImportError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Al cambiar los resultados, la selección anterior deja de tener sentido.
  useEffect(() => { setSelected(null); setImportError('') }, [results])

  // Cambiar de canción invalida el error de la anterior: si no se limpia aquí,
  // el mensaje de "no se pudo guardar" de la canción A queda pegado bajo la
  // preview de la canción B, dando a entender que B también falló.
  const seleccionar = (r: LyricsResult) => {
    setSelected(r)
    setImportError('')
  }

  const importar = async () => {
    if (!selected) return
    setImporting(true)
    setImportError('')
    try {
      await importLyricsResult(selected, user?.id ?? null)
      setImported(prev => new Set(prev).add(selected.id))
      onImported?.(selected.title)
    } catch {
      // La subida a Supabase ya falla en silencio dentro de importLyricsResult
      // (RLS de plan free: la canción se queda en local, sin error). Si llegamos
      // aquí es que falló Dexie (cuota, IndexedDB corrupta) y la canción no
      // quedó guardada ni siquiera en local: hay que avisar, sin perder la
      // selección ni cerrar el modal.
      setImportError('No se pudo guardar la canción. Intenta de nuevo.')
    } finally {
      setImporting(false)
    }
  }

  const yaEsta = (r: LyricsResult) => r.alreadyInLibrary || imported.has(r.id)
  const slides = selected ? parseLyrics(selected.lyrics) : []

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar canciones en internet"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal lyrics-search-modal">
        <div className="lyrics-search-bar">
          <Search size={18} opacity={0.6} />
          <input
            ref={inputRef}
            type="search"
            placeholder="Busca una canción en internet…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Buscar canciones en internet"
          />
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>

        <div className="lyrics-search-body">
          <div className="lyrics-search-list">
            {loading && [0, 1, 2, 3].map(i => <div key={i} className="lyrics-search-skeleton" />)}

            {error && <p className="lyrics-search-msg">{error}</p>}
            {empty && <p className="lyrics-search-msg">Sin resultados para «{query.trim()}».</p>}
            {!loading && !error && !empty && results.length === 0 && (
              <p className="lyrics-search-msg">Escribe para buscar letras en internet.</p>
            )}

            {!loading && results.map((r, i) => (
              <Fragment key={r.id}>
                {i > 0 && results[i - 1].knownArtist && !r.knownArtist && (
                  <div className="lyrics-search-sep">Otros resultados</div>
                )}
                <button
                  className={`lyrics-search-item ${selected?.id === r.id ? 'active' : ''}`}
                  onClick={() => seleccionar(r)}
                >
                  <Music2 size={14} opacity={0.6} />
                  <span className="lyrics-search-item-text">
                    <strong>{r.title}</strong>
                    <small>{r.artist}</small>
                  </span>
                  {yaEsta(r) && <span className="lyrics-search-have"><Check size={12} /> ya la tienes</span>}
                </button>
              </Fragment>
            ))}
          </div>

          <div className="lyrics-search-preview">
            {!selected && <p className="lyrics-search-msg">Elige una canción para ver la letra.</p>}
            {selected && (
              <>
                <div className="lyrics-search-preview-head">
                  <strong>{selected.title}</strong>
                  <small>{selected.artist}</small>
                </div>
                <div className="lyrics-search-slides">
                  {slides.map(s => (
                    <div key={s.index} className="lyrics-search-slide">
                      <span className="lyrics-search-slide-num">{s.index + 1}/{slides.length}</span>
                      {s.lines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  ))}
                </div>
                {importError && <p className="lyrics-search-msg">{importError}</p>}
                <button
                  className="btn-primary"
                  onClick={importar}
                  disabled={importing || yaEsta(selected)}
                >
                  <Download size={15} />
                  {yaEsta(selected) ? 'Ya está en tu biblioteca'
                    : importing ? 'Agregando…'
                    : 'Agregar a mi biblioteca'}
                </button>
              </>
            )}
          </div>
        </div>

        {loading && <Loader2 className="lyrics-search-spin" size={14} aria-label="Buscando" />}
      </div>
    </div>
  )
}
