import { useState, useEffect, useRef } from 'react'
import { BookOpen, Search, ChevronLeft, ChevronRight, X, Menu, Clock, Plus, Trash2 } from 'lucide-react'
import { BIBLE_BOOKS, fetchChapter, searchGlobal, getBookSuggestion, SUPPORTED_TRANSLATIONS } from '@/services/bible'
import type { BibleVerseResult } from '@/services/bible'
import { useShallow } from 'zustand/react/shallow'
import { useProjectionStore, useAppStore } from '@/stores'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import ImportBibleModal from '@/components/songs/ImportBibleModal'


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
  const [selectedLanguage, setSelectedLanguage] = useState<'Español' | 'Inglés'>('Español')
  const [showImportModal, setShowImportModal] = useState(false)
  const importedBibles = useLiveQuery(() => db.imported_bibles.toArray()) || []
  const [dynamicBookNames, setDynamicBookNames] = useState<Record<string, string>>({})
  const [isLoadingBooks, setIsLoadingBooks] = useState(false)

  
  // Recent verses history (persistent)
  const [recentVerses, setRecentVerses] = useState<RecentVerse[]>(() => {
    const saved = localStorage.getItem('proclama-recent-verses')
    return saved ? JSON.parse(saved) : []
  })
  
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
  const versesListRef = useRef<HTMLDivElement>(null)
  const [scrollToVerse, setScrollToVerse] = useState<number | null>(null)

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
  const filteredTranslations = [
    ...SUPPORTED_TRANSLATIONS.filter(t => (t as any).lang === selectedLanguage),
    ...importedBibles.map(b => ({ id: b.id, name: b.name, lang: b.languageName }))
  ]

  // Actualizar nombres de libros si es una biblia importada de HelloAO
  useEffect(() => {
    const isImported = importedBibles.find(b => b.id === selectedTranslation)
    if (isImported) {
      setIsLoadingBooks(true)
      fetch(`https://bible.helloao.org/api/${selectedTranslation}/books.json`)
        .then(r => r.json())
        .then(data => {
          if (data && data.books) {
            const nameMap: Record<string, string> = {}
            for (const book of data.books) {
              nameMap[book.id.toLowerCase()] = book.name || book.commonName || book.title
            }
            setDynamicBookNames(nameMap)
          }
          setIsLoadingBooks(false)
        })
        .catch(err => {
          console.error("Error cargando metadatos de libros", err)
          setDynamicBookNames({})
          setIsLoadingBooks(false)
        })
    } else {
      setDynamicBookNames({})
      setIsLoadingBooks(false)
    }
  }, [selectedTranslation, importedBibles])

  // Reset selected translation if it's not in the filtered list
  useEffect(() => {
    if (!filteredTranslations.find(t => t.id === selectedTranslation)) {
      setSelectedTranslation(filteredTranslations[0]?.id || 'RVR1960')
    }
  }, [selectedLanguage])

  // Keyboard shortcut for quick search (any letter key)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      // Check if it's a letter or number key
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
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

  // Autocomplete book as user types - Automatic lock when unique
  useEffect(() => {
    if (!quickSearchBook.trim() || isBookLocked) return
    
    const suggestion = getBookSuggestion(quickSearchBook.trim())
    if (suggestion) {
      const displayName = selectedLanguage === 'Inglés' ? (suggestion as any).name || suggestion.name : suggestion.name
      setParsedBook({ name: displayName, id: suggestion.id })
      
      // AUTO-LOCK: Si ya es una coincidencia única y han escrito al menos 2 caracteres
      const query = quickSearchBook.trim().toLowerCase()
      if (query.length >= 2) {
        setQuickSearchBook(displayName)
        setIsBookLocked(true)
        // Reset chapter for numbered books autocompletion (Option B)
        setQuickSearchChapter('')
        setTimeout(() => quickSearchChapterRef.current?.focus(), 10)
      }
    } else {
      setParsedBook(null)
    }
  }, [quickSearchBook, isBookLocked, selectedLanguage])

  // Handle book input with auto-lock when number is detected
  const handleBookChange = (value: string) => {
    if (isBookLocked) return
    
    // Check if user is typing a number - auto-lock the book
    if (/\d/.test(value) && parsedBook) {
      // PREVENCIÓN: No bloquear si el valor sigue siendo un prefijo válido del libro sugerido
      // Esto evita que el "1" en "1 Pedro" dispare el bloqueo del capítulo prematuramente.
      const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const nameClean = removeAccents(parsedBook.name.toLowerCase()).replace(/\s/g, '')
      const valClean = removeAccents(value.toLowerCase()).replace(/\s/g, '')
      
      if (nameClean.startsWith(valClean)) {
        setQuickSearchBook(value)
        return
      }

      setQuickSearchBook(parsedBook.name)
      setIsBookLocked(true)
      
      // Extraer capítulo inteligentemente (excluyendo el prefijo del libro si es necesario)
      const chapterPart = value.substring(parsedBook.name.length).trim() || value.match(/\d+$/)?.[0] || ''
      setQuickSearchChapter(chapterPart)
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
    
    // Solo permitir números
    const cleanValue = value.replace(/\D/g, '')
    const num = parseInt(cleanValue)
    
    if (cleanValue === '' || (num >= 1 && num <= book.chapters)) {
      setQuickSearchChapter(cleanValue)
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

  // Handle verse input
  const handleVerseChange = (value: string) => {
    // Solo permitir números
    const cleanValue = value.replace(/\D/g, '')
    setQuickSearchVerse(cleanValue)
  }

  const handleVerseKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      // Stay on verse field or project if complete
      if (parsedBook && quickSearchChapter && quickSearchVerse) {
        handleQuickSearchProject()
      }
    } else if ((e.key === 'Enter' || e.key === ' ') && parsedBook && quickSearchChapter && quickSearchVerse) {
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
        setScrollToVerse(verse)
        closeQuickSearch()
      }
    } catch (error) {
      console.error('Error loading verse:', error)
    }
  }

  const extractVerseNumber = (reference: string): number | null => {
    const match = reference.match(/:(\d+)$/)
    return match ? parseInt(match[1]) : null
  }

  useEffect(() => {
    if (!loading && scrollToVerse !== null && versesListRef.current) {
      const verseEl = versesListRef.current.querySelector(`[data-verse="${scrollToVerse}"]`)
      if (verseEl) {
        verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setScrollToVerse(null)
    }
  }, [loading, scrollToVerse, verses])

  const closeQuickSearch = () => {
    setShowQuickSearch(false)
    setQuickSearchBook('')
    setQuickSearchChapter('')
    setQuickSearchVerse('')
    setParsedBook(null)
    setIsBookLocked(false)
  }

  useEffect(() => {
    localStorage.setItem('proclama-recent-verses', JSON.stringify(recentVerses))
  }, [recentVerses])

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
        const vNum = extractVerseNumber(v.reference)
        if (vNum) setScrollToVerse(vNum)
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
      language: selectedLanguage,
      usageCount: 0,
      isPublic: true,
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }, true, 0)
    
    // Add to recent verses history
    versesToProject.forEach(verse => {
      setRecentVerses(prev => {
        // Remove duplicates and add to beginning
        const filtered = prev.filter(r => r.verse.reference !== verse.reference)
        return [{ verse, timestamp: Date.now() }, ...filtered].slice(0, 50) // Keep last 50
      })
    })
  }

  const handleDeleteImportedBible = async () => {
    const bibleToDelete = importedBibles.find(b => b.id === selectedTranslation);
    if (!bibleToDelete) return;
    
    if (confirm(`¿Estás seguro de que deseas eliminar la Biblia "${bibleToDelete.name}"?\nEsta acción no se puede deshacer y borrará los capítulos descargados.`)) {
      try {
        await db.imported_bibles.delete(bibleToDelete.id);
        await db.bible_books_cache.where('bibleId').equals(bibleToDelete.id).delete();
        await db.bible_chapters_cache.where('bibleId').equals(bibleToDelete.id).delete();
        setSelectedTranslation('RVR1960');
      } catch (error) {
        console.error("Error al eliminar la biblia:", error);
        alert("Ocurrió un error al intentar eliminar la Biblia.");
      }
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
          )}
          <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={24} color="var(--gold)" />
            Biblia
          </h1>
        </div>
        
        <div className="header-actions" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', background: 'var(--bg-base)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            {(['Español', 'Inglés'] as const).map(l => (
              <button
                key={l}
                style={{ 
                   padding: '6px 16px', 
                   border: 'none', 
                   background: selectedLanguage === l ? 'var(--bg-elevated)' : 'transparent',
                   color: selectedLanguage === l ? 'var(--text-primary)' : 'var(--text-muted)',
                   borderRadius: '6px',
                   fontSize: '0.9rem',
                   fontWeight: selectedLanguage === l ? 500 : 400,
                   cursor: 'pointer',
                   boxShadow: selectedLanguage === l ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                   transition: 'all 0.2s ease'
                }}
                onClick={() => setSelectedLanguage(l)}
              >
                {l}
              </button>
            ))}
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              className="filter-select"
              value={selectedTranslation}
              onChange={e => setSelectedTranslation(e.target.value)}
              style={{
                 maxWidth: '250px',
                 padding: '8px 12px',
                 borderRadius: '8px',
                 border: '1px solid var(--border)',
                 background: 'var(--bg-elevated)',
                 color: 'var(--text-primary)',
                 fontSize: '0.95rem'
              }}
            >
              {filteredTranslations.map(t => <option key={t.id} value={t.id}>{t.name} ({typeof t.id === 'string' && t.id.length > 10 ? 'API' : t.id})</option>)}
            </select>

            {importedBibles.some(b => b.id === selectedTranslation) && (
              <button
                onClick={handleDeleteImportedBible}
                title="Eliminar Biblia Importada"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: '8px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'var(--red-dim)'; e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <Trash2 size={16} />
              </button>
            )}

            <button 
              onClick={() => setShowImportModal(true)}
              title="Importar más Biblias (Premium)"
              style={{ 
                padding: '8px 14px', 
                background: 'var(--bg-elevated)', 
                border: '1px solid var(--border)', 
                borderRadius: '8px',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
              onMouseOver={e => {e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'}}
              onMouseOut={e => {e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'}}
            >
              <Plus size={16} /> <span style={{ fontSize: '0.9rem' }}>Importar</span>
            </button>
          </div>
        </div>
      </div>

      {showImportModal && (
        <ImportBibleModal 
          onClose={() => setShowImportModal(false)} 
          onImportSuccess={() => {
            // Refrescar al cerrar si es necesario, aunque useLiveQuery ya lo hace.
          }} 
        />
      )}

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
            {isLoadingBooks ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Cargando biblioteca...
              </div>
            ) : filteredBooks.filter(b => {
                // Si es importada y ya cargó, OMITIR libros que no existan en la traducción
                const isImported = importedBibles.find(t => t.id === selectedTranslation)
                if (isImported && Object.keys(dynamicBookNames).length > 0) {
                  return !!dynamicBookNames[b.id.toLowerCase()]
                }
                return true;
            }).map(b => {
              let displayName = dynamicBookNames[b.id.toLowerCase()] || (selectedLanguage === 'Inglés' ? b.nameEn : b.name);
              // Si la API arroja nombres feos como "LUK", "ACT", "1COR" caer por defecto en el nativo
              if (displayName.toUpperCase() === b.id.toUpperCase()) {
                displayName = selectedLanguage === 'Inglés' ? b.nameEn : b.name;
              }

              return (
                <button
                  key={b.id}
                  className={`book-item ${selectedBook === b.id ? 'active' : ''}`}
                  onClick={() => handleSelectBook(b.id)}
                >
                  {displayName}
                </button>
              )
            })}
          </div>
        </div>

        <div className="bible-main">
          {/* Quick Search (Holyrics-style) - Separate Editable Fields */}
          {showQuickSearch && (
            <div className="quick-search-overlay">
              <div className="quick-search-modal-holyrics">
                <div className="quick-search-header">
                  <div className="quick-search-info">
                    <span>Esc para cancelar</span>
                    {parsedBook && (
                      <span className="book-info-tag">
                        {parsedBook.name}: <strong>{BIBLE_BOOKS.find(b => b.id === parsedBook.id)?.chapters}</strong> {selectedLanguage === 'Inglés' ? 'chapters' : 'capítulos'}
                      </span>
                    )}
                  </div>
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
                    <div className="section-label">{selectedLanguage === 'Inglés' ? 'Book' : 'Libro'}</div>
                    <input
                      ref={quickSearchBookRef}
                      type="text"
                      value={isBookLocked ? parsedBook?.name || '' : quickSearchBook}
                      onChange={e => handleBookChange(e.target.value)}
                      onKeyDown={handleBookKeyDown}
                      className={`section-input section-input-book ${isBookLocked ? 'locked' : ''}`}
                      placeholder={selectedLanguage === 'Inglés' ? 'Ge_' : 'Gé_'}
                      readOnly={isBookLocked}
                      tabIndex={isBookLocked ? -1 : 0}
                      autoFocus
                    />
                    {parsedBook && !isBookLocked && (
                      <div className="book-autocomplete-hint">
                        {selectedLanguage === 'Inglés' ? parsedBook.name : parsedBook.name} - {selectedLanguage === 'Inglés' ? 'Press TAB to autocomplete' : 'Presiona TAB para autocompletar'}
                      </div>
                    )}
                  </div>
                  
                  {/* Chapter Section */}
                  <div className="quick-search-section">
                    <div className="section-label">{selectedLanguage === 'Inglés' ? 'Chapter' : 'Capítulo'}</div>
                    <input
                      ref={quickSearchChapterRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
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
                    <div className="section-label">{selectedLanguage === 'Inglés' ? 'Verse' : 'Versículo'}</div>
                    <input
                      ref={quickSearchVerseRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
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
              {(() => {
                let displayName = dynamicBookNames[book.id.toLowerCase()] || (selectedLanguage === 'Inglés' ? book.nameEn : book.name);
                if (displayName.toUpperCase() === book.id.toUpperCase()) {
                  displayName = selectedLanguage === 'Inglés' ? book.nameEn : book.name;
                }
                return displayName;
              })()} — Capítulo {selectedChapter}
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
                        const vNum = extractVerseNumber(v.reference)
                        if (vNum) setScrollToVerse(vNum)
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
            <div className="verses-list" ref={versesListRef}>
              {verses.map((verse, i) => (
                <div
                  key={i}
                  data-verse={i + 1}
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
          <div className="recent-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} /> Recientes
            </div>
            {recentVerses.length > 0 && (
              <button 
                className="btn-icon" 
                title="Limpiar historial"
                onClick={() => {
                  if (confirm('¿Limpiar historial de versículos?')) {
                    setRecentVerses([])
                    localStorage.removeItem('proclama-recent-verses')
                  }
                }}
                style={{ width: '24px', height: '24px', opacity: 0.6 }}
              >
                <X size={12} />
              </button>
            )}
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
                      const vNum = extractVerseNumber(item.verse.reference)
                      if (vNum) setScrollToVerse(vNum)
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
            Historial reciente (persistente)
          </div>
        </div>
      </div>
    </div>
  )
}