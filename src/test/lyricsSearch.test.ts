import { describe, it, expect, afterEach, vi } from 'vitest'
import { titleKey, artistKey, extractLyrics, cleanTitle, buildResults, searchLrclib } from '@/services/lyricsSearch'
import type { LrclibTrack } from '@/services/lyricsSearch'
import { parseLyrics } from '@/services/lyricsParser'
import mielSanMarcos from './fixtures/lrclib-miel-san-marcos.json'
import hillsongEs from './fixtures/lrclib-hillsong-es.json'

const duro = mielSanMarcos as LrclibTrack[]
const blando = hillsongEs as LrclibTrack[]

/** Track mínimo para los casos que los fixtures reales no contienen. */
function track(over: Partial<LrclibTrack> = {}): LrclibTrack {
  return {
    id: 1,
    trackName: 'Canción',
    artistName: 'Artista',
    instrumental: false,
    plainLyrics: 'Línea uno\nLínea dos',
    syncedLyrics: null,
    ...over,
  }
}

describe('titleKey', () => {
  it('corta en el primer | para matar títulos de YouTube', () => {
    expect(titleKey('"BIENVENIDO ESPÍRITU SANTO"  FEAT MARCO BARRIENTOS | VIDEO OFICIAL | MIEL SAN MARCOS'))
      .toBe('bienvenido espiritu santo')
  })

  it('ignora tildes y mayúsculas', () => {
    expect(titleKey('Espíritu Santo')).toBe(titleKey('espiritu santo'))
  })

  it('quita los sufijos de versión', () => {
    expect(titleKey('Bienvenido Espíritu Santo (En Vivo)')).toBe('bienvenido espiritu santo')
    expect(titleKey('Algo (Acústico)')).toBe('algo')
  })

  it('no corta en con, coma, viñeta ni ampersand', () => {
    expect(titleKey('Con Todo Mi Ser')).toBe('con todo mi ser')
    expect(titleKey('Ven, Espíritu Santo')).toBe('ven espiritu santo')
    expect(titleKey('Santo, Santo, Santo')).toBe('santo santo santo')
  })

  it('un título compuesto no colisiona con uno simple', () => {
    expect(titleKey('Santo, Santo, Santo')).not.toBe(titleKey('Santo'))
  })

  it('sí corta en feat, que es metadato', () => {
    expect(titleKey('Hosanna (feat. Hillsong UNITED)')).toBe(titleKey('Hosanna'))
  })
})

describe('artistKey', () => {
  it('conserva los espacios, a diferencia de normalizeSearchText', () => {
    expect(artistKey('Miel San Marcos')).toBe('miel san marcos')
  })

  it('se queda con el artista principal en las cuatro formas de lrclib', () => {
    const esperado = 'miel san marcos'
    expect(artistKey('Miel San Marcos')).toBe(esperado)
    expect(artistKey('Miel San Marcos feat. Marco Barrientos')).toBe(esperado)
    expect(artistKey('Miel San Marcos • Marco Barrientos')).toBe(esperado)
    expect(artistKey('Miel San Marcos, Marco Barrientos')).toBe(esperado)
  })
})

describe('extractLyrics', () => {
  it('prefiere plainLyrics', () => {
    expect(extractLyrics(track({ plainLyrics: 'Hola', syncedLyrics: '[00:01.00] Otra' }))).toBe('Hola')
  })

  it('cae en syncedLyrics quitando los timestamps', () => {
    const t = track({ plainLyrics: null, syncedLyrics: '[00:12.34] Santo\n[00:15.00] Santo' })
    expect(extractLyrics(t)).toBe('Santo\nSanto')
  })

  it('devuelve cadena vacía si no hay letra', () => {
    expect(extractLyrics(track({ plainLyrics: null, syncedLyrics: null }))).toBe('')
  })
})

describe('cleanTitle', () => {
  it('corta en el primer | y quita comillas', () => {
    expect(cleanTitle('"Bienvenido Espíritu Santo" | VIDEO OFICIAL')).toBe('Bienvenido Espíritu Santo')
  })

  it('pasa los títulos gritados a capitalización normal', () => {
    expect(cleanTitle('RENUÉVAME')).toBe('Renuévame')
  })

  it('respeta los títulos que ya están bien', () => {
    expect(cleanTitle('Bienvenido Espíritu Santo (En Vivo)')).toBe('Bienvenido Espíritu Santo (En Vivo)')
  })
})

