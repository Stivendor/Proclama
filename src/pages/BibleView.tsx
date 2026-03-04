import { useState, useEffect } from 'react'
import { BookOpen, Search, ChevronLeft, ChevronRight, Tv2, X } from 'lucide-react'
import { BIBLE_BOOKS, fetchChapter, searchVerses } from '@/services/bible'
import type { BibleVerseResult } from '@/services/bible'
import { useProjectionStore } from '@/stores'

const TRANSLATIONS = ['RVR1960']  // Solo RVR1960 es soportada por bible-api.com

export default function BibleView() {
  const [selectedBook, setSelectedBook] = useState('JHN')
  const [selectedChapter, setSelectedChapter] = useState(3)
  const [selectedTranslation, setSelectedTranslation] = useState('RVR1960')
  const [verses, setVerses] = useState<BibleVerseResult[]>([])
  const [loading, setLoading] = useState(false)
  const [testament, setTestament] = useState<'AT' | 'NT' | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<BibleVerseResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set())

  const { state, loadSong } = useProjectionStore()

  const book = BIBLE_BOOKS.find(b => b.id === selectedBook)!
  const filteredBooks = BIBLE_BOOKS.filter(b => testament === 'ALL' || b.testament === testament)

  useEffect(() => {
    loadChapter()
  }, [selectedBook, selectedChapter, selectedTranslation])

  const loadChapter = async () => {
    setLoading(true)
    setSelectedVerses(new Set())
    const result = await fetchChapter(selectedBook, selectedChapter, selectedTranslation)
    setVerses(result)
    setLoading(false)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    const results = await searchVerses(searchQuery, selectedTranslation)
    setSearchResults(results)
    setSearching(false)
  }

  const toggleVerse = (index: number) => {
    setSelectedVerses(prev => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }

  const projectVerses = (versesToProject: BibleVerseResult[]) => {
    if (versesToProject.length === 0) return
    // Construir un "song" temporal con los versículos como estrofas
    const lyrics = versesToProject
      .map(v => `${v.text}\n\n`)
      .join('')
    loadSong({
      title: versesToProject.map(v => v.reference).join(', '),
      artist: versesToProject[0].translation,
      lyrics,
      key: '', tags: ['Biblia'], language: 'Español',
      usageCount: 0, createdAt: new Date(), updatedAt: new Date()
    })
  }

  const projectSelected = () => {
    const toProject = verses.filter((_, i) => selectedVerses.has(i))
    projectVerses(toProject)
  }

  const projectVerse = (verse: BibleVerseResult) => {
    projectVerses([verse])
  }

  return (
    <div className="bible-view">
      {/* Header */}
      <div className="view-header">
        <div>
          <h1><BookOpen size={18} style={{ display: 'inline', marginRight: 8 }} />Biblia</h1>
        </div>
        <div className="header-actions">
          <select
            className="filter-select"
            value={selectedTranslation}
            onChange={e => setSelectedTranslation(e.target.value)}
          >
            {TRANSLATIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {selectedVerses.size > 0 && (
            <button className="btn-primary" onClick={projectSelected}>
              <Tv2 size={14} /> Proyectar {selectedVerses.size} vers.
            </button>
          )}
        </div>
      </div>

      <div className="bible-body">
        {/* Columna izquierda — selector */}
        <div className="bible-sidebar">
          {/* Testamento */}
          <div className="testament-tabs">
            {(['ALL', 'AT', 'NT'] as const).map(t => (
              <button
                key={t}
                className={`testament-tab ${testament === t ? 'active' : ''}`}
                onClick={() => setTestament(t)}
              >
                {t === 'ALL' ? 'Todos' : t === 'AT' ? 'A.T.' : 'N.T.'}
              </button>
            ))}
          </div>

          {/* Lista de libros */}
          <div className="books-list">
            {filteredBooks.map(b => (
              <button
                key={b.id}
                className={`book-item ${selectedBook === b.id ? 'active' : ''}`}
                onClick={() => { setSelectedBook(b.id); setSelectedChapter(1) }}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Columna central — versículos */}
        <div className="bible-main">
          {/* Navegación de capítulo */}
          <div className="chapter-nav">
            <button
              className="btn-icon"
              onClick={() => setSelectedChapter(c => Math.max(1, c - 1))}
              disabled={selectedChapter === 1}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="chapter-title">
              {book.name} — Capítulo
              <select
                value={selectedChapter}
                onChange={e => setSelectedChapter(Number(e.target.value))}
                className="chapter-select"
              >
                {Array.from({ length: book.chapters }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </span>
            <button
              className="btn-icon"
              onClick={() => setSelectedChapter(c => Math.min(book.chapters, c + 1))}
              disabled={selectedChapter === book.chapters}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Búsqueda rápida */}
          <div className="bible-search">
            <div className="search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder='Ej: "Juan 3:16" o "porque de tal manera"'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              {searchQuery && (
                <button className="btn-icon" onClick={() => { setSearchQuery(''); setSearchResults([]) }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <button className="btn-ghost" onClick={handleSearch} disabled={searching}>
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {/* Resultados de búsqueda */}
          {searchResults.length > 0 && (
            <div className="search-results-bible">
              <div className="search-results-header">
                {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
                <button className="btn-icon" onClick={() => setSearchResults([])}>
                  <X size={12} />
                </button>
              </div>
              {searchResults.map((v, i) => (
                <div key={i} className="verse-result">
                  <div className="verse-reference">{v.reference}</div>
                  <div className="verse-text">{v.text}</div>
                  <button className="btn-ghost small" onClick={() => projectVerse(v)}>
                    <Tv2 size={12} /> Proyectar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Versículos del capítulo */}
          {loading ? (
            <div className="bible-loading">Cargando...</div>
          ) : (
            <div className="verses-list">
              {verses.map((verse, i) => (
                <div
                  key={i}
                  className={`verse-item ${selectedVerses.has(i) ? 'selected' : ''}`}
                  onClick={() => toggleVerse(i)}
                >
                  <span className="verse-number">{i + 1}</span>
                  <span className="verse-text-body">{verse.text}</span>
                  <button
                    className="verse-project-btn"
                    onClick={e => { e.stopPropagation(); projectVerse(verse) }}
                    title="Proyectar este versículo"
                  >
                    <Tv2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="bible-preview">
          <div className="preview-header"><Tv2 size={14} /> En proyección ahora</div>
          <div className="bible-projection-preview" style={{ background: state.theme.background }}>
            {state.songTitle ? (
              <>
                <div className="bible-preview-reference" style={{ color: state.theme.textColor }}>
                  {state.songTitle}
                </div>
                {state.slides[state.currentSlide]?.lines.map((line, i) => (
                  <div key={i} className="bible-preview-text" style={{
                    color: state.theme.textColor,
                    fontFamily: state.theme.fontFamily
                  }}>
                    {line}
                  </div>
                ))}
              </>
            ) : (
              <div className="bible-preview-empty">Ningún versículo proyectado</div>
            )}
          </div>
          <div className="bible-hint">
            Haz clic en un versículo para seleccionarlo.<br />
            Selecciona varios y usa "Proyectar X vers."<br />
            O haz clic en <Tv2 size={11} style={{display:'inline'}}/> para proyectar uno solo.
          </div>
        </div>
      </div>
    </div>
  )
}