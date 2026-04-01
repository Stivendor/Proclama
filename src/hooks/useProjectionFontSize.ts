import { CANVAS_SIZES } from '@/stores'
import type { ProjectionTheme, Slide } from '@/types'
import type { AspectRatio } from '@/stores'

const SAFE_PADDING_X = 0.06
const SAFE_PADDING_Y = 0.05
const LINE_HEIGHT = 1.3

/**
 * Calcula el font-size maximo (px) que cabe en el canvas fijo.
 * Calculo matematico puro - sin DOM, sin viewport.
 *
 * Para textos largos (biblia) estima el word-wrap: calcula cuantas lineas visuales
 * produce cada fila segun el ancho disponible, luego verifica que todo quepa en alto.
 */
export function calcCanvasFontSize(
  slide: Slide,
  theme: ProjectionTheme,
  songTitle: string,
  isBible: boolean,
  titleAtTop: boolean,
  titleAtBottom: boolean,
  aspectRatio: AspectRatio = '16:9',
  fontScale: number = 1.0  // 1.0 = auto-máximo, <1 reduce, >1 aumenta (con cap)
): number {
  const canvas = CANVAS_SIZES[aspectRatio]
  const availW = canvas.width  * (1 - SAFE_PADDING_X * 2)
  const availH = canvas.height * (1 - SAFE_PADDING_Y * 2)

  const f = (theme.fontFamily ?? '').toLowerCase()
  const charRatio = f.includes('mono') || f.includes('courier') ? 0.62
    : f.includes('condensed') || f.includes('narrow') ? 0.44
    : f.includes('serif') ? 0.52
    : 0.50

  interface Row { text: string; rel: number }
  const rows: Row[] = []
  if (titleAtTop)   rows.push({ text: songTitle, rel: isBible ? 1 : 0.35 })
  if (theme.showVerseLabel && slide.label) rows.push({ text: slide.label, rel: 0.4 })
  slide.lines.forEach(line => rows.push({ text: line, rel: 1 }))
  if (titleAtBottom) rows.push({ text: songTitle, rel: isBible ? 1 : 0.35 })

  if (rows.length === 0) return 72

  // Para cada fontSize candidato, calcula cuantas lineas visuales produce el word-wrap
  // y verifica que la altura total quepa en availH
  const fitsAtSize = (fontSize: number): boolean => {
    let totalH = 0
    for (const row of rows) {
      const rowFontSize = fontSize * row.rel
      const charsPerLine = availW / (rowFontSize * charRatio)
      const visualLines = charsPerLine > 0 ? Math.ceil(row.text.length / Math.max(1, charsPerLine)) : 1
      totalH += visualLines * rowFontSize * LINE_HEIGHT
    }
    return totalH <= availH
  }

  let lo = 10, hi = Math.min(Math.floor(availH * 0.95), theme.maxFontSize ?? 600), best = lo
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (fitsAtSize(mid)) { best = mid; lo = mid + 1 }
    else hi = mid - 1
  }

  return Math.max(10, Math.round(best * fontScale))
}
