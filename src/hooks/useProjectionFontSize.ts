import { CANVAS_SIZE } from '@/stores'
import type { ProjectionTheme, Slide } from '@/types'

const SAFE_PADDING_X = 0.08
const SAFE_PADDING_Y = 0.07
const LINE_HEIGHT = 1.15

// Canvas reusable para mediciones (sin insertarlo en el DOM)
let measurementCanvas: HTMLCanvasElement | null = null
function getMeasurementContext() {
  if (!measurementCanvas) measurementCanvas = document.createElement('canvas')
  return measurementCanvas.getContext('2d')
}

/**
 * Calcula el font-size máximo (px) que cabe en el canvas usando la API de Canvas
 * para mediciones exactas segun la fuente, peso y transformaciones (mayúsculas).
 *
 * @param canvasOverride - Dimensiones reales del viewport (para pantallas verticales u otros tamaños).
 *                         Si no se pasa, usa CANVAS_SIZE fijo (1920x1080).
 */
export function calcCanvasFontSize(
  slide: Slide,
  theme: ProjectionTheme,
  songTitle: string,
  isBible: boolean,
  titleAtTop: boolean,
  titleAtBottom: boolean,
  canvasOverride?: { width: number; height: number }
): number {
  const canvas = canvasOverride ?? CANVAS_SIZE
  const availW = canvas.width  * (1 - SAFE_PADDING_X * 2)
  const availH = canvas.height * (1 - SAFE_PADDING_Y * 2)
  // ctx puede ser null en entornos sin DOM o sin soporte de Canvas (ej: vitest sin el paquete canvas)
  const ctx = getMeasurementContext()

  interface Row { text: string; rel: number }
  const rows: Row[] = []

  // Preparar texto (incluyendo transformación a mayúsculas si aplica)
  const prepare = (t: string) => theme.textUppercase ? t.toUpperCase() : t

  // Título solo si es Biblia (es la referencia)
  if (isBible && songTitle && titleAtTop) rows.push({ text: prepare(songTitle), rel: 0.7 })

  // Las etiquetas de verso ([Coro], [Verso 1]) ya no se incluyen en el cálculo
  slide.lines.forEach(line => rows.push({ text: prepare(line), rel: 1 }))

  // Título (cita) abajo si aplica Biblia
  if (isBible && songTitle && titleAtBottom) rows.push({ text: prepare(songTitle), rel: 0.7 })

  if (rows.length === 0) return 72

  // Simulación de Word-wrap
  const fitsAtSize = (fontSize: number): boolean => {
    let totalH = 0
    const charRatioFallback = (theme.fontFamily || '').toLowerCase().includes('mono') ? 0.6 : 0.5

    for (const row of rows) {
      const rowFontSize = fontSize * row.rel
      let visualLines = 1

      if (ctx) {
        // Usamos peso 900 para coincidir con el estilo 'Premium' de la proyección
        ctx.font = `900 ${rowFontSize}px ${theme.fontFamily || 'sans-serif'}`
        const words = row.text.split(' ')
        let currentLineWidth = 0

        for (let i = 0; i < words.length; i++) {
          const word = words[i]
          let wordWidth = ctx.measureText(word).width

          // Medición fallback si ctx.measureText no funciona (ej: en tests)
          if (wordWidth === 0 && word.length > 0) {
            wordWidth = word.length * rowFontSize * charRatioFallback
          }

          const spacingWidth = i > 0 ? (ctx.measureText(' ').width || (rowFontSize * 0.2)) : 0

          if (currentLineWidth + spacingWidth + wordWidth > availW) {
            if (wordWidth > availW) {
              visualLines += Math.ceil(wordWidth / availW)
              currentLineWidth = 0
            } else {
              visualLines++
              currentLineWidth = wordWidth
            }
          } else {
            currentLineWidth += spacingWidth + wordWidth
          }
        }
        totalH += visualLines * rowFontSize * LINE_HEIGHT
      } else {
        // Fallback matemático puro si NO hay context (Legacy approach)
        const charsPerLine = availW / (rowFontSize * charRatioFallback)
        visualLines = charsPerLine > 0 ? Math.ceil(row.text.length / Math.max(1, charsPerLine)) : 1
        totalH += visualLines * rowFontSize * LINE_HEIGHT
      }
    }
    return totalH <= availH
  }

  // Búsqueda binaria del tamaño óptimo
  let lo = 10, hi = Math.min(Math.floor(availH * 0.95), theme.maxFontSize ?? 600), best = lo
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (fitsAtSize(mid)) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return Math.max(10, Math.floor(best * (theme.fontScale ?? 1)))
}