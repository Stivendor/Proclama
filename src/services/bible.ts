// API gratuita sin CORS: bible-api.com (dominio público / RVR1960)
import { BIBLE_CONTENT, BIBLE_BOOKS as IMPORTED_BIBLE_BOOKS } from '@/data/bible-content'

export const BIBLE_BOOKS: BibleBook[] = [
  // ─── Antiguo Testamento ───
  { id: 'gen', name: 'Génesis', nameEn: 'Genesis', chapters: 50, testament: 'AT' },
  { id: 'exo', name: 'Éxodo', nameEn: 'Exodus', chapters: 40, testament: 'AT' },
  { id: 'lev', name: 'Levítico', nameEn: 'Leviticus', chapters: 27, testament: 'AT' },
  { id: 'num', name: 'Números', nameEn: 'Numbers', chapters: 36, testament: 'AT' },
  { id: 'deu', name: 'Deuteronomio', nameEn: 'Deuteronomy', chapters: 34, testament: 'AT' },
  { id: 'jos', name: 'Josué', nameEn: 'Joshua', chapters: 24, testament: 'AT' },
  { id: 'jdg', name: 'Jueces', nameEn: 'Judges', chapters: 21, testament: 'AT' },
  { id: 'rut', name: 'Rut', nameEn: 'Ruth', chapters: 4, testament: 'AT' },
  { id: '1sa', name: '1 Samuel', nameEn: '1 Samuel', chapters: 31, testament: 'AT' },
  { id: '2sa', name: '2 Samuel', nameEn: '2 Samuel', chapters: 24, testament: 'AT' },
  { id: '1ki', name: '1 Reyes', nameEn: '1 Kings', chapters: 22, testament: 'AT' },
  { id: '2ki', name: '2 Reyes', nameEn: '2 Kings', chapters: 25, testament: 'AT' },
  { id: '1ch', name: '1 Crónicas', nameEn: '1 Chronicles', chapters: 29, testament: 'AT' },
  { id: '2ch', name: '2 Crónicas', nameEn: '2 Chronicles', chapters: 36, testament: 'AT' },
  { id: 'ezr', name: 'Esdras', nameEn: 'Ezra', chapters: 10, testament: 'AT' },
  { id: 'neh', name: 'Nehemías', nameEn: 'Nehemiah', chapters: 13, testament: 'AT' },
  { id: 'est', name: 'Ester', nameEn: 'Esther', chapters: 10, testament: 'AT' },
  { id: 'job', name: 'Job', nameEn: 'Job', chapters: 42, testament: 'AT' },
  { id: 'psa', name: 'Salmos', nameEn: 'Psalms', chapters: 150, testament: 'AT' },
  { id: 'pro', name: 'Proverbios', nameEn: 'Proverbs', chapters: 31, testament: 'AT' },
  { id: 'ecc', name: 'Eclesiastés', nameEn: 'Ecclesiastes', chapters: 12, testament: 'AT' },
  { id: 'sng', name: 'Cantares', nameEn: 'Song of Solomon', chapters: 8, testament: 'AT' },
  { id: 'isa', name: 'Isaías', nameEn: 'Isaiah', chapters: 66, testament: 'AT' },
  { id: 'jer', name: 'Jeremías', nameEn: 'Jeremiah', chapters: 52, testament: 'AT' },
  { id: 'lam', name: 'Lamentaciones', nameEn: 'Lamentations', chapters: 5, testament: 'AT' },
  { id: 'ezk', name: 'Ezequiel', nameEn: 'Ezekiel', chapters: 48, testament: 'AT' },
  { id: 'dan', name: 'Daniel', nameEn: 'Daniel', chapters: 12, testament: 'AT' },
  { id: 'hos', name: 'Oseas', nameEn: 'Hosea', chapters: 14, testament: 'AT' },
  { id: 'jol', name: 'Joel', nameEn: 'Joel', chapters: 3, testament: 'AT' },
  { id: 'amo', name: 'Amós', nameEn: 'Amos', chapters: 9, testament: 'AT' },
  { id: 'oba', name: 'Abdías', nameEn: 'Obadiah', chapters: 1, testament: 'AT' },
  { id: 'jon', name: 'Jonás', nameEn: 'Jonah', chapters: 4, testament: 'AT' },
  { id: 'mic', name: 'Miqueas', nameEn: 'Micah', chapters: 7, testament: 'AT' },
  { id: 'nam', name: 'Nahúm', nameEn: 'Nahum', chapters: 3, testament: 'AT' },
  { id: 'hab', name: 'Habacuc', nameEn: 'Habakkuk', chapters: 3, testament: 'AT' },
  { id: 'zep', name: 'Sofonías', nameEn: 'Zephaniah', chapters: 3, testament: 'AT' },
  { id: 'hag', name: 'Hageo', nameEn: 'Haggai', chapters: 2, testament: 'AT' },
  { id: 'zec', name: 'Zacarías', nameEn: 'Zechariah', chapters: 14, testament: 'AT' },
  { id: 'mal', name: 'Malaquías', nameEn: 'Malachi', chapters: 4, testament: 'AT' },
  // ─── Nuevo Testamento ───
  { id: 'mat', name: 'Mateo', nameEn: 'Matthew', chapters: 28, testament: 'NT' },
  { id: 'mrk', name: 'Marcos', nameEn: 'Mark', chapters: 16, testament: 'NT' },
  { id: 'luk', name: 'Lucas', nameEn: 'Luke', chapters: 24, testament: 'NT' },
  { id: 'jhn', name: 'Juan', nameEn: 'John', chapters: 21, testament: 'NT' },
  { id: 'act', name: 'Hechos', nameEn: 'Acts', chapters: 28, testament: 'NT' },
  { id: 'rom', name: 'Romanos', nameEn: 'Romans', chapters: 16, testament: 'NT' },
  { id: '1co', name: '1 Corintios', nameEn: '1 Corinthians', chapters: 16, testament: 'NT' },
  { id: '2co', name: '2 Corintios', nameEn: '2 Corinthians', chapters: 13, testament: 'NT' },
  { id: 'gal', name: 'Gálatas', nameEn: 'Galatians', chapters: 6, testament: 'NT' },
  { id: 'eph', name: 'Efesios', nameEn: 'Ephesians', chapters: 6, testament: 'NT' },
  { id: 'php', name: 'Filipenses', nameEn: 'Philippians', chapters: 4, testament: 'NT' },
  { id: 'col', name: 'Colosenses', nameEn: 'Colossians', chapters: 4, testament: 'NT' },
  { id: '1th', name: '1 Tesalonicenses', nameEn: '1 Thessalonians', chapters: 5, testament: 'NT' },
  { id: '2th', name: '2 Tesalonicenses', nameEn: '2 Thessalonians', chapters: 3, testament: 'NT' },
  { id: '1ti', name: '1 Timoteo', nameEn: '1 Timothy', chapters: 6, testament: 'NT' },
  { id: '2ti', name: '2 Timoteo', nameEn: '2 Timothy', chapters: 4, testament: 'NT' },
  { id: 'tit', name: 'Tito', nameEn: 'Titus', chapters: 3, testament: 'NT' },
  { id: 'phm', name: 'Filemón', nameEn: 'Philemon', chapters: 1, testament: 'NT' },
  { id: 'heb', name: 'Hebreos', nameEn: 'Hebrews', chapters: 13, testament: 'NT' },
  { id: 'jas', name: 'Santiago', nameEn: 'James', chapters: 5, testament: 'NT' },
  { id: '1pe', name: '1 Pedro', nameEn: '1 Peter', chapters: 5, testament: 'NT' },
  { id: '2pe', name: '2 Pedro', nameEn: '2 Peter', chapters: 3, testament: 'NT' },
  { id: '1jn', name: '1 Juan', nameEn: '1 John', chapters: 5, testament: 'NT' },
  { id: '2jn', name: '2 Juan', nameEn: '2 John', chapters: 1, testament: 'NT' },
  { id: '3jn', name: '3 Juan', nameEn: '3 John', chapters: 1, testament: 'NT' },
  { id: 'jud', name: 'Judas', nameEn: 'Jude', chapters: 1, testament: 'NT' },
  { id: 'rev', name: 'Apocalipsis', nameEn: 'Revelation', chapters: 22, testament: 'NT' },
]

