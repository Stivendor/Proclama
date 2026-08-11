import { describe, it, expect, vi, beforeAll } from 'vitest'
import { searchGlobal } from '@/services/bible'

// La búsqueda por texto no debe exigir tildes, mayúsculas ni puntuación.
// El paso 4 (Bolls Life) sale a red cuando hay pocos resultados: se corta aquí
// para que la prueba mida sólo el match local.
beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => [] })))
})

const refs = (results: { reference: string }[]) => results.map(r => r.reference)

describe('searchGlobal – búsqueda por texto insensible a tildes/mayúsculas/puntuación', () => {
  it('encuentra "De tal manera amó Dios" escrito sin tildes ni mayúsculas', async () => {
    const results = await searchGlobal('de tal manera amo dios')
    expect(refs(results)).toContain('Juan 3:16')
  })

  it('encuentra el mismo versículo con MAYÚSCULAS y tildes', async () => {
    const results = await searchGlobal('DE TAL MANERA AMÓ DIOS')
    expect(refs(results)).toContain('Juan 3:16')
  })

  it('ignora la puntuación entre palabras', async () => {
    // "Jehová es mi pastor; nada me faltará." → la query trae coma donde el texto tiene otra cosa
    const results = await searchGlobal('jehova, es mi pastor')
    expect(refs(results)).toContain('Salmos 23:1')
  })

  it('resuelve referencias sin tilde en el nombre del libro', async () => {
    const results = await searchGlobal('genesis 1:1')
    expect(results).toHaveLength(1)
    expect(results[0].reference).toBe('Génesis 1:1')
  })

  it('una query de sólo puntuación no devuelve toda la Biblia', async () => {
    const results = await searchGlobal('¿?¡!')
    expect(results).toHaveLength(0)
  })
})
