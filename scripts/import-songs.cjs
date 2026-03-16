/**
 * Script para importar canciones desde archivos .txt a Supabase
 * Uso: node scripts/import-songs.cjs [ruta_carpeta_canciones]
 * 
 * Las credenciales se leen de .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

// ─── Leer .env.local ───────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('❌ No se encontró .env.local. Crea el archivo con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf-8')
  const vars = {}
  for (const line of content.split('\n')) {
    const match = line.match(/^([^=]+?)=(.+)$/)
    if (match) vars[match[1].trim()] = match[2].trim()
  }
  return vars
}

const env = loadEnv()

// ─── Configuración ─────────────────────────────────────────────────────────
const SONGS_DIR = process.argv[2] || 'C:\\Users\\Stiven\\Downloads\\letras_canciones\\letras_canciones'
const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY
const BATCH_SIZE = 50

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local')
  process.exit(1)
}

// ─── Parsear nombre de archivo ─────────────────────────────────────────────
function parseFilename(filename) {
  const name = filename.replace(/\.txt$/i, '')
  
  // Patrones: "Título de Artista" o "Título  Artista" (doble espacio)
  const deMatch = name.match(/^(.+?)\s+de\s+(.+)$/i)
  const doubleSpaceMatch = name.match(/^(.+?)\s{2,}(.+)$/)

  if (deMatch) {
    return { title: deMatch[1].trim(), artist: deMatch[2].trim() }
  } else if (doubleSpaceMatch) {
    return { title: doubleSpaceMatch[1].trim(), artist: doubleSpaceMatch[2].trim() }
  }
  return { title: name.trim(), artist: '' }
}

// ─── Parsear contenido del archivo ─────────────────────────────────────────
function parseFileContent(content, filenameTitle, filenameArtist) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  
  // La primera línea suele repetir el título, la salteamos si es así
  let lyricsStart = 0
  const firstLine = lines[0]?.trim() || ''
  
  // Si la primera línea parece ser el título (coincide con el nombre del archivo)
  if (firstLine && (
    firstLine.toLowerCase().includes(filenameTitle.toLowerCase().substring(0, 15)) ||
    firstLine.toLowerCase() === filenameTitle.toLowerCase()
  )) {
    lyricsStart = 1
    // Saltar líneas vacías después del título
    while (lyricsStart < lines.length && lines[lyricsStart].trim() === '') {
      lyricsStart++
    }
  }

  let lyrics = lines.slice(lyricsStart).join('\n').trim()
  
  // Limpiar líneas vacías al final
  lyrics = lyrics.replace(/\n{3,}/g, '\n\n')
  
  // Convertir marcadores de coro //...// a [Coro]
  lyrics = lyrics.replace(/\s*\/\/(.+?)\/\//gs, (_, chorusContent) => {
    return '\n[Coro]\n' + chorusContent.trim() + '\n[Fin Coro]'
  })

  return lyrics
}

// ─── Insertar en Supabase vía REST API ─────────────────────────────────────
function insertBatch(songs) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(songs)
    const url = new URL('/rest/v1/songs', SUPABASE_URL)

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=ignore-duplicates,return=minimal'
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(songs.length)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`))
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎵 Proclama — Importador de canciones')
  console.log('─'.repeat(50))

  const files = fs.readdirSync(SONGS_DIR).filter(f => f.endsWith('.txt'))
  console.log(`📂 Encontrados ${files.length} archivos .txt`)

  const songs = []
  let skipped = 0

  for (const file of files) {
    const { title, artist } = parseFilename(file)
    const filePath = path.join(SONGS_DIR, file)
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lyrics = parseFileContent(content, title, artist)
      
      if (!lyrics || lyrics.length < 10) {
        skipped++
        continue
      }

      songs.push({
        title,
        artist: artist || '',
        lyrics,
        key: '',
        tags: ['Cristiana'],
        language: 'Español',
        source_url: null,
        usage_count: 0
      })
    } catch (err) {
      console.error(`  ⚠️  Error leyendo ${file}: ${err.message}`)
      skipped++
    }
  }

  console.log(`✅ ${songs.length} canciones parseadas, ${skipped} omitidas`)
  console.log('─'.repeat(50))
  console.log('⬆️  Subiendo a Supabase en lotes de', BATCH_SIZE, '...')

  let uploaded = 0
  let errors = 0

  for (let i = 0; i < songs.length; i += BATCH_SIZE) {
    const batch = songs.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(songs.length / BATCH_SIZE)

    try {
      await insertBatch(batch)
      uploaded += batch.length
      const pct = Math.round((uploaded / songs.length) * 100)
      process.stdout.write(`\r  📦 Lote ${batchNum}/${totalBatches} — ${uploaded}/${songs.length} (${pct}%)`)
    } catch (err) {
      errors += batch.length
      console.error(`\n  ❌ Error en lote ${batchNum}: ${err.message}`)
    }
  }

  console.log('\n' + '─'.repeat(50))
  console.log(`🎉 Importación completada!`)
  console.log(`   ✅ Subidas: ${uploaded}`)
  console.log(`   ❌ Errores: ${errors}`)
  console.log(`   ⏭️  Omitidas: ${skipped}`)
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
