/**
 * Genera el SQL para sembrar videos de fondo desde Pexels Videos (hotlink, sin bucket propio).
 *
 * Uso:
 *   1. Consigue una API key gratis en https://www.pexels.com/api/new/
 *   2. Agrega PEXELS_API_KEY=... a .env.local  (sin prefijo VITE_: no debe entrar al bundle)
 *   3. node scripts/seed-pexels-videos.mjs
 *   4. Revisa scripts/pexels-videos.generated.sql y aplícalo en Supabase.
 *
 * `node scripts/seed-pexels-videos.mjs --selftest` valida el filtrado sin red ni API key.
 *
 * No escribe en la base: `backgrounds` solo acepta escritura de admin (RLS), así que generar
 * SQL evita traer una service_role key al disco y deja un punto de revisión antes de insertar.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDotEnvLocal } from './supabaseEnv.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_FILE = path.resolve(__dirname, 'pexels-videos.generated.sql')

// Mismo vocabulario de categorías que ya usan las imágenes del catálogo.
// Ojo: `backgrounds.category` tiene un CHECK. Valores permitidos hoy:
// paisajes, biblia, abstracto, bienvenidos, silencio, anuncios, cielo, noche, mar, naturaleza.
const CATEGORIES = {
  abstracto: ['abstract background', 'particles', 'bokeh lights'],
  mar: ['ocean waves', 'sea aerial', 'beach shore', 'underwater'],
  paisajes: ['mountain landscape', 'aerial landscape'],
  naturaleza: ['forest', 'nature'],
  cielo: ['sky clouds timelapse', 'sunset sky'],
  noche: ['night sky stars', 'milky way', 'night city lights'],
}

const PER_CATEGORY = 10
const THUMB_PARAMS = 'auto=compress&cs=tinysrgb&w=400&h=225&fit=crop'
const MAX_WIDTH = 1920 // el 4K de Pexels trae archivos de 100 MB+
// El canvas de proyección es 1920x1080 con object-fit: cover. Por debajo de 720px de alto
// el clip se escala hacia arriba y se recorta demasiado (incluye los cortes "cine" tipo 1366x438).
const MIN_HEIGHT = 720
// Presupuesto de bytes, no de resolución: el fondo se hotlinkea y se ve borroso y oscurecido
// detrás del texto, así que lo que importa es cuánto tarda en arrancar. Medido en una conexión
// de ~5 Mbps, 6 MB ≈ 9 s de espera. Los clips livianos igual se quedan en 1080p.
const MAX_BYTES = 6 * 1024 * 1024
const MIN_DURATION = 8 // segundos: más corto que esto y el loop se nota
const MAX_DURATION = 60

// `node scripts/seed-pexels-videos.mjs --selftest` valida el filtrado sin gastar API key.
if (process.argv.includes('--selftest')) {
  const files = [
    { file_type: 'video/mp4', width: 3840, height: 2160, size: 120_000_000 }, // 4K: fuera por ancho
    { file_type: 'video/mp4', width: 1920, height: 1080, size: 12_000_000 }, // fuera por peso
    { file_type: 'video/mp4', width: 1280, height: 720, size: 5_000_000 }, // el bueno
    { file_type: 'video/quicktime', width: 1920, height: 1080, size: 1_000_000 }, // no MP4
    { file_type: 'video/mp4', width: 1366, height: 438, size: 1_000_000 }, // corte "cine": muy bajo
  ]
  assert.equal(pickFile({ video_files: files }).width, 1280)
  // 1080p liviano gana sobre 720p: el presupuesto es de bytes, no de resolución.
  const liviano = [files[2], { file_type: 'video/mp4', width: 1920, height: 1080, size: 3_000_000 }]
  assert.equal(pickFile({ video_files: liviano }).width, 1920)
  // Nada entra en el presupuesto: se descarta el clip entero, no se cuela un archivo pesado.
  const pesados = [
    { file_type: 'video/mp4', width: 1920, height: 1080, size: 30_000_000 },
    { file_type: 'video/mp4', width: 1280, height: 720, size: 9_000_000 },
    { file_type: 'video/mp4', width: 960, height: 540, size: 2_000_000 }, // liviano pero muy bajo
  ]
  assert.equal(pickFile({ video_files: pesados }), null)
  assert.equal(pickFile({ video_files: [] }), null)
  assert.equal(pickFile({ video_files: [files[0], files[3], files[4]] }), null)
  assert.equal(
    thumbUrl('https://images.pexels.com/videos/1/a.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=120'),
    `https://images.pexels.com/videos/1/a.jpeg?${THUMB_PARAMS}`,
  )
  assert.equal(sqlString("O'Brien"), "'O''Brien'")
  console.log('selftest OK')
  process.exit(0)
}

const apiKey = process.env.PEXELS_API_KEY || readDotEnvLocal().PEXELS_API_KEY
if (!apiKey) {
  console.error('Falta PEXELS_API_KEY en .env.local o en el entorno. Consíguela en https://www.pexels.com/api/new/')
  process.exit(1)
}

async function search(query) {
  const params = new URLSearchParams({
    query,
    orientation: 'landscape',
    size: 'medium', // medium = Full HD; large = 4K
    per_page: '20',
  })
  const res = await fetch(`https://api.pexels.com/videos/search?${params}`, {
    headers: { Authorization: apiKey },
  })
  if (!res.ok) throw new Error(`Pexels ${res.status} en "${query}": ${await res.text()}`)
  const body = await res.json()
  return body.videos ?? []
}

/**
 * El MP4 de mayor resolución que entre en el presupuesto de bytes. null si el clip no tiene
 * ninguna versión proyectable dentro del presupuesto: se descarta y se usa otro clip, porque
 * la búsqueda devuelve más candidatos de los que necesitamos.
 */
