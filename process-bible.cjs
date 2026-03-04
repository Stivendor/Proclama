#!/usr/bin/env node
// Script para procesar la Biblia JSON raw y convertirla al formato necesario

const fs = require('fs');
const path = require('path');

const inputFile = 'C:\\Users\\salak401\\Desktop\\Proclama\\src\\data\\bible-raw.json';
const outputFile = 'C:\\Users\\salak401\\Desktop\\Proclama\\src\\data\\bible-processed.ts';

console.log('Leyendo archivo JSON...');
const rawData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

console.log('Procesando datos...');
const bibleContent = {};

// Mapear IDs de libros de la fuente a nuestros IDs
const bookIdMap = {
  'GEN': 'GEN', 'EXO': 'EXO', 'LEV': 'LEV', 'NUM': 'NUM', 'DEU': 'DEU',
  'JOS': 'JOS', 'JDG': 'JDG', 'RUT': 'RUT', '1SA': '1SA', '2SA': '2SA',
  '1KI': '1KI', '2KI': '2KI', '1CH': '1CH', '2CH': '2CH', 'EZR': 'EZR',
  'NEH': 'NEH', 'EST': 'EST', 'JOB': 'JOB', 'PSA': 'PSA', 'PRO': 'PRO',
  'ECC': 'ECC', 'SNG': 'SNG', 'ISA': 'ISA', 'JER': 'JER', 'LAM': 'LAM',
  'EZK': 'EZK', 'DAN': 'DAN', 'HOS': 'HOS', 'JOL': 'JOL', 'AMO': 'AMO',
  'OBA': 'OBA', 'JON': 'JON', 'MIC': 'MIC', 'NAM': 'NAM', 'HAB': 'HAB',
  'ZEP': 'ZEP', 'HAG': 'HAG', 'ZEC': 'ZEC', 'MAL': 'MAL', 'MAT': 'MAT',
  'MRK': 'MRK', 'LUK': 'LUK', 'JHN': 'JHN', 'ACT': 'ACT', 'ROM': 'ROM',
  '1CO': '1CO', '2CO': '2CO', 'GAL': 'GAL', 'EPH': 'EPH', 'PHP': 'PHP',
  'COL': 'COL', '1TH': '1TH', '2TH': '2TH', '1TI': '1TI', '2TI': '2TI',
  'TIT': 'TIT', 'PHM': 'PHM', 'HEB': 'HEB', 'JAS': 'JAS', '1PE': '1PE',
  '2PE': '2PE', '1JN': '1JN', '2JN': '2JN', '3JN': '3JN', 'JUD': 'JUD',
  'REV': 'REV'
};

// Procesar cada libro
for (const book of rawData.books) {
  const bookId = book.book_id;
  const normalizedId = bookIdMap[bookId] || bookId;
  
  bibleContent[normalizedId] = {};
  
  // Procesar cada capítulo
  for (const chapter of book.chapters) {
    const chapterNum = chapter.chapter_number;
    bibleContent[normalizedId][chapterNum] = [];
    
    // Procesar cada versículo
    for (const verse of chapter.verses) {
      bibleContent[normalizedId][chapterNum].push({
        verse: verse.verse_number,
        text: verse.text
      });
    }
  }
}

console.log('Generando archivo TypeScript...');

// Generar el contenido TypeScript
let tsContent = `// Base de datos completa de la Biblia RVR1960 (Reina Valera 1960)
// Generado automáticamente desde bible-data-es-spa
// Licencia: MIT

export const BIBLE_CONTENT: Record<string, Record<number, Array<{verse: number; text: string}>>> = ${JSON.stringify(bibleContent, null, 2)}`;

// Escribir el archivo
fs.writeFileSync(outputFile, tsContent, 'utf8');
console.log(`✓ Archivo generado: ${outputFile}`);
console.log(`✓ Total de libros: ${Object.keys(bibleContent).length}`);
console.log('¡Listo!');
