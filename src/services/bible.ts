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

// Datos locales de ejemplo - Juan 3 (RVR1960)
const BIBLE_DATA: Record<string, Record<number, Array<{verse: number; text: string}>>> = {
  'JHN': {
    3: [
      { verse: 1, text: 'Había un hombre de los fariseos que se llamaba Nicodemo, un principal entre los judíos.' },
      { verse: 2, text: 'Este vino a Jesús de noche, y le dijo: Rabí, sabemos que has venido de Dios como maestro; porque nadie puede hacer estas señales que tú haces, si no está Dios con él.' },
      { verse: 3, text: 'Respondió Jesús y le dijo: De cierto, de cierto te digo, que el que no naciere de nuevo, no puede ver el reino de Dios.' },
      { verse: 4, text: 'Nicodemo le dijo: ¿Cómo puede un hombre nacer siendo viejo? ¿Puede acaso entrar por segunda vez en el vientre de su madre, y nacer?' },
      { verse: 5, text: 'Respondió Jesús: De cierto, de cierto te digo, que el que no naciere de agua y del Espíritu, no puede entrar en el reino de Dios.' },
      { verse: 6, text: 'Lo que es nacido de la carne, carne es; y lo que es nacido del Espíritu, espíritu es.' },
      { verse: 7, text: 'No te maravilles de que te dije: Os es necesario nacer de nuevo.' },
      { verse: 8, text: 'El viento de donde quiere sopla, y oyes su sonido; mas ni sabes de dónde viene, ni a dónde va; así es todo aquel que es nacido del Espíritu.' },
      { verse: 9, text: 'Respondió Nicodemo y le dijo: ¿Cómo puede hacerse esto?' },
      { verse: 10, text: 'Respondió Jesús y le dijo: ¿Eres tú maestro de Israel, y no sabes esto?' },
      { verse: 11, text: 'De cierto, de cierto te digo, que hablamos lo que sabemos, y testificamos lo que hemos visto; y no recibís nuestro testimonio.' },
      { verse: 12, text: 'Si os he dicho cosas terrenales, y no creéis, ¿cómo creeréis si os dijere las celestiales?' },
      { verse: 13, text: 'Y nadie subió al cielo, sino el que descendió del cielo; el Hijo del hombre.' },
      { verse: 14, text: 'Y como Moisés levantó la serpiente en el desierto, así es necesario que el Hijo del hombre sea levantado,' },
      { verse: 15, text: 'para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.' },
      { verse: 16, text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.' },
      { verse: 17, text: 'Porque no envió Dios a su Hijo al mundo para condenar al mundo, sino para que el mundo sea salvo por él.' },
      { verse: 18, text: 'El que en él cree, no es condenado; pero el que no cree, ya ha sido condenado, porque no ha creído en el nombre del unigénito Hijo de Dios.' },
      { verse: 19, text: 'Y esta es la condenación: que la luz vino al mundo, y los hombres amaron más las tinieblas que la luz, porque sus obras eran malas.' },
      { verse: 20, text: 'Porque todo aquel que hace lo malo, aborrece la luz, y no viene a la luz, para que sus obras no sean reprendidas.' },
      { verse: 21, text: 'Mas el que practica la verdad viene a la luz, para que sea manifiesto que sus obras son hechas en Dios.' },
    ]
  }
}

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
        translation: 'RVR1960'
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