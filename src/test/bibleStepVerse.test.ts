import { describe, expect, it } from 'vitest'
import { planVerseStep } from '@/utils/verseStep'

const base = { verseCount: 36, chapter: 3, chapterCount: 21, dir: 1 as 1 | -1 }

describe('planVerseStep', () => {
  it('avanza dentro del capítulo', () => {
    expect(planVerseStep({ ...base, currentIndex: 15 })).toEqual({ kind: 'same-chapter', index: 16 })
  })

  it('retrocede dentro del capítulo', () => {
    expect(planVerseStep({ ...base, currentIndex: 15, dir: -1 })).toEqual({ kind: 'same-chapter', index: 14 })
  })

  it('pasa al primer versículo del capítulo siguiente', () => {
    expect(planVerseStep({ ...base, currentIndex: 35 })).toEqual({
      kind: 'other-chapter', chapter: 4, edge: 'first',
    })
  })

  it('pasa al último versículo del capítulo anterior', () => {
    expect(planVerseStep({ ...base, currentIndex: 0, dir: -1 })).toEqual({
      kind: 'other-chapter', chapter: 2, edge: 'last',
    })
  })

  it('no salta de libro al final', () => {
    expect(planVerseStep({ ...base, currentIndex: 35, chapter: 21 })).toEqual({ kind: 'none' })
  })

  it('no salta de libro al principio', () => {
    expect(planVerseStep({ ...base, currentIndex: 0, chapter: 1, dir: -1 })).toEqual({ kind: 'none' })
  })

  it('no hace nada si no ubicó el versículo proyectado', () => {
    expect(planVerseStep({ ...base, currentIndex: -1 })).toEqual({ kind: 'none' })
  })
})
