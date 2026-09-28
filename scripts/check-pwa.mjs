/**
 * Guard de build: comprueba que toda URL que el service worker precachea exista
 * de verdad en dist/.
 *
 * Si una URL precacheada devuelve 404, workbox lanza `bad-precaching-response`
 * y la instalación del SW falla: queda en `redundant`, nunca llega a `installed`,
 * y en consecuencia `useSWUpdate` nunca activa el botón "Actualizar app".
 * El SW anterior sigue sirviendo assets viejos, así que la app "funciona"
 * pero queda desactualizada sin ningún síntoma visible.
 *
 * Uso:
 *   node scripts/check-pwa.mjs [directorio]   # por defecto: dist
 *
 * Sale con código distinto de cero si falta algo, para romper el build en CI/Vercel.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '..', process.argv[2] ?? 'dist')
const swFile = path.join(distDir, 'sw.js')

const fail = (message) => {
  console.error(`[check-pwa] ${message}`)
  process.exit(1)
}

if (!fs.existsSync(swFile)) fail(`no se encontró ${swFile}`)

const source = fs.readFileSync(swFile, 'utf8')

// generateSW inyecta `precacheAndRoute([{url:"...",revision:"..."}, ...])`.
const urls = [...source.matchAll(/\{\s*url:\s*"([^"]+)"/g)].map((match) => match[1])

if (urls.length === 0) {
  fail('sw.js no contiene entradas de precaché; ¿cambió el formato del worker generado?')
}

const missing = []
for (const raw of urls) {
  if (/^https?:\/\//.test(raw)) continue // runtime caching / cross-origin
  const rel = decodeURIComponent(raw.split('?')[0]).replace(/^\/+/, '')
  if (!fs.existsSync(path.join(distDir, rel))) missing.push(raw)
}

if (missing.length > 0) {
  console.error(`[check-pwa] ${missing.length} URL(s) precacheada(s) sin archivo en ${distDir}:`)
  for (const url of missing) console.error(`  - ${url}`)
  console.error('[check-pwa] El service worker fallaría al instalar y la app no ofrecería "Actualizar app".')
  process.exit(1)
}

console.log(
  `[check-pwa] ok: ${urls.length} entradas de precaché presentes en ${path.relative(process.cwd(), distDir) || '.'}`
)