describe('buildResults', () => {
  it('colapsa a 1 las 8 entradas del fixture duro', () => {
    const out = buildResults(duro, new Set())
    expect(out).toHaveLength(1)
    expect(out[0].artist).toBe('Miel San Marcos')
  })

  it('conserva 19 de 20 en el fixture blando: no es demasiado agresivo', () => {
    expect(buildResults(blando, new Set())).toHaveLength(19)
  })

  it('descarta el registro malformado cuando otro comparte el título', () => {
    const out = buildResults([
      track({ id: 1, trackName: 'Santo | VIDEO OFICIAL', artistName: 'Santo | VIDEO OFICIAL' }),
      track({ id: 2, trackName: 'Santo', artistName: 'Miel San Marcos' }),
    ], new Set())
    expect(out.map(r => r.id)).toEqual([2])
  })

  it('conserva el registro malformado si es el único resultado', () => {
    const out = buildResults([
      track({ id: 1, trackName: 'Santo | VIDEO OFICIAL', artistName: 'Santo | VIDEO OFICIAL' }),
    ], new Set())
    expect(out).toHaveLength(1)
  })

  it('detecta el registro malformado aunque el título lleve coma', () => {
    const basura = 'Cristo, Rey y Salvador | VIDEO OFICIAL'
    const out = buildResults([
      track({ id: 1, trackName: basura, artistName: basura }),
      track({ id: 2, trackName: 'Cristo, Rey y Salvador', artistName: 'Coro IPUC' }),
    ], new Set())
    expect(out.map(r => r.id)).toEqual([2])
  })

  it('un registro malformado con coma sobrevive si es el único', () => {
    const basura = 'Cristo, Rey y Salvador | VIDEO OFICIAL'
    expect(buildResults([track({ id: 1, trackName: basura, artistName: basura })], new Set())).toHaveLength(1)
  })

  it('de un grupo duplicado gana la letra más larga', () => {
    const out = buildResults([
      track({ id: 1, trackName: 'Santo', artistName: 'Coro', plainLyrics: 'corta' }),
      track({ id: 2, trackName: 'Santo (En Vivo)', artistName: 'Coro', plainLyrics: 'una letra mucho más larga' }),
    ], new Set())
    expect(out.map(r => r.id)).toEqual([2])
  })

  it('descarta instrumentales y entradas sin letra', () => {
    const out = buildResults([
      track({ id: 1, trackName: 'A', instrumental: true }),
      track({ id: 2, trackName: 'B', plainLyrics: null, syncedLyrics: null }),
      track({ id: 3, trackName: 'C' }),
    ], new Set())
    expect(out.map(r => r.id)).toEqual([3])
  })

  it('pone delante a los artistas del catálogo', () => {
    const out = buildResults([
      track({ id: 1, trackName: 'Uno', artistName: 'Desconocido' }),
      track({ id: 2, trackName: 'Dos', artistName: 'Miel San Marcos' }),
    ], new Set(['miel san marcos']))
    expect(out.map(r => r.id)).toEqual([2, 1])
    expect(out[0].knownArtist).toBe(true)
    expect(out[1].knownArtist).toBe(false)
  })

  it('la letra resultante se parte en más de un slide', () => {
    const out = buildResults(duro, new Set())
    expect(parseLyrics(out[0].lyrics).length).toBeGreaterThan(1)
  })
})

describe('searchLrclib', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('pide a lrclib con la query codificada y la cabecera de cliente', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)

    await searchLrclib('santo espíritu')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://lrclib.net/api/search?q=santo%20esp%C3%ADritu')
    expect(init.headers['Lrclib-Client']).toContain('Proclama')
  })

  it('lanza si la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(searchLrclib('algo')).rejects.toThrow('503')
  })

  it('propaga el abort de quien llama', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    ))
    const ctrl = new AbortController()
    const promesa = searchLrclib('algo', ctrl.signal)
    ctrl.abort()
    await expect(promesa).rejects.toThrow(/abort/i)
  })
})
