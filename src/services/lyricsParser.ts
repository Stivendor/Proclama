import type { Slide } from '@/types'

/**
 * Convierte el texto crudo de letra en array de Slides para proyección.
 * Formato soportado:
 *   - Estrofas separadas por una o más líneas en blanco
 *   - Etiquetas opcionales: [Coro], [Verso 1], [Puente], etc.
 *   - Máximo `linesPerSlide` líneas por slide (divide automáticamente estrofas largas)
 */
export function parseLyrics(lyrics: string, linesPerSlide = 4): Slide[] {
  const slides: Slide[] = []
  let slideIndex = 0

  // Dividir en bloques por líneas en blanco y filtrar bloques basura (solo puntos o vacíos)
  const blocks = lyrics.split(/\n{2,}/)
    .map(b => b.trim())
    .filter(b => b && b !== '.')

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)

    // Detectar etiqueta de sección al inicio
    let label = ''
    let contentLines = lines
    const labelMatch = lines[0]?.match(/^\[(.+)\]$/)
    if (labelMatch) {
      label = lines[0]
      contentLines = lines.slice(1)
    }

    if (contentLines.length === 0) continue

    // Dividir en sub-slides si tiene más líneas que el máximo
    for (let i = 0; i < contentLines.length; i += linesPerSlide) {
      const chunk = contentLines.slice(i, i + linesPerSlide)
      slides.push({
        index: slideIndex++,
        label: i === 0 ? label : '',
        lines: chunk
      })
    }
  }

  return slides
}

/**
 * Extrae texto plano de slides para búsqueda
 */
export function slidesToText(slides: Slide[]): string {
  return slides.map(s => s.lines.join(' ')).join(' ')
}

/**
 * Limpia texto de letras importadas de internet
 * (elimina créditos, acordes, marcas de agua, etc.)
 */
export function cleanLyricsText(raw: string): string {
  return raw
    .replace(/\[([A-G][#b]?(?:m|maj|min|sus|dim|aug)?(?:\d+)?(?:\/[A-G][#b]?)?)\]/g, '') // acordes
    .replace(/^\s*\d+\s*$/gm, '')           // números de línea solitarios
    .replace(/^Embed$/gim, '')              // Genius watermark
    .replace(/^\d+Contributors.*$/gim, '')  // Genius contributors
    .replace(/^\s*\.\s*$/gm, '')           // Eliminar líneas que son solo un punto
    .replace(/\n{3,}/g, '\n\n')             // Múltiples líneas en blanco -> doble
    .trim()
}
