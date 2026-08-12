import { describe, expect, it } from 'vitest'
import { isCompleteNumber, parseChapterVerse } from '@/utils/quickRef'

describe('isCompleteNumber', () => {
  const JUAN = 21

  it('acepta el número que ya no puede crecer', () => {
    expect(isCompleteNumber('3', JUAN)).toBe(true)
    expect(isCompleteNumber('21', JUAN)).toBe(true)
  })

  it('espera si el número todavía puede crecer', () => {
    expect(isCompleteNumber('1', JUAN)).toBe(false)
    expect(isCompleteNumber('2', JUAN)).toBe(false)
  })

  it('rechaza fuera de rango y basura', () => {
    expect(isCompleteNumber('22', JUAN)).toBe(false)
    expect(isCompleteNumber('0', JUAN)).toBe(false)
    expect(isCompleteNumber('', JUAN)).toBe(false)
    expect(isCompleteNumber('3a', JUAN)).toBe(false)
    expect(isCompleteNumber('3', 0)).toBe(false)
  })

  it('en Salmos casi nada es único', () => {
    expect(isCompleteNumber('1', 150)).toBe(false)
    expect(isCompleteNumber('15', 150)).toBe(false)
    expect(isCompleteNumber('16', 150)).toBe(true)
    expect(isCompleteNumber('150', 150)).toBe(true)
  })
})

describe('parseChapterVerse', () => {
  it('reparte capítulo y versículo', () => {
    expect(parseChapterVerse('3:16')).toEqual({ chapter: '3', verse: '16' })
    expect(parseChapterVerse('3 16')).toEqual({ chapter: '3', verse: '16' })
    expect(parseChapterVerse(' 3 : 16 ')).toEqual({ chapter: '3', verse: '16' })
  })

  it('deja el versículo vacío si solo hay capítulo', () => {
    expect(parseChapterVerse('3')).toEqual({ chapter: '3', verse: '' })
  })

  it('devuelve vacío si no hay números', () => {
    expect(parseChapterVerse('juan')).toEqual({ chapter: '', verse: '' })
    expect(parseChapterVerse('')).toEqual({ chapter: '', verse: '' })
  })
})
