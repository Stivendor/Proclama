const fs = require('fs');
const path = require('path');

console.log('🔄 Procesando Biblia RVR1960 completa...');
const rawData = JSON.parse(fs.readFileSync('src/data/bible-raw.json', 'utf8'));

const BIBLE_CONTENT = {};

// Mapeo de USFM a ID amigable
const bookIdMap = {};

rawData.books.forEach((book, bookIdx) => {
  const bookId = book.book_usfm.toLowerCase();
  const bookName = book.name.trim();
  
  bookIdMap[bookId] = bookName;
  BIBLE_CONTENT[bookId] = {};
  
  console.log(`📖 Procesando: ${bookId.padEnd(5)} - ${bookName}`);
  
  book.chapters.forEach((chapter) => {
    // Solo procesar capítulos reales (is_chapter: true)
    if (!chapter.is_chapter) return;
    
    // Extraer número de capítulo del USFM (ej: GEN.1 → 1, GEN.12 → 12)
    const chapterMatch = chapter.chapter_usfm.match(/\.(\d+)$/);
    if (!chapterMatch) return;
    
    const chapterNum = parseInt(chapterMatch[1], 10);
    const verses = [];
    
    // Procesar items del capítulo
    if (chapter.items && Array.isArray(chapter.items)) {
      chapter.items.forEach((item) => {
        if (item.type === 'verse' && item.verse_numbers && item.verse_numbers.length > 0) {
          const verseNum = item.verse_numbers[0];
          const verseText = item.lines ? item.lines.join(' ').trim() : '';
          
          if (verseText) {
            verses.push({
              verse: verseNum,
              text: verseText
            });
          }
        }
      });
    }
    
    // Guardar capítulo si tiene versículos
    if (verses.length > 0) {
      BIBLE_CONTENT[bookId][chapterNum] = verses;
    }
  });
});

// Generar archivo TypeScript
const output = `// Biblia Reina Valera 1960 (RVR1960) - Completa
// Autogenerada desde: https://mrk214.github.io/bible-data-es-spa/
// Total: 66 libros

export const BIBLE_CONTENT: Record<string, Record<number, Array<{verse: number; text: string}>>> = ${JSON.stringify(BIBLE_CONTENT, null, 2)};

export const BIBLE_BOOKS = ${JSON.stringify(Object.entries(bookIdMap).map(([id, name]) => ({ id, name })), null, 2)};
`;

fs.writeFileSync('src/data/bible-content.ts', output, 'utf8');

// Estadísticas
const totalBooks = Object.keys(BIBLE_CONTENT).length;
const totalChapters = Object.values(BIBLE_CONTENT).reduce((sum, book) => sum + Object.keys(book).length, 0);
const totalVerses = Object.values(BIBLE_CONTENT).reduce((sum, book) => {
  return sum + Object.values(book).reduce((chSum, chapter) => chSum + chapter.length, 0);
}, 0);

console.log(`\n✅ Procesamiento completo:`);
console.log(`📚 Total libros: ${totalBooks}`);
console.log(`📖 Total capítulos: ${totalChapters}`);
console.log(`📝 Total versículos: ${totalVerses}`);
console.log(`💾 Archivo guardado: src/data/bible-content.ts`);
