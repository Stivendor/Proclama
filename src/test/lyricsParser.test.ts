import { describe, it, expect } from 'vitest'
import { parseLyrics, slidesToText, cleanLyricsText } from '@/services/lyricsParser'

describe('parseLyrics', () => {
  it('divide estrofas separadas por línea en blanco', () => {
    const lyrics = `Línea uno\nLínea dos\n\nLínea tres\nLínea cuatro`
    const slides = parseLyrics(lyrics)
    expect(slides).toHaveLength(2)
    expect(slides[0].lines).toEqual(['Línea uno', 'Línea dos'])
    expect(slides[1].lines).toEqual(['Línea tres', 'Línea cuatro'])
  })

  it('detecta etiquetas de sección [Coro], [Verso 1], etc.', () => {
    const lyrics = `[Coro]\nSanta es la tierra\nSanto es el cielo`
    const slides = parseLyrics(lyrics)
    expect(slides[0].label).toBe('[Coro]')
    expect(slides[0].lines).toEqual(['Santa es la tierra', 'Santo es el cielo'])
  })

  it('divide estrofas largas en sub-slides de máximo linesPerSlide líneas', () => {
    const lyrics = `L1\nL2\nL3\nL4\nL5\nL6`
    const slides = parseLyrics(lyrics, 4)
    expect(slides).toHaveLength(2)
    expect(slides[0].lines).toHaveLength(4)
    expect(slides[1].lines).toHaveLength(2)
  })

  it('solo la primera sub-slide hereda la etiqueta', () => {
    const lyrics = `[Verso 1]\nL1\nL2\nL3\nL4\nL5`
    const slides = parseLyrics(lyrics, 4)
    expect(slides[0].label).toBe('[Verso 1]')
    expect(slides[1].label).toBe('')
  })

  it('asigna índices secuenciales', () => {
    const lyrics = `A\nB\n\nC\nD\n\nE\nF`
    const slides = parseLyrics(lyrics)
    expect(slides.map(s => s.index)).toEqual([0, 1, 2])
  })

  it('ignora bloques vacíos', () => {
    const lyrics = `\n\nA\nB\n\n\n\nC\nD\n\n`
    const slides = parseLyrics(lyrics)
    expect(slides).toHaveLength(2)
  })

  it('retorna array vacío para letra vacía', () => {
    expect(parseLyrics('')).toEqual([])
    expect(parseLyrics('   \n\n   ')).toEqual([])
  })

  it('maneja etiqueta sin contenido (la ignora)', () => {
    const lyrics = `[Intro]\n\nA\nB`
    const slides = parseLyrics(lyrics)
    // [Intro] sin líneas de contenido se ignora
    expect(slides).toHaveLength(1)
    expect(slides[0].lines).toEqual(['A', 'B'])
  })

  it('respeta linesPerSlide personalizado', () => {
    const lyrics = `L1\nL2\nL3`
    const slides = parseLyrics(lyrics, 2)
    expect(slides).toHaveLength(2)
    expect(slides[0].lines).toEqual(['L1', 'L2'])
    expect(slides[1].lines).toEqual(['L3'])
  })
})

describe('slidesToText', () => {
  it('concatena todas las líneas de todos los slides', () => {
    const slides = parseLyrics('A\nB\n\nC\nD')
    expect(slidesToText(slides)).toBe('A B C D')
  })

  it('retorna string vacío para slides vacíos', () => {
    expect(slidesToText([])).toBe('')
  })
})

describe('cleanLyricsText', () => {
  it('elimina acordes entre corchetes', () => {
    const raw = '[Am]Santa es la [F]tierra'
    expect(cleanLyricsText(raw)).toBe('Santa es la tierra')
  })

  it('elimina watermark "Embed" de Genius', () => {
    const raw = 'Letra de canción\nEmbed'
    expect(cleanLyricsText(raw)).not.toContain('Embed')
  })

  it('elimina línea de contributors de Genius', () => {
    const raw = 'Letra\n3ContributorsSanta es la tierra Lyrics'
    expect(cleanLyricsText(raw)).not.toContain('Contributors')
  })

  it('colapsa múltiples líneas en blanco a doble salto', () => {
    const raw = 'A\n\n\n\nB'
    expect(cleanLyricsText(raw)).toBe('A\n\nB')
  })

  it('elimina números de línea solitarios', () => {
    const raw = '1\nLetra\n2\nMás letra'
    const result = cleanLyricsText(raw)
    expect(result).not.toMatch(/^\d+$/m)
  })
})
