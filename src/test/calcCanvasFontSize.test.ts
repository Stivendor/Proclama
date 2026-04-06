import { describe, it, expect } from 'vitest'
import { calcCanvasFontSize } from '@/hooks/useProjectionFontSize'
import type { Slide } from '@/types'
import type { ProjectionTheme } from '@/types'

const baseTheme: ProjectionTheme = {
  background: '#000',
  fontFamily: 'Lora, Georgia, serif',
  fontSize: 72,
  textColor: '#fff',
  textShadow: true,
  transition: 'fade',
  showTitle: false,
  showVerseLabel: false,
  backgroundType: 'color',
}

const makeSlide = (lines: string[], label = ''): Slide => ({
  index: 0,
  label,
  lines,
})

describe('calcCanvasFontSize', () => {
  it('retorna un número positivo mayor a 10', () => {
    const slide = makeSlide(['Santo es el Señor', 'Digno de alabar'])
    const size = calcCanvasFontSize(slide, baseTheme, '', false, false, false)
    expect(size).toBeGreaterThan(10)
  })

  it('texto más corto produce font-size mayor', () => {
    const short = makeSlide(['Aleluya'])
    const long = makeSlide(['Este es un versículo muy largo que tiene muchas palabras y ocupa bastante espacio en la pantalla'])
    const sizeShort = calcCanvasFontSize(short, baseTheme, '', false, false, false)
    const sizeLong = calcCanvasFontSize(long, baseTheme, '', false, false, false)
    expect(sizeShort).toBeGreaterThan(sizeLong)
  })

  it('más líneas produce font-size menor', () => {
    const few = makeSlide(['Línea uno', 'Línea dos'])
    const many = makeSlide(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'])
    const sizeFew = calcCanvasFontSize(few, baseTheme, '', false, false, false)
    const sizeMany = calcCanvasFontSize(many, baseTheme, '', false, false, false)
    expect(sizeFew).toBeGreaterThan(sizeMany)
  })

  it('respeta maxFontSize del tema', () => {
    const slide = makeSlide(['Hola'])
    const themeWithCap = { ...baseTheme, maxFontSize: 100 }
    const size = calcCanvasFontSize(slide, themeWithCap, '', false, false, false)
    expect(size).toBeLessThanOrEqual(100)
  })

  it('fontScale 0.5 produce aproximadamente la mitad del tamaño base', () => {
    const slide = makeSlide(['Santa es la tierra'])
    const full = calcCanvasFontSize(slide, baseTheme, '', false, false, false)
    const themeHalf = { ...baseTheme, fontScale: 0.5 }
    const half = calcCanvasFontSize(slide, themeHalf, '', false, false, false)
    // Tolerancia de ±2px por redondeo de Math.round
    expect(half).toBeGreaterThanOrEqual(Math.floor(full * 0.5) - 2)
    expect(half).toBeLessThanOrEqual(Math.ceil(full * 0.5) + 2)
  })


  it('versículo largo (biblia) no devuelve 10 (mínimo)', () => {
    const longVerse = makeSlide([
      'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.'
    ])
    const size = calcCanvasFontSize(longVerse, baseTheme, 'Juan 3:16', true, true, false)
    expect(size).toBeGreaterThan(10)
  })

  it('incluir título reduce el font-size del contenido', () => {
    const slide = makeSlide(['Aleluya', 'Gloria'])
    const withoutTitle = calcCanvasFontSize(slide, baseTheme, 'Mi Canción', false, false, false)
    const withTitle = calcCanvasFontSize(slide, { ...baseTheme, showTitle: true }, 'Mi Canción', false, true, false)
    expect(withoutTitle).toBeGreaterThanOrEqual(withTitle)
  })

  it('fuente monospace usa charRatio mayor (texto más ancho)', () => {
    const slide = makeSlide(['Texto de prueba para medir'])
    const serif = calcCanvasFontSize(slide, { ...baseTheme, fontFamily: 'Georgia, serif' }, '', false, false, false)
    const mono = calcCanvasFontSize(slide, { ...baseTheme, fontFamily: 'Courier New, monospace' }, '', false, false, false)
    // Monospace es más ancho por carácter → font-size menor
    expect(mono).toBeLessThanOrEqual(serif)
  })

  it('slide vacío (sin líneas) retorna 72 como fallback', () => {
    const emptySlide = makeSlide([])
    const size = calcCanvasFontSize(emptySlide, baseTheme, '', false, false, false)
    expect(size).toBe(72)
  })
})
