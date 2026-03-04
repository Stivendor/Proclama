// Script para extraer y verificar IDs de libros
const fs = require('fs');

const content = fs.readFileSync('src/data/bible-content.ts', 'utf8');

// Buscar la sección BIBLE_CONTENT
const startIdx = content.indexOf('export const BIBLE_CONTENT');
const endIdx = content.indexOf('export const BIBLE_BOOKS');
const bibleSection = content.substring(startIdx, endIdx);

// Extraer IDs unicos
const idMatches = bibleSection.match(/"([a-z0-9]{2,4})":\s*\{/g);
const ids = [...new Set(idMatches.map(m => m.match(/"([a-z0-9]{2,4})"/)[1]))].sort();

console.log('IDs de libros encontrados:', ids.length);
console.log('IDs:', ids.join(', '));

// Buscar específicamente
console.log('\nBúsqueda específica:');
console.log('jas (Santiago):', content.includes('"jas":'));
console.log('ecc (Eclesiastés):', content.includes('"ecc":'));
console.log('jhn (Juan):', content.includes('"jhn":'));
console.log('mat (Mateo):', content.includes('"mat":'));

// Contar versículos por libro
console.log('\nVersículos por libro (muestra):');
ids.slice(0, 5).forEach(id => {
  const regex = new RegExp(`"${id}":\\s*\\{([^}]*)"verse"`, 'g');
  const matches = bibleSection.match(regex);
  const count = matches ? matches.length : 0;
  console.log(`${id}: ${count} capítulos`);
});
