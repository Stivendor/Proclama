import { createClient } from '@supabase/supabase-js'

const VITE_SUPABASE_URL = "https://ydyozanakkzpgldqcdjj.supabase.co"
const VITE_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkeW96YW5ha2t6cGdsZHFjZGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDc2MDQsImV4cCI6MjA4ODkyMzYwNH0.NOqg2V7TrErhuEKV1w_pKNfsbl1qYTpaz7GB_ROk66w"

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

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
