import { describe, it, expect } from 'vitest'
import {
  filterBibles,
  groupBiblesByLanguage,
  bibleLanguageLabel,
} from '@/features/bible'
import type { HelloAOBibleInfo } from '@/types'

// Forma real de available_translations.json. `cug_wbt` y `plj_tsc` existen en el
// API de HelloAO sin `languageName` ni `languageEnglishName`: con ellas el
// filtrado viejo hacía `undefined.toLowerCase()` y toda la app se iba a negro.
const bsb: HelloAOBibleInfo = {
  id: 'BSB',
  name: 'Berean Standard Bible',
  englishName: 'Berean Standard Bible',
  language: 'eng',
  languageName: 'English',
  languageEnglishName: 'English',
  shortName: 'BSB',
  totalNumberOfChapters: 1189,
  totalNumberOfVerses: 31086,
}

const rv1960: HelloAOBibleInfo = {
  id: 'RV60',
  name: 'Reina-Valera 1960',
  englishName: 'Reina-Valera 1960',
  language: 'spa',
  languageName: 'Español',
  shortName: 'RV60',
  totalNumberOfChapters: 1189,
  totalNumberOfVerses: 31102,
}

// Sin languageName / languageEnglishName (caso real del API)
const cugWbt: HelloAOBibleInfo = {
  id: 'cug_wbt',
  name: 'Kiyaki wakti ki Nyamkai Mifiaki',
  englishName: 'Chung NT+',
  language: 'cug',
  shortName: 'WBT',
  totalNumberOfChapters: 0,
  totalNumberOfVerses: 7949,
}

const pljTsc: HelloAOBibleInfo = {
  id: 'plj_tsc',
  name: 'Zul',
  englishName: 'Polci NT',
  language: 'plj',
  shortName: 'TSC',
  totalNumberOfChapters: 0,
  totalNumberOfVerses: 10980,
}

const catalog = [bsb, rv1960, cugWbt, pljTsc]
const ids = (list: HelloAOBibleInfo[]) => list.map(b => b.id)

describe('filterBibles – búsqueda del catálogo HelloAO', () => {
  it('con query vacía devuelve todo sin tocar los campos', () => {
    expect(ids(filterBibles(catalog, ''))).toEqual(ids(catalog))
    expect(ids(filterBibles(catalog, '   '))).toEqual(ids(catalog))
  })

  it('NO lanza con entradas que no traen languageName ni languageEnglishName', () => {
    // Cualquier query recorre las 1.500 entradas, incluidas las rotas.
    expect(() => filterBibles(catalog, 'chung')).not.toThrow()
    expect(() => filterBibles(catalog, 'a')).not.toThrow()
    expect(() => filterBibles(catalog, 'español')).not.toThrow()

    expect(ids(filterBibles(catalog, 'chung'))).toEqual(['cug_wbt'])
    expect(ids(filterBibles(catalog, 'polci'))).toEqual(['plj_tsc'])
  })

  it('encuentra por nombre de Biblia', () => {
    expect(ids(filterBibles(catalog, 'berean'))).toEqual(['BSB'])
  })

  it('encuentra por idioma', () => {
    expect(ids(filterBibles(catalog, 'English'))).toContain('BSB')
    expect(ids(filterBibles(catalog, 'Español'))).toContain('RV60')
  })

  it('encuentra por código de idioma cuando no hay nombre de idioma', () => {
    expect(ids(filterBibles(catalog, 'cug'))).toContain('cug_wbt')
    expect(ids(filterBibles(catalog, 'plj'))).toContain('plj_tsc')
  })

  it('busca sin tildes ni mayúsculas', () => {
    expect(ids(filterBibles(catalog, 'ESPAÑOL'))).toContain('RV60')
    expect(ids(filterBibles(catalog, 'espanol'))).toContain('RV60')
    expect(ids(filterBibles(catalog, 'BEREAN STANDARD'))).toEqual(['BSB'])
  })

  it('ignora puntuación dentro del nombre ("reina valera" → "Reina-Valera 1960")', () => {
    expect(ids(filterBibles(catalog, 'reina valera'))).toEqual(['RV60'])
  })

  it('una query de sólo puntuación no devuelve nada ni revienta', () => {
    expect(filterBibles(catalog, '¿?¡!')).toEqual([])
  })

  it('una búsqueda sin resultados devuelve lista vacía', () => {
    expect(filterBibles(catalog, 'zzzz-no-existe')).toEqual([])
  })
})

describe('groupBiblesByLanguage – agrupación por idioma', () => {
  it('agrupa las entradas sin nombre de idioma bajo su código', () => {
    const grouped = groupBiblesByLanguage(catalog)

    expect(grouped.English).toHaveLength(1)
    expect(grouped.cug).toHaveLength(1)
    expect(grouped.plj).toHaveLength(1)
    expect(ids(grouped.cug)).toEqual(['cug_wbt'])
    expect(ids(grouped.plj)).toEqual(['plj_tsc'])
  })

  it('sin languageEnglishName usa el nombre nativo', () => {
    expect(groupBiblesByLanguage(catalog).Español).toHaveLength(1)
  })

  it('descarta ids repetidos dentro del mismo grupo', () => {
    const dup: HelloAOBibleInfo[] = [bsb, { ...bsb, name: 'Berean Standard Bible (dup)' }]
    const grouped = groupBiblesByLanguage(dup)

    expect(grouped.English).toHaveLength(1)
    expect(ids(grouped.English)).toEqual(['BSB'])
  })

  it('etiqueta cada traducción con un idioma no vacío', () => {
    for (const bible of catalog) {
      expect(bibleLanguageLabel(bible).length).toBeGreaterThan(0)
    }
    expect(bibleLanguageLabel(cugWbt)).toBe('cug')
  })

  it('filtrar y agrupar en cadena no pierde resultados ni lanza', () => {
    // "NT" sólo está en los englishName de cug_wbt y plj_tsc, los dos que no
    // tienen nombre de idioma: deben agruparse por su código, no desaparecer.
    const grouped = groupBiblesByLanguage(filterBibles(catalog, 'nt'))

    expect(ids(grouped.cug)).toEqual(['cug_wbt'])
    expect(ids(grouped.plj)).toEqual(['plj_tsc'])
    expect(grouped['Sin idioma']).toBeUndefined()
  })
})