// Mapeo de IDs de libros a IDs numéricos de Bolls Life (1-66)
const BOLLS_BOOK_MAP: Record<string, number> = {
  gen: 1, exo: 2, lev: 3, num: 4, deu: 5, jos: 6, jdg: 7, rut: 8, '1sa': 9, '2sa': 10,
  '1ki': 11, '2ki': 12, '1ch': 13, '2ch': 14, ezr: 15, neh: 16, est: 17, job: 18, psa: 19, pro: 20,
  ecc: 21, sng: 22, isa: 23, jer: 24, lam: 25, ezk: 26, dan: 27, hos: 28, jol: 29, amo: 30,
  oba: 31, jon: 32, mic: 33, nam: 34, hab: 35, zep: 36, hag: 37, zec: 38, mal: 39,
  mat: 40, mrk: 41, luk: 42, jhn: 43, act: 44, rom: 45, '1co': 46, '2co': 47, gal: 48, eph: 49,
  php: 50, col: 51, '1th': 52, '2th': 53, '1ti': 54, '2ti': 55, tit: 56, phm: 57, heb: 58, jas: 59,
  '1pe': 60, '2pe': 61, '1jn': 62, '2jn': 63, '3jn': 64, jud: 65, rev: 66
}

export const SUPPORTED_TRANSLATIONS = [
  // Español
  { id: 'RVR1960', name: 'Reina Valera 1960', lang: 'Español' },
  { id: 'NVI', name: 'Nueva Versión Internacional', lang: 'Español' },
  { id: 'PDT', name: 'Palabra de Dios para Todos', lang: 'Español' },
  { id: 'LBLA', name: 'La Biblia de las Américas', lang: 'Español' },
  { id: 'NTV', name: 'Nueva Traducción Viviente', lang: 'Español' },
  
  // Inglés
  { id: 'KJV', name: 'King James Version', lang: 'Inglés' },
  { id: 'ESV', name: 'English Standard Version', lang: 'Inglés' },
  { id: 'WEB', name: 'World English Bible', lang: 'Inglés' },
  { id: 'NASB', name: 'New American Standard Bible', lang: 'Inglés' },
  { id: 'NET', name: 'New English Translation', lang: 'Inglés' }
]

