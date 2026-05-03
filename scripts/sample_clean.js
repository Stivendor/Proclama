import { createClient } from '@supabase/supabase-js'
import { loadSupabaseEnv } from './supabaseEnv.js'

const { supabaseUrl, supabaseAnonKey } = loadSupabaseEnv()
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const LABEL_REGEX = /^\[?(fin(?:\s+del?)?\s+)?(coro|chorus|chorous|verse|verso|v\d+|estrofa|puente|bridge|intro|outro|instrumental|fin|final|solista|todos|hizo|sube|repite|repetir|x\d+)(\s+\d+)?\]?:?\s*$/gim;

async function run() {
  const { data: songs, error } = await supabase
    .from('songs')
    .select('id, title, lyrics')
    .ilike('lyrics', '%Coro%')
    .limit(5)
  
  if (error) {
    console.error(error)
    process.exit(1)
  }

  console.log(`\n=== MUESTRA DE LIMPIEZA (5 CANCIONES) ===\n`)
  for (const song of songs || []) {
    const lines = (song.lyrics || '').split('\n')
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim()
      return trimmed !== '' && !trimmed.match(LABEL_REGEX)
    })
    
    console.log(`TITULO: ${song.title.toUpperCase()}`)
    console.log("--- ANTES (Primeras 3 líneas) ---")
    console.log(lines.slice(0, 3).join('\n') || "(vacio)")
    console.log("--- DESPUÉS (Primeras 3 líneas) ---")
    console.log(cleanedLines.slice(0, 3).join('\n') || "(vacio)")
    console.log("-----------------------------------\n")
  }
}

run()
