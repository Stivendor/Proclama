import { describe, it, expect } from 'vitest'
import { pairVersesByNumber } from '@/services/bible'
import type { BibleVerseResult } from '@/services/bible'

const v = (ref: string, text: string): BibleVerseResult => ({
  reference: ref, text, translation: 'X', bookId: 'jhn', chapter: 3
})

describe('pairVersesByNumber', () => {
  it('empareja versículos con el mismo número', () => {
    const primary = [v('Juan 3:16', 'Porque de tal manera'), v('Juan 3:17', 'Porque no envió')]
    const secondary = [v('John 3:16', 'For God so loved'), v('John 3:17', 'For God did not send')]
    const rows = pairVersesByNumber(primary, secondary)
    expect(rows).toHaveLength(2)
    expect(rows[0].num).toBe(16)
    expect(rows[0].primary?.text).toBe('Porque de tal manera')
    expect(rows[0].secondary?.text).toBe('For God so loved')
  })

  it('deja secondary undefined cuando falta en la secundaria', () => {
    const primary = [v('Juan 3:16', 'A'), v('Juan 3:17', 'B')]
    const secondary = [v('John 3:16', 'C')]
    const rows = pairVersesByNumber(primary, secondary)
    expect(rows).toHaveLength(2)
    expect(rows[1].num).toBe(17)
    expect(rows[1].primary?.text).toBe('B')
    expect(rows[1].secondary).toBeUndefined()
  })

  it('incluye versículos que solo existen en la secundaria', () => {
    const primary = [v('Juan 3:16', 'A')]
    const secondary = [v('John 3:16', 'C'), v('John 3:17', 'D')]
    const rows = pairVersesByNumber(primary, secondary)
    expect(rows).toHaveLength(2)
    expect(rows[1].num).toBe(17)
    expect(rows[1].primary).toBeUndefined()
    expect(rows[1].secondary?.text).toBe('D')
  })

  it('ordena las filas por número de versículo', () => {
    const primary = [v('Juan 3:2', 'B'), v('Juan 3:1', 'A')]
    const secondary: BibleVerseResult[] = []
    const rows = pairVersesByNumber(primary, secondary)
    expect(rows.map(r => r.num)).toEqual([1, 2])
  })
})