function pickFile(video) {
  return (
    (video.video_files ?? [])
      .filter(
        (f) =>
          f.file_type === 'video/mp4' &&
          f.width &&
          f.width <= MAX_WIDTH &&
          f.height >= MIN_HEIGHT &&
          f.size &&
          f.size <= MAX_BYTES,
      )
      .sort((a, b) => b.width - a.width)[0] ?? null
  )
}

/** Normaliza el poster a las mismas dimensiones que usan las miniaturas de imágenes. */
function thumbUrl(image) {
  return `${image.split('?')[0]}?${THUMB_PARAMS}`
}

function sqlString(s) {
  return `'${s.replace(/'/g, "''")}'`
}

const rows = []
const seen = new Set()

for (const [category, queries] of Object.entries(CATEGORIES)) {
  let taken = 0
  for (const query of queries) {
    if (taken >= PER_CATEGORY) break
    const videos = await search(query)
    for (const video of videos) {
      if (taken >= PER_CATEGORY) break
      if (seen.has(video.id)) continue
      if (video.duration < MIN_DURATION || video.duration > MAX_DURATION) continue
      const file = pickFile(video)
      if (!file || !video.image) continue
      seen.add(video.id)
      rows.push({ url: file.link, thumbnail_url: thumbUrl(video.image), category })
      taken++
    }
  }
  console.log(`${category}: ${taken} videos`)
}

if (rows.length === 0) {
  console.error('Pexels no devolvió videos usables. Nada que escribir.')
  process.exit(1)
}

const values = rows
  .map((r) => `  (${sqlString(r.url)}, ${sqlString(r.thumbnail_url)}, 'video', ${sqlString(r.category)})`)
  .join(',\n')

fs.writeFileSync(
  OUT_FILE,
  `-- Generado por scripts/seed-pexels-videos.mjs — ${new Date().toISOString()}\n` +
    `-- ${rows.length} videos de Pexels (hotlink). Requiere el índice único backgrounds_url_key.\n` +
    `insert into public.backgrounds (url, thumbnail_url, type, category) values\n${values}\n` +
    `on conflict (url) do nothing;\n`,
  'utf-8',
)

console.log(`\n${rows.length} videos → ${OUT_FILE}`)
