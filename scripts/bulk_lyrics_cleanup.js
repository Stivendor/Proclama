import { createClient } from '@supabase/supabase-js'
import { loadSupabaseEnv } from './supabaseEnv.js'

const { supabaseUrl, supabaseAnonKey } = loadSupabaseEnv()
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const LABEL_REGEX = /^\[?(fin(?:\s+del?)?\s+)?(coro|chorus|chorous|verse|verso|v\d+|estrofa|puente|bridge|intro|outro|instrumental|fin|final|solista|todos|hizo|sube|repite|repetir|x\d+)(\s+\d+)?\]?:?\s*$/gim;

async function bulkCleanup() {
  console.log("🚀 Iniciando limpieza masiva de canciones...")
  let totalSongs = 0
  let updatedSongsCount = 0
  let from = 0
  const limit = 1000

  // 1. Descargar catálogo completo por páginas
  while (true) {
    console.log(`\n📦 Descargando canciones (desde: ${from})...`)
    const { data: songs, error } = await supabase
      .from('songs')
      .select('id, lyrics')
      .range(from, from + limit - 1)
      .order('id', { ascending: true })

    if (error) {
      console.error("❌ Error descandando canciones:", error)
      break
    }
    if (!songs || songs.length === 0) break

    totalSongs += songs.length
    const updates = []

    // 2. Procesar canciones de esta página
    for (const song of songs) {
      if (!song.lyrics) continue
      
      const originalLyrics = song.lyrics
      const lines = originalLyrics.split('\n')
      const cleanedLines = lines.filter(line => {
        const trimmed = line.trim()
        return trimmed !== '' && !trimmed.match(LABEL_REGEX)
      })
      
      const cleanedLyrics = cleanedLines.join('\n').trim()
      
      // Solo actualizar si hubo cambios
      if (cleanedLyrics !== originalLyrics.trim()) {
        updates.push({
          id: song.id,
          lyrics: cleanedLyrics
        })
      }
    }

    // 3. Subir actualizaciones en sub-lotes de 200
    if (updates.length > 0) {
      console.log(`🛠️ Procesando ${updates.length} actualizaciones en lotes...`)
      const batchSize = 200
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize)
        const { error: updateError } = await supabase
          .from('songs')
          .upsert(batch)

        if (updateError) {
          console.error(`❌ Error actualizando lote ${i}:`, updateError.message)
        } else {
          updatedSongsCount += batch.length
          console.log(`✅ Lote ${i/batchSize + 1} completado (${updatedSongsCount}/${totalSongs} procesados)`)
        }
      }
    } else {
      console.log("✨ No se encontraron etiquetas en esta página.")
    }

    if (songs.length < limit) break
    from += limit
  }

  console.log("\n==========================================")
  console.log(`🎉 LIMPIEZA FINALIZADA`)
  console.log(`- Canciones analizadas: ${totalSongs}`)
  console.log(`- Canciones modificadas: ${updatedSongsCount}`)
  console.log("==========================================\n")
}

bulkCleanup().catch(err => {
  console.error("❌ Error Fatal durante la ejecución:", err)
  process.exit(1)
})
