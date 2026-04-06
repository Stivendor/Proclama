import { createClient } from '@supabase/supabase-js'
import { test, expect } from 'vitest'

const VITE_SUPABASE_URL = "***REMOVED***"
const VITE_SUPABASE_ANON_KEY = "***REMOVED***"

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

const LABEL_REGEX = /^\[?(coro|chorus|chorous|verse|verso|v\d+|estrofa|puente|bridge|intro|outro|instrumental|fin|final|solista|todos|hizo|sube|repite|repetir|x\d+)(\s+\d+)?\]?:?\s*$/gim;

test('DRY RUN: Lyrics Cleanup Validation', async () => {
  // Buscamos 10 canciones que contengan la palabra 'Coro' en sus letras para probar el regex
  const { data: songs, error } = await supabase
    .from('songs')
    .select('id, title, lyrics')
    .ilike('lyrics', '%Coro%')
    .limit(10)
  
  if (error) {
    throw error
  }

  console.log(`\n\n=== RESULTADOS DEL DRY RUN (PRUEBA) ===\n`)
  console.log(`Se han encontrado ${songs?.length} canciones para la prueba.\n`)

  for (const song of songs || []) {
    if (!song.lyrics) continue
    
    const lines = song.lyrics.split('\n')
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim()
      // Si la línea está vacía o coincide con el regex de etiquetas, la quitamos
      return trimmed !== '' && !trimmed.match(LABEL_REGEX)
    })
    
    const cleanedLyrics = cleanedLines.join('\n').trim()
    
    console.log(`--- CANCIÓN: ${song.title.toUpperCase()} (ID: ${song.id}) ---`)
    console.log("MUESTRA ANTES (Primeras 4 líneas):")
    console.log(lines.slice(0, 4).join('\n'))
    console.log("\nMUESTRA DESPUÉS (Limpia):")
    console.log(cleanedLines.slice(0, 4).join('\n'))
    console.log("...........................................\n")
  }
  
  console.log(`=== FIN DEL DRY RUN ===\n\n`)
  expect(songs?.length).toBeGreaterThan(0)
}, 20000)
