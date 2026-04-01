import { useState, useEffect } from 'react'
import { BookOpen, Search, ChevronLeft, ChevronRight, Tv2, X, Menu } from 'lucide-react'
import { BIBLE_BOOKS, fetchChapter, searchGlobal, getBookSuggestion, SUPPORTED_TRANSLATIONS } from '@/services/bible'
import type { BibleVerseResult } from '@/services/bible'
import { useShallow } from 'zustand/react/shallow'
import { useProjectionStore, useAppStore } from '@/stores'

const TRANSLATIONS = SUPPORTED_TRANSLATIONS

export default function BibleView() {
  const { isSidebarOpen, toggleSidebar } = useAppStore(useShallow(s => ({
    isSidebarOpen: s.isSidebarOpen, toggleSidebar: s.toggleSidebar
  })))
  const [selectedBook, setSelectedBook] = useState('jhn')
  const [selectedChapter, setSelectedChapter] = useState(3)
  const [selectedTranslation, setSelectedTranslation] = useState('RVR1960')
  const [verses, setVerses] = useState<BibleVerseResult[]>([])
  const [loading, setLoading] = useState(true)
  const [chapterError, setChapterError] = useState<string | null>(null)
  const [testament, setTestament] = useState<'AT' | 'NT' | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<BibleVerseResult[]>([])
  const [searching, setSearching] = useState(false)
  const [bookSearchQuery, setBookSearchQuery] = useState('')
  const [bookSuggestion, setBookSuggestion] = useState<{ id: string; name: string } | null>(null)

  const { loadSong, songTitle, theme, slides, currentSlide } = useProjectionStore(useShallow(s => ({
    loadSong: s.loadSong,
    songTitle: s.state.songTitle,
    theme: s.state.theme,
    slides: s.state.slides,
    currentSlide: s.state.currentSlide
  })))
  const state = { songTitle, theme, slides, currentSlide }

  const book = BIBLE_BOOKS.find(b => b.id === selectedBook)
  const filteredBooks = BIBLE_BOOKS.filter(b => testament === 'ALL' || b.testament === testament)

  useEffect(() => {
    console.log('Loading chapter:', selectedBook, selectedChapter)
    loadChapter()
  }, [selectedBook, selectedChapter, selectedTranslation])

  // Autocompletado de libros
  useEffect(() => {
    if (!bookSearchQuery.trim()) {
      setBookSuggestion(null)
      return
    }
    const suggestion = getBookSuggestion(bookSearchQuery)
    setBookSuggestion(suggestion)
  }, [bookSearchQuery])

  const loadChapter = async () => {
    try {
      setLoading(true)
      setChapterError(null)
      const result = await fetchChapter(selectedBook, selectedChapter, selectedTranslation)
      console.log('Loaded verses:', result.length)
      setVerses(result)
      if (result.length === 0) {
        setChapterError('No se pudieron cargar los versículos de este capítulo')
      }
    } catch (error) {
      console.error('Error loading chapter:', error)
      setChapterError('Error al cargar el capítulo. Por favor, intenta de nuevo.')
      setVerses([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    const results = await searchGlobal(searchQuery, selectedTranslation)
    
    if (results.length === 1) {
      const v = results[0]
      projectVerse(v)
      if (v.bookId && v.chapter) {
        handleSelectBook(v.bookId)
        setSelectedChapter(v.chapter)
        setSearchQuery('')
        setSearchResults([])
      }
    } else {
      setSearchResults(results)
    }
    
    setSearching(false)
  }

  const handleSelectBook = (bookId: string) => {
    setSelectedBook(bookId)
    setSelectedChapter(1)
    setBookSearchQuery('')
  }

  const handleBookSuggestionClick = () => {
    if (bookSuggestion) {
      handleSelectBook(bookSuggestion.id)
    }
  }


  const projectVerses = (versesToProject: BibleVerseResult[]) => {
    if (versesToProject.length === 0) return
    const lyrics = versesToProject
      .map(v => `${v.text}\n\n`)
      .join('')
    loadSong({
      title: versesToProject.map(v => v.reference).join(', '),
      artist: versesToProject[0].translation,
      lyrics,
      key: '',
      tags: ['Biblia'],
      language: 'Español',
      usageCount: 0,
      isPublic: true,
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }, true)
  }


  const projectVerse = (verse: BibleVerseResult) => {
    projectVerses([verse])
  }

  if (!book) {
    return <div style={{ padding: '20px' }}>Error: Libro no encontrado</div>
  }

  return (
    <div className="bible-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
          )}
          <div>
            <h1><BookOpen size={18} style={{ display: 'inline', marginRight: 8 }} />Biblia</h1>
          </div>
        </div>
        <div className="header-actions">
          <select
            className="filter-select"
            value={selectedTranslation}
            onChange={e => setSelectedTranslation(e.target.value)}
          >
            {TRANSLATIONS.map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
          </select>
        </div>
      </div>

      <div className="bible-body">
        <div className="bible-sidebar">
          {/* Búsqueda rápida de libros */}
          <div className="book-search">
            <input
              type="search"
              placeholder="Buscar libro…"
              value={bookSearchQuery}
              onChange={e => setBookSearchQuery(e.target.value)}
              className="book-search-input"
              aria-label="Buscar libro de la Biblia"
            />
            {bookSuggestion && (
              <div className="book-suggestion">
                <button onClick={handleBookSuggestionClick} className="suggestion-button">
                  {bookSuggestion.name}
                </button>
              </div>
            )}
          </div>

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

          <div className="books-list">
            {filteredBooks.map(b => (
              <button
                key={b.id}
                className={`book-item ${selectedBook === b.id ? 'active' : ''}`}
                onClick={() => handleSelectBook(b.id)}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        <div className="bible-main">
          <div className="chapter-nav">
            <button
              className="btn-icon"
              onClick={() => setSelectedChapter(c => Math.max(1, c - 1))}
              disabled={selectedChapter === 1}
              aria-label="Capítulo anterior"
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
              aria-label="Capítulo siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="bible-search">
            <div className="search-box">
              <Search size={14} />
              <input
                type="search"
                placeholder="Busca por texto, libro o referencia (ej: Juan 3:16)…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                aria-label="Buscar en la Biblia"
              />
              {searchQuery && (
                <button className="btn-icon" onClick={() => { setSearchQuery(''); setSearchResults([]) }} aria-label="Limpiar búsqueda">
                  <X size={12} />
                </button>
              )}
            </div>
            <button className="btn-ghost" onClick={handleSearch} disabled={searching}>
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="search-results-bible">
              <div className="search-results-header">
                {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} en toda la Biblia
                <button className="btn-icon" onClick={() => setSearchResults([])} aria-label="Cerrar resultados">
                  <X size={12} />
                </button>
              </div>
              <div className="search-results-scroll">
                {searchResults.map((v, i) => (
                  <div
                    key={i}
                    className={`verse-result ${state.songTitle === v.reference ? 'projected' : ''}`}
                    onClick={() => {
                      projectVerse(v)
                      if (v.bookId && v.chapter) {
                        handleSelectBook(v.bookId)
                        setSelectedChapter(v.chapter)
                        setSearchResults([])
                        setSearchQuery('')
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="verse-reference">{v.reference}</div>
                    <div className="verse-text">{v.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="bible-loading">Cargando…</div>
          ) : chapterError ? (
            <div className="bible-error" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>{chapterError}</p>
              <button className="btn-primary" onClick={loadChapter}>
                Reintentar
              </button>
            </div>
          ) : verses.length === 0 ? (
            <div className="bible-loading">No hay versículos disponibles para este capítulo</div>
          ) : (
            <div className="verses-list">
              {verses.map((verse, i) => (
                <div
                  key={i}
                  className={`verse-item ${state.songTitle === verse.reference ? 'projected' : ''}`}
                  onClick={() => projectVerse(verse)}
                >
                  <span className="verse-number">{i + 1}</span>
                  <span className="verse-text-body">{verse.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

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
            Haz clic en un versículo para proyectarlo de inmediato.
          </div>
        </div>
      </div>
    </div>
  )
}