export interface BibleVerseResult {
  reference: string
  text: string
  translation: string
  bookId?: string
  chapter?: number
}

export interface BibleChapterResult {
  verses: BibleVerseResult[]
}

// Datos locales - Combina BIBLE_CONTENT expandida con datos locales adicionales
const BIBLE_DATA = BIBLE_CONTENT

// Request deduplication and caching for searchGlobal
const pendingRequests = new Map<string, Promise<BibleVerseResult[]>>()
const searchCache = new Map<string, { results: BibleVerseResult[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Chapter caching with LRU eviction
interface ChapterCacheEntry {
  verses: BibleVerseResult[]
  timestamp: number
}

const chapterCache = new Map<string, ChapterCacheEntry>()
const MAX_CHAPTER_CACHE_SIZE = 50
const chapterAccessOrder: string[] = [] // Track access order for LRU

function getCacheKey(bookId: string, chapter: number, translation: string): string {
  return `${bookId}:${chapter}:${translation}`
}

function evictLRUChapter(): void {
  if (chapterAccessOrder.length > 0) {
    const oldestKey = chapterAccessOrder.shift()
    if (oldestKey) {
      chapterCache.delete(oldestKey)
    }
  }
}

function updateChapterAccess(key: string): void {
  // Remove key from current position if it exists
  const index = chapterAccessOrder.indexOf(key)
  if (index > -1) {
    chapterAccessOrder.splice(index, 1)
  }
  // Add to end (most recently used)
  chapterAccessOrder.push(key)
}

function getCachedChapter(bookId: string, chapter: number, translation: string): BibleVerseResult[] | null {
  const key = getCacheKey(bookId, chapter, translation)
  const cached = chapterCache.get(key)
  
  if (cached) {
    updateChapterAccess(key)
    return cached.verses
  }
  
  return null
}

function setCachedChapter(bookId: string, chapter: number, translation: string, verses: BibleVerseResult[]): void {
  const key = getCacheKey(bookId, chapter, translation)
  
  // Evict oldest entry if cache is full
  if (chapterCache.size >= MAX_CHAPTER_CACHE_SIZE && !chapterCache.has(key)) {
    evictLRUChapter()
  }
  
  chapterCache.set(key, {
    verses,
    timestamp: Date.now()
  })
  
  updateChapterAccess(key)
}

export function clearChapterCache(): void {
  chapterCache.clear()
  chapterAccessOrder.length = 0
}

export function clearChapterCacheForTranslation(translation: string): void {
  const keysToDelete: string[] = []
  
  for (const key of chapterCache.keys()) {
    if (key.endsWith(`:${translation}`)) {
      keysToDelete.push(key)
    }
  }
  
  keysToDelete.forEach(key => {
    chapterCache.delete(key)
    const index = chapterAccessOrder.indexOf(key)
    if (index > -1) {
      chapterAccessOrder.splice(index, 1)
    }
  })
}

export async function fetchChapter(
  bookId: string,
  chapter: number,
  translation = 'RVR1960'
): Promise<BibleVerseResult[]> {
  try {
    // Check cache first
    const cached = getCachedChapter(bookId, chapter, translation)
    if (cached) {
      return cached
    }
    
    const bookName = BIBLE_BOOKS.find(b => b.id === bookId)?.name ?? bookId
    
    // Primero intentar datos locales si es RVR1960
    if (translation === 'RVR1960' && BIBLE_DATA[bookId]?.[chapter]) {
      const verses = BIBLE_DATA[bookId][chapter].map(v => ({
        reference: `${bookName} ${chapter}:${v.verse}`,
        text: v.text,
        translation: 'RVR1960',
        bookId,
        chapter
      }))
      
      // Cache the result
      setCachedChapter(bookId, chapter, translation, verses)
      return verses
    }
    
    // Si no hay datos locales o es otra versión, usar Bolls Life API
    const bollsId = BOLLS_BOOK_MAP[bookId] || 1
    const url = `https://bolls.life/get-text/${translation}/${bollsId}/${chapter}/`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (!res.ok) return []
    const data = await res.json()
    
    const verses = (data ?? []).map((v: any) => ({
      reference: `${bookName} ${chapter}:${v.verse}`,
      text: v.text
        .replace(/<[^>]*>?/gm, '') // Limpiar HTML
        .replace(/([a-zA-Z])\d+/g, '$1') // Quitar números pegados a palabras (Strong's)
        .replace(/\s\d{3,5}\b/g, ' ') // Quitar números de 3-5 dígitos sueltos (Strong's)
        .replace(/\s+/g, ' ') // Normalizar espacios
        .trim(),
      translation,
      bookId,
      chapter
    }))
    
    // Cache the result
    setCachedChapter(bookId, chapter, translation, verses)
    return verses
  } catch (error) {
    console.error('Error fetching chapter:', error)
    return []
  }
}

export async function fetchVerse(
  bookId: string,
  chapter: number,
  verse: number,
  translation = 'RVR1960'
): Promise<BibleVerseResult | null> {
  try {
    const verses = await fetchChapter(bookId, chapter, translation)
    return verses.find(v => v.reference.endsWith(`:${verse}`)) ?? null
  } catch {
    return null
  }
}

export async function searchVerses(query: string, translation = 'RVR1960'): Promise<BibleVerseResult[]> {
  try {
    const results: BibleVerseResult[] = []
    
    // Buscar en datos locales
    for (const [bookId, chapters] of Object.entries(BIBLE_DATA)) {
      const bookName = BIBLE_BOOKS.find(b => b.id === bookId)?.name ?? bookId
      for (const [chapterStr, verses] of Object.entries(chapters)) {
        const chapter = Number(chapterStr)
        for (const verse of verses) {
          if (verse.text.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              reference: `${bookName} ${chapter}:${verse.verse}`,
              text: verse.text,
              translation: 'RVR1960'
            })
          }
        }
      }
    }
    
    if (results.length > 0) return results
    
    // Si no hay resultados locales, intentar API remota
    const url = `https://bible-api.com/${encodeURIComponent(query)}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (!res.ok) return []
    const data = await res.json()
    if (data.verses) {
      return data.verses.map((v: any) => ({
        reference: v.book_name ? `${v.book_name} ${v.chapter}:${v.verse}` : data.reference,
        text: v.text.trim(),
        translation: 'RVR1960'
      }))
    }
    return []
  } catch (error) {
    console.error('Error searching verses:', error)
    return []
  }
}

// Búsqueda global de texto en toda la Biblia (con soporte para referencias)
export async function searchGlobal(query: string, translation = 'RVR1960'): Promise<BibleVerseResult[]> {
  if (!query.trim()) return []
  
  const queryLower = query.toLowerCase().trim()
  const cacheKey = `${queryLower}:${translation}`
  
  // Check cache first
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results
  }
  
  // Check if request is already in flight
  const pending = pendingRequests.get(cacheKey)
  if (pending) {
    return pending
  }
  
  // Create new request
  const requestPromise = performSearch(queryLower, translation, cacheKey)
  pendingRequests.set(cacheKey, requestPromise)
  
  try {
    const results = await requestPromise
    return results
  } finally {
    pendingRequests.delete(cacheKey)
  }
}

async function performSearch(queryLower: string, translation: string, cacheKey: string): Promise<BibleVerseResult[]> {
  const results: BibleVerseResult[] = []
  
  // 1. Intentar parsear como referencia (ej: "Juan 3:16" o "Génesis 1")
  // Regex simple para: [Nombre Libro] [Capítulo](:[Versículo])?
  const refMatch = queryLower.match(/^(.+?)\s+(\d+)(?::(\d+))?$/)
  
  if (refMatch) {
    const bookQuery = refMatch[1]
    const chapter = Number(refMatch[2])
    const verseNum = refMatch[3] ? Number(refMatch[3]) : null
    
    // Buscar el libro por nombre o id (Bilingüe)
    const book = BIBLE_BOOKS.find(b => 
      b.name.toLowerCase() === bookQuery || 
      b.nameEn.toLowerCase() === bookQuery ||
      b.id.toLowerCase() === bookQuery ||
      b.name.toLowerCase().startsWith(bookQuery) ||
      b.nameEn.toLowerCase().startsWith(bookQuery)
    )
    
    if (book && BIBLE_DATA[book.id]) {
      if (verseNum) {
        // Referencia exacta: Libro C:V
        const v = BIBLE_DATA[book.id][chapter]?.find(v => v.verse === verseNum)
        if (v) {
          return [{
            reference: `${book.name} ${chapter}:${v.verse}`,
            text: v.text,
            translation: 'RVR1960',
            bookId: book.id,
            chapter
          }]
        }
      } else {
        // Capítulo completo: Libro C
        const chapterVerses = BIBLE_DATA[book.id][chapter]
        if (chapterVerses) {
          return chapterVerses.map(v => ({
            reference: `${book.name} ${chapter}:${v.verse}`,
            text: v.text,
            translation: 'RVR1960',
            bookId: book.id,
            chapter
          }))
        }
      }
    }
  }

  // 2. Intentar buscar si es solo el nombre de un libro
  const bookOnly = BIBLE_BOOKS.find(b => 
    b.name.toLowerCase() === queryLower || 
    b.nameEn.toLowerCase() === queryLower
  )
  if (bookOnly && BIBLE_DATA[bookOnly.id]) {
    // Si buscó solo el libro, mostrar los primeros versículos del cap 1
    return (BIBLE_DATA[bookOnly.id][1] || []).slice(0, 20).map(v => ({
      reference: `${bookOnly.name} 1:${v.verse}`,
      text: v.text,
      translation: 'RVR1960',
      bookId: bookOnly.id,
      chapter: 1
    }))
  }

  // 3. Búsqueda por contenido de texto (Fallback)
  let count = 0
  const MAX_RESULTS = 50 // Limitar resultados por rendimiento

  for (const [bookId, chapters] of Object.entries(BIBLE_DATA)) {
    const bookName = BIBLE_BOOKS.find(b => b.id === bookId)?.name ?? bookId
    for (const [chapterStr, verses] of Object.entries(chapters)) {
      const chapter = Number(chapterStr)
      for (const verse of verses) {
        if (verse.text.toLowerCase().includes(queryLower)) {
          results.push({
            reference: `${bookName} ${chapter}:${verse.verse}`,
            text: verse.text,
            translation: 'RVR1960',
            bookId,
            chapter
          })
          count++
          if (count >= MAX_RESULTS) break
        }
      }
      if (count >= MAX_RESULTS) break
    }
    if (count >= MAX_RESULTS) break
  }

  // 4. Si no hay suficientes resultados o es otra versión, usar Bolls Life Search API
  if (results.length < 5 || translation !== 'RVR1960') {
    try {
      const searchUrl = `https://bolls.life/search/${translation}/?search=${encodeURIComponent(queryLower)}`
      const res = await fetch(searchUrl)
      if (res.ok) {
        const apiResults = await res.json()
        apiResults.forEach((v: any) => {
          // Evitar duplicados
          const bookId = Object.keys(BOLLS_BOOK_MAP).find(key => BOLLS_BOOK_MAP[key] === v.book) || ''
          const bookName = BIBLE_BOOKS.find(b => b.id === bookId)?.name || `Libro ${v.book}`
          const ref = `${bookName} ${v.chapter}:${v.verse}`
          
          if (!results.find(r => r.reference === ref)) {
            results.push({
              reference: ref,
              text: v.text
                .replace(/<[^>]*>?/gm, '')
                .replace(/([a-zA-Z])\d+/g, '$1')
                .replace(/\s\d{3,5}\b/g, ' ')
                .replace(/\s+/g, ' ')
                .trim(),
              translation,
              bookId,
              chapter: v.chapter
            })
          }
        })
      }
    } catch (e) {
      console.error('Error in Bolls Life search:', e)
    }
  }
  
  // Cache the results before returning
  searchCache.set(cacheKey, { results, timestamp: Date.now() })
  
  return results.slice(0, MAX_RESULTS)
}

