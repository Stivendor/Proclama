// API gratuita sin CORS: bible-api.com (dominio público / RVR1960)
// y api.scripture.api.bible para otras versiones

export const BIBLE_BOOKS: { id: string; name: string; chapters: number; testament: 'AT' | 'NT' }[] = [
  // ─── Antiguo Testamento ───
  { id: 'GEN', name: 'Génesis', chapters: 50, testament: 'AT' },
  { id: 'EXO', name: 'Éxodo', chapters: 40, testament: 'AT' },
  { id: 'LEV', name: 'Levítico', chapters: 27, testament: 'AT' },
  { id: 'NUM', name: 'Números', chapters: 36, testament: 'AT' },
  { id: 'DEU', name: 'Deuteronomio', chapters: 34, testament: 'AT' },
  { id: 'JOS', name: 'Josué', chapters: 24, testament: 'AT' },
  { id: 'JDG', name: 'Jueces', chapters: 21, testament: 'AT' },
  { id: 'RUT', name: 'Rut', chapters: 4, testament: 'AT' },
  { id: '1SA', name: '1 Samuel', chapters: 31, testament: 'AT' },
  { id: '2SA', name: '2 Samuel', chapters: 24, testament: 'AT' },
  { id: '1KI', name: '1 Reyes', chapters: 22, testament: 'AT' },
  { id: '2KI', name: '2 Reyes', chapters: 25, testament: 'AT' },
  { id: '1CH', name: '1 Crónicas', chapters: 29, testament: 'AT' },
  { id: '2CH', name: '2 Crónicas', chapters: 36, testament: 'AT' },
  { id: 'EZR', name: 'Esdras', chapters: 10, testament: 'AT' },
  { id: 'NEH', name: 'Nehemías', chapters: 13, testament: 'AT' },
  { id: 'EST', name: 'Ester', chapters: 10, testament: 'AT' },
  { id: 'JOB', name: 'Job', chapters: 42, testament: 'AT' },
  { id: 'PSA', name: 'Salmos', chapters: 150, testament: 'AT' },
  { id: 'PRO', name: 'Proverbios', chapters: 31, testament: 'AT' },
  { id: 'ECC', name: 'Eclesiastés', chapters: 12, testament: 'AT' },
  { id: 'SNG', name: 'Cantares', chapters: 8, testament: 'AT' },
  { id: 'ISA', name: 'Isaías', chapters: 66, testament: 'AT' },
  { id: 'JER', name: 'Jeremías', chapters: 52, testament: 'AT' },
  { id: 'LAM', name: 'Lamentaciones', chapters: 5, testament: 'AT' },
  { id: 'EZK', name: 'Ezequiel', chapters: 48, testament: 'AT' },
  { id: 'DAN', name: 'Daniel', chapters: 12, testament: 'AT' },
  { id: 'HOS', name: 'Oseas', chapters: 14, testament: 'AT' },
  { id: 'JOL', name: 'Joel', chapters: 3, testament: 'AT' },
  { id: 'AMO', name: 'Amós', chapters: 9, testament: 'AT' },
  { id: 'OBA', name: 'Abdías', chapters: 1, testament: 'AT' },
  { id: 'JON', name: 'Jonás', chapters: 4, testament: 'AT' },
  { id: 'MIC', name: 'Miqueas', chapters: 7, testament: 'AT' },
  { id: 'NAM', name: 'Nahúm', chapters: 3, testament: 'AT' },
  { id: 'HAB', name: 'Habacuc', chapters: 3, testament: 'AT' },
  { id: 'ZEP', name: 'Sofonías', chapters: 3, testament: 'AT' },
  { id: 'HAG', name: 'Hageo', chapters: 2, testament: 'AT' },
  { id: 'ZEC', name: 'Zacarías', chapters: 14, testament: 'AT' },
  { id: 'MAL', name: 'Malaquías', chapters: 4, testament: 'AT' },
  // ─── Nuevo Testamento ───
  { id: 'MAT', name: 'Mateo', chapters: 28, testament: 'NT' },
  { id: 'MRK', name: 'Marcos', chapters: 16, testament: 'NT' },
  { id: 'LUK', name: 'Lucas', chapters: 24, testament: 'NT' },
  { id: 'JHN', name: 'Juan', chapters: 21, testament: 'NT' },
  { id: 'ACT', name: 'Hechos', chapters: 28, testament: 'NT' },
  { id: 'ROM', name: 'Romanos', chapters: 16, testament: 'NT' },
  { id: '1CO', name: '1 Corintios', chapters: 16, testament: 'NT' },
  { id: '2CO', name: '2 Corintios', chapters: 13, testament: 'NT' },
  { id: 'GAL', name: 'Gálatas', chapters: 6, testament: 'NT' },
  { id: 'EPH', name: 'Efesios', chapters: 6, testament: 'NT' },
  { id: 'PHP', name: 'Filipenses', chapters: 4, testament: 'NT' },
  { id: 'COL', name: 'Colosenses', chapters: 4, testament: 'NT' },
  { id: '1TH', name: '1 Tesalonicenses', chapters: 5, testament: 'NT' },
  { id: '2TH', name: '2 Tesalonicenses', chapters: 3, testament: 'NT' },
  { id: '1TI', name: '1 Timoteo', chapters: 6, testament: 'NT' },
  { id: '2TI', name: '2 Timoteo', chapters: 4, testament: 'NT' },
  { id: 'TIT', name: 'Tito', chapters: 3, testament: 'NT' },
  { id: 'PHM', name: 'Filemón', chapters: 1, testament: 'NT' },
  { id: 'HEB', name: 'Hebreos', chapters: 13, testament: 'NT' },
  { id: 'JAS', name: 'Santiago', chapters: 5, testament: 'NT' },
  { id: '1PE', name: '1 Pedro', chapters: 5, testament: 'NT' },
  { id: '2PE', name: '2 Pedro', chapters: 3, testament: 'NT' },
  { id: '1JN', name: '1 Juan', chapters: 5, testament: 'NT' },
  { id: '2JN', name: '2 Juan', chapters: 1, testament: 'NT' },
  { id: '3JN', name: '3 Juan', chapters: 1, testament: 'NT' },
  { id: 'JUD', name: 'Judas', chapters: 1, testament: 'NT' },
  { id: 'REV', name: 'Apocalipsis', chapters: 22, testament: 'NT' },
]

