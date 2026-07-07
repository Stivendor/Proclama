import { describe, it, expect } from 'vitest'
import { fetchChapter, searchGlobal } from '@/services/bible'

// Verifica que el JSON lazy (bible-rvr1960.json) carga y sirve datos locales
// sin tocar red para RVR1960.
describe('datos locales RVR1960 (chunk lazy)', () => {
  it('fetchChapter sirve Génesis 1 desde el JSON local', async () => {
    const verses = await fetchChapter('gen', 1)
    expect(verses.length).toBeGreaterThan(25)
    expect(verses[0].text).toContain('En el principio')
    expect(verses[0].translation).toBe('RVR1960')
    expect(verses[0].reference).toBe('Génesis 1:1')
  })

  it('searchGlobal resuelve referencias exactas localmente', async () => {
    const results = await searchGlobal('Juan 3:16')
    expect(results).toHaveLength(1)
    expect(results[0].text).toContain('amó Dios al mundo')
  })
})