// Autocompletado de libros - devuelve el libro solo si la búsqueda es suficientemente específica
export function getBookSuggestion(query: string): { id: string; name: string } | null {
  if (!query.trim()) return null
  
  // Helper function to remove accents/diacritics
  const removeAccents = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }
  
  const queryLower = removeAccents(query.toLowerCase())
  
  // Buscar libros que comiencen con la query (ignorando tildes) en ambos idiomas
  const matches = BIBLE_BOOKS.filter(b => 
    removeAccents(b.name.toLowerCase()).startsWith(queryLower) ||
    removeAccents(b.nameEn.toLowerCase()).startsWith(queryLower)
  )
  
  // Si hay exactamente una coincidencia, devolverla
  if (matches.length === 1) {
    return { id: matches[0].id, name: matches[0].name }
  }
  
  // Si hay mltiples coincidencias, verificar si alguna es una coincidencia exacta de palabra
  const wordMatches = BIBLE_BOOKS.filter(b => {
    const partsEs = removeAccents(b.name.toLowerCase()).split(' ')
    const partsEn = removeAccents(b.nameEn.toLowerCase()).split(' ')
    return partsEs.some(part => part.startsWith(queryLower)) || 
           partsEn.some(part => part.startsWith(queryLower))
  })
  
  // Si solo hay una coincidencia de palabra, devolverla
  if (wordMatches.length === 1 && matches.length > 1) {
    return { id: wordMatches[0].id, name: wordMatches[0].name }
  }
  
  return null
}