export interface BibleVerseResult {
  reference: string
  text: string
  translation: string
}

export interface BibleChapterResult {
  verses: BibleVerseResult[]
}

// bible-api.com — gratuita, sin CORS. Solo soporta RVR1960
// Las demás traducción se ignoran y se usa RVR1960 por defecto
const TRANSLATIONS: Record<string, string> = {
  'RVR1960': '',  // Sin parámetro, es la predeterminada
  'NVI':     '',  // No soportado, usa RVR1960
  'RVA':     '',  // No soportado, usa RVR1960
  'PDT':     '',  // No soportado, usa RVR1960
}

export async function fetchChapter(
  bookId: string,
  chapter: number,
  translation = 'RVR1960'
): Promise<BibleVerseResult[]> {
  try {
    const bookName = BIBLE_BOOKS.find(b => b.id === bookId)?.name ?? bookId
    // bible-api.com solo usa RVR1960, ignoramos el parámetro translation
    const url = `https://bible-api.com/${encodeURIComponent(bookName)}+${chapter}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.verses ?? []).map((v: any) => ({
      reference: `${bookName} ${chapter}:${v.verse}`,
      text: v.text.trim(),
      translation: 'RVR1960'  // Siempre RVR1960
    }))
  } catch {
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
    // bible-api.com solo usa RVR1960, ignoramos el parámetro translation
    const url = `https://bible-api.com/${encodeURIComponent(query)}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    if (data.verses) {
      return data.verses.map((v: any) => ({
        reference: v.book_name ? `${v.book_name} ${v.chapter}:${v.verse}` : data.reference,
        text: v.text.trim(),
        translation: 'RVR1960'  // Siempre RVR1960
      }))
    }
    return []
  } catch {
    return []
  }
}