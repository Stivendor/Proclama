import { useState, useEffect, useRef } from 'react'
import { BookOpen, Search, ChevronLeft, ChevronRight, X, Menu, Clock } from 'lucide-react'
import { BIBLE_BOOKS, fetchChapter, searchGlobal, getBookSuggestion, SUPPORTED_TRANSLATIONS } from '@/services/bible'
import type { BibleVerseResult } from '@/services/bible'
import { useShallow } from 'zustand/react/shallow'
import { useProjectionStore, useAppStore } from '@/stores'

const TRANSLATIONS = SUPPORTED_TRANSLATIONS

interface RecentVerse {
  verse: BibleVerseResult
  timestamp: number
}

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
  
  // Recent verses history (session only)
  const [recentVerses, setRecentVerses] = useState<RecentVerse[]>([])
  
  // Quick search (Holyrics-style) - separate fields
  const [quickSearchBook, setQuickSearchBook] = useState('')
  const [quickSearchChapter, setQuickSearchChapter] = useState('')
  const [quickSearchVerse, setQuickSearchVerse] = useState('')
  const [parsedBook, setParsedBook] = useState<{ name: string; id: string } | null>(null)
  const [isBookLocked, setIsBookLocked] = useState(false)
  const quickSearchBookRef = useRef<HTMLInputElement>(null)
  const quickSearchChapterRef = useRef<HTMLInputElement>(null)
  const quickSearchVerseRef = useRef<HTMLInputElement>(null)
  const [showQuickSearch, setShowQuickSearch] = useState(false)

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

  // Keyboard shortcut for quick search (any letter key)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      // Check if it's a letter key
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        e.preventDefault()
        setQuickSearchBook(e.key.toLowerCase())
        setQuickSearchChapter('')
        setQuickSearchVerse('')
        setParsedBook(null)
        setIsBookLocked(false)
        setShowQuickSearch(true)
        setTimeout(() => quickSearchBookRef.current?.focus(), 50)
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [])

  // Autocomplete book as user types
  useEffect(() => {
    if (!quickSearchBook.trim() || isBookLocked) return
    
    const suggestion = getBookSuggestion(quickSearchBook.trim())
    if (suggestion) {
      setParsedBook({ name: suggestion.name, id: suggestion.id })
    } else {
      setParsedBook(null)
    }
  }, [quickSearchBook, isBookLocked])

  // Handle book input with auto-lock when number is detected
  const handleBookChange = (value: string) => {
    if (isBookLocked) return
    
    // Check if user is typing a number - auto-lock the book
    if (/\d/.test(value) && parsedBook) {
      setQuickSearchBook(parsedBook.name)
      setIsBookLocked(true)
      setQuickSearchChapter(value.match(/\d+/)?.[0] || '')
      quickSearchChapterRef.current?.focus()
      return
    }
    
    setQuickSearchBook(value)
  }

  const handleBookKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && parsedBook) {
      e.preventDefault()
      setQuickSearchBook(parsedBook.name)
      setIsBookLocked(true)
      quickSearchChapterRef.current?.focus()
    } else if ((e.key === ' ' || e.key === 'Tab') && parsedBook) {
      e.preventDefault()
      setQuickSearchBook(parsedBook.name)
      setIsBookLocked(true)
      quickSearchChapterRef.current?.focus()
    } else if (e.key === 'Escape') {
      closeQuickSearch()
    }
  }

  // Handle chapter input with validation
  const handleChapterChange = (value: string) => {
    if (!parsedBook) return
    const book = BIBLE_BOOKS.find(b => b.id === parsedBook.id)
    if (!book) return
    
    const num = parseInt(value)
    if (value === '' || (num >= 1 && num <= book.chapters)) {
      setQuickSearchChapter(value)
    }
  }

  const handleChapterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      quickSearchVerseRef.current?.focus()
    } else if (e.key === 'Enter' && quickSearchChapter) {
      e.preventDefault()
      quickSearchVerseRef.current?.focus()
    } else if (e.key === ' ' && quickSearchChapter) {
      e.preventDefault()
      quickSearchVerseRef.current?.focus()
    } else if (e.key === 'Escape') {
      closeQuickSearch()
    } else if (e.key === 'Backspace' && quickSearchChapter === '') {
      // Go back to book field
      setIsBookLocked(false)
      quickSearchBookRef.current?.focus()
    }
  }

  // Handle verse input and auto-project when complete
  const handleVerseChange = (value: string) => {
    setQuickSearchVerse(value)
    
    // Auto-project when all fields are complete
    if (parsedBook && quickSearchChapter && value) {
      const chapter = parseInt(quickSearchChapter)
      const verse = parseInt(value)
      
      if (!isNaN(chapter) && !isNaN(verse)) {
        // Small delay to let user see the complete input
        setTimeout(() => {
          handleQuickSearchProject()
        }, 300)
      }
    }
  }

  const handleVerseKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      // Stay on verse field or project if complete
      if (parsedBook && quickSearchChapter && quickSearchVerse) {
        handleQuickSearchProject()
      }
    } else if (e.key === 'Enter' && parsedBook && quickSearchChapter && quickSearchVerse) {
      e.preventDefault()
      handleQuickSearchProject()
    } else if (e.key === 'Escape') {
      closeQuickSearch()
    } else if (e.key === 'Backspace' && quickSearchVerse === '') {
      // Go back to chapter field
      quickSearchChapterRef.current?.focus()
    }
  }

  // Project the verse
  const handleQuickSearchProject = async () => {
    if (!parsedBook || !quickSearchChapter || !quickSearchVerse) return

    const chapter = parseInt(quickSearchChapter)
    const verse = parseInt(quickSearchVerse)

    if (isNaN(chapter) || isNaN(verse)) return

    const book = BIBLE_BOOKS.find(b => b.id === parsedBook.id)
    if (!book || chapter < 1 || chapter > book.chapters) return

    try {
      const result = await fetchChapter(parsedBook.id, chapter, selectedTranslation)
      // Find verse by matching the reference pattern "BookName Chapter:Verse"
      const targetVerse = result.find(v => v.reference.endsWith(`:${verse}`))
      
      if (targetVerse) {
        projectVerse(targetVerse)
        setSelectedBook(parsedBook.id)
        setSelectedChapter(chapter)
        closeQuickSearch()
      }
    } catch (error) {
      console.error('Error loading verse:', error)
    }
  }

  const closeQuickSearch = () => {
    setShowQuickSearch(false)
    setQuickSearchBook('')
    setQuickSearchChapter('')
    setQuickSearchVerse('')
    setParsedBook(null)
    setIsBookLocked(false)
  }

  useEffect(() => {
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
    
    // Add to recent verses history
    versesToProject.forEach(verse => {
      setRecentVerses(prev => {
        // Remove duplicates and add to beginning
        const filtered = prev.filter(r => r.verse.reference !== verse.reference)
        return [{ verse, timestamp: Date.now() }, ...filtered].slice(0, 10) // Keep last 10
      })
    })
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
          {/* Quick Search (Holyrics-style) - Separate Editable Fields */}
          {showQuickSearch && (
            <div className="quick-search-overlay">
              <div className="quick-search-modal-holyrics">
                <div className="quick-search-header">
                  <span>Esc para cancelar</span>
                  <button 
                    className="btn-icon" 
                    onClick={closeQuickSearch}
                    aria-label="Cerrar"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="quick-search-sections">
                  {/* Book Section */}
                  <div className="quick-search-section">
                    <div className="section-label">Libro</div>
                    <input
                      ref={quickSearchBookRef}
                      type="text"
                      value={isBookLocked ? parsedBook?.name || '' : quickSearchBook}
                      onChange={e => handleBookChange(e.target.value)}
                      onKeyDown={handleBookKeyDown}
                      className={`section-input section-input-book ${isBookLocked ? 'locked' : ''}`}
                      placeholder="Sa_"
                      readOnly={isBookLocked}
                      tabIndex={isBookLocked ? -1 : 0}
                      autoFocus
                    />
                    {parsedBook && !isBookLocked && (
                      <div className="book-autocomplete-hint">
                        {parsedBook.name} - Presiona TAB para autocompletar
                      </div>
                    )}
                  </div>
                  
                  {/* Chapter Section */}
                  <div className="quick-search-section">
                    <div className="section-label">Capítulo</div>
                    <input
                      ref={quickSearchChapterRef}
                      type="number"
                      min="1"
                      max={parsedBook ? BIBLE_BOOKS.find(b => b.id === parsedBook.id)?.chapters : undefined}
                      value={quickSearchChapter}
                      onChange={e => handleChapterChange(e.target.value)}
                      onKeyDown={handleChapterKeyDown}
                      className="section-input section-input-number"
                      placeholder="_"
                      disabled={!isBookLocked}
                    />
                  </div>
                  
                  {/* Verse Section */}
                  <div className="quick-search-section">
                    <div className="section-label">Versículo</div>
                    <input
                      ref={quickSearchVerseRef}
                      type="number"
                      min="1"
                      value={quickSearchVerse}
                      onChange={e => handleVerseChange(e.target.value)}
                      onKeyDown={handleVerseKeyDown}
                      className="section-input section-input-number"
                      placeholder="_"
                      disabled={!quickSearchChapter}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

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
              {book.name} — Capítulo {selectedChapter}
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

          {/* Bento de capítulos */}
          <div className="chapters-bento">
            {Array.from({ length: book.chapters }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                className={`chapter-cell ${selectedChapter === n ? 'active' : ''}`}
                onClick={() => setSelectedChapter(n)}
                aria-label={`Capítulo ${n}`}
              >
                {n}
              </button>
            ))}
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

        {/* Recent Verses History */}
        <div className="bible-recent">
          <div className="recent-header">
            <Clock size={14} /> Recientes
          </div>
          {recentVerses.length === 0 ? (
            <div className="recent-empty">
              Los versículos proyectados aparecerán aquí
            </div>
          ) : (
            <div className="recent-list">
              {recentVerses.map((item, i) => (
                <div
                  key={i}
                  className={`recent-verse-item ${state.songTitle === item.verse.reference ? 'projected' : ''}`}
                  onClick={() => {
                    projectVerse(item.verse)
                    if (item.verse.bookId && item.verse.chapter) {
                      handleSelectBook(item.verse.bookId)
                      setSelectedChapter(item.verse.chapter)
                    }
                  }}
                >
                  <div className="recent-verse-reference">{item.verse.reference}</div>
                  <div className="recent-verse-text">{item.verse.text}</div>
                </div>
              ))}
            </div>
          )}
          <div className="recent-hint">
            Historial de esta sesión
          </div>
        </div>
      </div>
    </div>
  )
}