import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * El caché de capítulos vivía solo en memoria, así que NVI/KJV volvían a pedirse
 * a la red en cada recarga. Estas pruebas fijan el contrato nuevo: un capítulo
 * ya descargado se sirve desde Dexie sin tocar la red, y RVR1960 nunca se
 * persiste porque ya viaja entera en el bundle.
 */

const chaptersCache = {
  get: vi.fn(),
  put: vi.fn().mockResolvedValue(undefined),
  where: vi.fn(() => ({ equals: () => ({ delete: vi.fn().mockResolvedValue(0) }) })),
}

vi.mock('@/db', () => ({
  db: {
    bible_chapters_cache: chaptersCache,
    imported_bibles: { get: vi.fn(), toArray: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/services/supabase', () => ({ supabase: {} }))

// RVR1960 local: vacío, para que las traducciones de red no encuentren datos locales.
vi.mock('@/data/bible-rvr1960.json', () => ({ default: {} }))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const NVI_PAYLOAD = [{ verse: 1, text: 'En el principio creó Dios los cielos y la tierra.' }]

function okResponse(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response
}

async function importBible() {
  const mod = await import('@/services/bible')
  mod.clearChapterCache()
  return mod
}

beforeEach(() => {
  vi.resetModules()
  chaptersCache.get.mockReset().mockResolvedValue(undefined)
  chaptersCache.put.mockReset().mockResolvedValue(undefined)
  fetchMock.mockReset()
})

describe('caché persistente de capítulos', () => {
  it('sirve desde Dexie sin salir a la red cuando el capítulo ya se descargó', async () => {
    const { fetchChapter } = await importBible()
    chaptersCache.get.mockResolvedValue({
      bibleId: 'NVI',
      bookId: 'gen',
      chapterId: '1',
      verses: [{ reference: 'Génesis 1:1', text: 'En el principio…', translation: 'NVI' }],
    })

    const verses = await fetchChapter('gen', 1, 'NVI')

    expect(verses).toHaveLength(1)
    expect(verses[0].text).toBe('En el principio…')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(chaptersCache.get).toHaveBeenCalledWith(['NVI', 'gen', '1'])
  })

  it('persiste en Dexie lo que descarga de la red', async () => {
    const { fetchChapter } = await importBible()
    fetchMock.mockResolvedValue(okResponse(NVI_PAYLOAD))

    await fetchChapter('gen', 1, 'NVI')

    expect(fetchMock).toHaveBeenCalled()
    expect(chaptersCache.put).toHaveBeenCalledWith(
      expect.objectContaining({ bibleId: 'NVI', bookId: 'gen', chapterId: '1' })
    )
  })

  it('no persiste RVR1960: ya viaja entera en el bundle', async () => {
    const { fetchChapter } = await importBible()
    fetchMock.mockResolvedValue(okResponse([{ verse: 1, text: 'texto' }]))

    await fetchChapter('gen', 1, 'RVR1960')

    expect(chaptersCache.get).not.toHaveBeenCalled()
    expect(chaptersCache.put).not.toHaveBeenCalled()
  })

  it('un fallo de Dexie no rompe la lectura: cae a la red', async () => {
    const { fetchChapter } = await importBible()
    chaptersCache.get.mockRejectedValue(new Error('QuotaExceededError'))
    fetchMock.mockResolvedValue(okResponse(NVI_PAYLOAD))

    const verses = await fetchChapter('gen', 1, 'NVI')

    expect(verses.length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalled()
  })
})
