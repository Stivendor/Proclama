// API gratuita sin CORS: bible-api.com (dominio público / RVR1960)
import { BIBLE_CONTENT, BIBLE_BOOKS as IMPORTED_BIBLE_BOOKS } from '@/data/bible-content'

export const BIBLE_BOOKS: { id: string; name: string; chapters: number; testament: 'AT' | 'NT' }[] = [
  // ─── Antiguo Testamento ───
  { id: 'gen', name: 'Génesis', chapters: 50, testament: 'AT' },
  { id: 'exo', name: 'Éxodo', chapters: 40, testament: 'AT' },
  { id: 'lev', name: 'Levítico', chapters: 27, testament: 'AT' },
  { id: 'num', name: 'Números', chapters: 36, testament: 'AT' },
  { id: 'deu', name: 'Deuteronomio', chapters: 34, testament: 'AT' },
  { id: 'jos', name: 'Josué', chapters: 24, testament: 'AT' },
  { id: 'jdg', name: 'Jueces', chapters: 21, testament: 'AT' },
  { id: 'rut', name: 'Rut', chapters: 4, testament: 'AT' },
  { id: '1sa', name: '1 Samuel', chapters: 31, testament: 'AT' },
  { id: '2sa', name: '2 Samuel', chapters: 24, testament: 'AT' },
  { id: '1ki', name: '1 Reyes', chapters: 22, testament: 'AT' },
  { id: '2ki', name: '2 Reyes', chapters: 25, testament: 'AT' },
  { id: '1ch', name: '1 Crónicas', chapters: 29, testament: 'AT' },
  { id: '2ch', name: '2 Crónicas', chapters: 36, testament: 'AT' },
  { id: 'ezr', name: 'Esdras', chapters: 10, testament: 'AT' },
  { id: 'neh', name: 'Nehemías', chapters: 13, testament: 'AT' },
  { id: 'est', name: 'Ester', chapters: 10, testament: 'AT' },
  { id: 'job', name: 'Job', chapters: 42, testament: 'AT' },
  { id: 'psa', name: 'Salmos', chapters: 150, testament: 'AT' },
  { id: 'pro', name: 'Proverbios', chapters: 31, testament: 'AT' },
  { id: 'ecc', name: 'Eclesiastés', chapters: 12, testament: 'AT' },
  { id: 'sng', name: 'Cantares', chapters: 8, testament: 'AT' },
  { id: 'isa', name: 'Isaías', chapters: 66, testament: 'AT' },
  { id: 'jer', name: 'Jeremías', chapters: 52, testament: 'AT' },
  { id: 'lam', name: 'Lamentaciones', chapters: 5, testament: 'AT' },
  { id: 'ezk', name: 'Ezequiel', chapters: 48, testament: 'AT' },
  { id: 'dan', name: 'Daniel', chapters: 12, testament: 'AT' },
  { id: 'hos', name: 'Oseas', chapters: 14, testament: 'AT' },
  { id: 'jol', name: 'Joel', chapters: 3, testament: 'AT' },
  { id: 'amo', name: 'Amós', chapters: 9, testament: 'AT' },
  { id: 'oba', name: 'Abdías', chapters: 1, testament: 'AT' },
  { id: 'jon', name: 'Jonás', chapters: 4, testament: 'AT' },
  { id: 'mic', name: 'Miqueas', chapters: 7, testament: 'AT' },
  { id: 'nam', name: 'Nahúm', chapters: 3, testament: 'AT' },
  { id: 'hab', name: 'Habacuc', chapters: 3, testament: 'AT' },
  { id: 'zep', name: 'Sofonías', chapters: 3, testament: 'AT' },
  { id: 'hag', name: 'Hageo', chapters: 2, testament: 'AT' },
  { id: 'zec', name: 'Zacarías', chapters: 14, testament: 'AT' },
  { id: 'mal', name: 'Malaquías', chapters: 4, testament: 'AT' },
  // ─── Nuevo Testamento ───
  { id: 'mat', name: 'Mateo', chapters: 28, testament: 'NT' },
  { id: 'mrk', name: 'Marcos', chapters: 16, testament: 'NT' },
  { id: 'luk', name: 'Lucas', chapters: 24, testament: 'NT' },
  { id: 'jhn', name: 'Juan', chapters: 21, testament: 'NT' },
  { id: 'act', name: 'Hechos', chapters: 28, testament: 'NT' },
  { id: 'rom', name: 'Romanos', chapters: 16, testament: 'NT' },
  { id: '1co', name: '1 Corintios', chapters: 16, testament: 'NT' },
  { id: '2co', name: '2 Corintios', chapters: 13, testament: 'NT' },
  { id: 'gal', name: 'Gálatas', chapters: 6, testament: 'NT' },
  { id: 'eph', name: 'Efesios', chapters: 6, testament: 'NT' },
  { id: 'php', name: 'Filipenses', chapters: 4, testament: 'NT' },
  { id: 'col', name: 'Colosenses', chapters: 4, testament: 'NT' },
  { id: '1th', name: '1 Tesalonicenses', chapters: 5, testament: 'NT' },
  { id: '2th', name: '2 Tesalonicenses', chapters: 3, testament: 'NT' },
  { id: '1ti', name: '1 Timoteo', chapters: 6, testament: 'NT' },
  { id: '2ti', name: '2 Timoteo', chapters: 4, testament: 'NT' },
  { id: 'tit', name: 'Tito', chapters: 3, testament: 'NT' },
  { id: 'phm', name: 'Filemón', chapters: 1, testament: 'NT' },
  { id: 'heb', name: 'Hebreos', chapters: 13, testament: 'NT' },
  { id: 'jas', name: 'Santiago', chapters: 5, testament: 'NT' },
  { id: '1pe', name: '1 Pedro', chapters: 5, testament: 'NT' },
  { id: '2pe', name: '2 Pedro', chapters: 3, testament: 'NT' },
  { id: '1jn', name: '1 Juan', chapters: 5, testament: 'NT' },
  { id: '2jn', name: '2 Juan', chapters: 1, testament: 'NT' },
  { id: '3jn', name: '3 Juan', chapters: 1, testament: 'NT' },
  { id: 'jud', name: 'Judas', chapters: 1, testament: 'NT' },
  { id: 'rev', name: 'Apocalipsis', chapters: 22, testament: 'NT' },
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

export async function fetchChapter(
  bookId: string,
  chapter: number,
  translation = 'RVR1960'
): Promise<BibleVerseResult[]> {
  try {
    const bookName = BIBLE_BOOKS.find(b => b.id === bookId)?.name ?? bookId
    
    // Primero intentar datos locales
    if (BIBLE_DATA[bookId]?.[chapter]) {
      return BIBLE_DATA[bookId][chapter].map(v => ({
        reference: `${bookName} ${chapter}:${v.verse}`,
        text: v.text,
        translation: 'RVR1960',
        bookId,
        chapter
      }))
    }
    
    // Si no hay datos locales, intentar API remota
    const url = `https://bible-api.com/${encodeURIComponent(bookName)}+${chapter}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 segundos timeout
    
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (!res.ok) return []
    const data = await res.json()
    return (data.verses ?? []).map((v: any) => ({
      reference: `${bookName} ${chapter}:${v.verse}`,
      text: v.text.trim(),
      translation: 'RVR1960'
    }))
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
  
  const results: BibleVerseResult[] = []
  const queryLower = query.toLowerCase().trim()
  
  // 1. Intentar parsear como referencia (ej: "Juan 3:16" o "Génesis 1")
  // Regex simple para: [Nombre Libro] [Capítulo](:[Versículo])?
  const refMatch = queryLower.match(/^(.+?)\s+(\d+)(?::(\d+))?$/)
  
  if (refMatch) {
    const bookQuery = refMatch[1]
    const chapter = Number(refMatch[2])
    const verseNum = refMatch[3] ? Number(refMatch[3]) : null
    
    // Buscar el libro por nombre o id
    const book = BIBLE_BOOKS.find(b => 
      b.name.toLowerCase() === bookQuery || 
      b.id.toLowerCase() === bookQuery ||
      b.name.toLowerCase().startsWith(bookQuery)
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
  const bookOnly = BIBLE_BOOKS.find(b => b.name.toLowerCase() === queryLower)
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
  
  return results
}

// Autocompletado de libros - devuelve el libro solo si la búsqueda es suficientemente específica
export function getBookSuggestion(query: string): { id: string; name: string } | null {
  if (!query.trim()) return null
  
  const queryLower = query.toLowerCase()
  
  // Buscar libros que comiencen con la query
  const matches = BIBLE_BOOKS.filter(b => 
    b.name.toLowerCase().startsWith(queryLower)
  )
  
  // Si hay exactamente una coincidencia, devolverla
  if (matches.length === 1) {
    return { id: matches[0].id, name: matches[0].name }
  }
  
  // Si hay múltiples coincidencias, verificar si alguna es una coincidencia exacta de palabra
  // Por ejemplo: "san" coincide con "Santiago" pero no debería coincidir con "Salmos"
  const wordMatches = BIBLE_BOOKS.filter(b => {
    const parts = b.name.toLowerCase().split(' ')
    return parts.some(part => part.startsWith(queryLower))
  })
  
  // Si solo hay una coincidencia de palabra, devolverla
  if (wordMatches.length === 1 && matches.length > 1) {
    return { id: wordMatches[0].id, name: wordMatches[0].name }
  }
  
  return null
}