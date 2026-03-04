// Script para validar la integridad de los datos de la Biblia
const fs = require('fs');
const path = require('path');

console.log('📊 Validando datos de la Biblia RVR1960...\n');

// Leer el contenido del archivo
const bibleContentPath = path.join(__dirname, 'src', 'data', 'bible-content.ts');
const content = fs.readFileSync(bibleContentPath, 'utf8');

// Contar libros (objetos con claves de 2-4 caracteres)
const bookMatches = content.match(/"([a-z0-9]+)":\s*\{/g);
const bibleBookCount = bookMatches ? bookMatches.length - 1 : 0; // -1 por BIBLE_BOOKS

// Contar versículos
const verseMatches = content.match(/"verse":\s*\d+/g);
const verseCount = verseMatches ? verseMatches.length : 0;

// Verificar libros específicos que se reportaron como faltantes
console.log('✅ Resumen de datos:');
console.log(`   Libros: ${bibleBookCount}`);
console.log(`   Versículos: ${verseCount}`);

// Comprobar libros específicos
const librosAChecar = ['santiago', 'eclesiastes', 'juan', 'mateo'];
librosAChecar.forEach(libro => {
  if (content.includes(`"${libro.substring(0, 3)}"`)) {
    console.log(`   ✓ ${libro} encontrado`);
  } else {
    console.log(`   ✗ ${libro} NO encontrado`);
  }
});

console.log(`\n💾 Tamaño del archivo: ${(fs.statSync(bibleContentPath).size / 1024 / 1024).toFixed(2)} MB`);
console.log('\n✨ Validación completada.');
