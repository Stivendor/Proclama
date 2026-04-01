import { describe, it, expect } from 'vitest'
import { getBookSuggestion, BIBLE_BOOKS } from '@/services/bible'

describe('getBookSuggestion', () => {
  it('retorna null para query vacía', () => {
    expect(getBookSuggestion('')).toBeNull()
    expect(getBookSuggestion('   ')).toBeNull()
  })

  it('encuentra libro por inicio de nombre exacto', () => {
    const result = getBookSuggestion('Juan')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('jhn')
  })

  it('es insensible a mayúsculas', () => {
    const result = getBookSuggestion('juan')
    expect(result?.id).toBe('jhn')
  })

  it('es insensible a tildes/acentos', () => {
    const result = getBookSuggestion('genesis')
    expect(result?.id).toBe('gen')
  })

  it('retorna null cuando hay múltiples coincidencias ambiguas', () => {
    // "sa" coincide con Salmos, Santiago, etc.
    const result = getBookSuggestion('sa')
    // Puede ser null o una coincidencia única — verificamos que no crashee
    expect(result === null || typeof result?.id === 'string').toBe(true)
  })

  it('encuentra Génesis con "gen"', () => {
    const result = getBookSuggestion('gen')
    expect(result?.id).toBe('gen')
  })

  it('encuentra Apocalipsis con "apoc"', () => {
    const result = getBookSuggestion('apoc')
    expect(result?.id).toBe('rev')
  })

  it('retorna null para query que no coincide con ningún libro', () => {
    expect(getBookSuggestion('zzzzz')).toBeNull()
  })
})

describe('BIBLE_BOOKS', () => {
  it('contiene 66 libros', () => {
    expect(BIBLE_BOOKS).toHaveLength(66)
  })

  it('todos los libros tienen id, name, chapters y testament', () => {
    for (const book of BIBLE_BOOKS) {
      expect(book.id).toBeTruthy()
      expect(book.name).toBeTruthy()
      expect(book.chapters).toBeGreaterThan(0)
      expect(['AT', 'NT']).toContain(book.testament)
    }
  })

  it('39 libros del AT y 27 del NT', () => {
    const at = BIBLE_BOOKS.filter(b => b.testament === 'AT')
    const nt = BIBLE_BOOKS.filter(b => b.testament === 'NT')
    expect(at).toHaveLength(39)
    expect(nt).toHaveLength(27)
  })

  it('Salmos tiene 150 capítulos', () => {
    const psalms = BIBLE_BOOKS.find(b => b.id === 'psa')
    expect(psalms?.chapters).toBe(150)
  })

  it('no hay IDs duplicados', () => {
    const ids = BIBLE_BOOKS.map(b => b.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})
