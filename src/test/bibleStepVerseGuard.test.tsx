import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

// Stub localStorage (parallelMode/secondaryTranslation se leen con
// localStorage.getItem en el useState inicial de BibleView).
vi.hoisted(() => {
  const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
})

// El guard steppingRef de BibleView sólo protege de verdad si el `finally`
// corre recién cuando la proyección terminó (ver IMPORTANT #2 del review de
// feat/atajos-de-teclado). Este test reproduce la carrera: dos flechas
// disparadas mientras el fetch de la traducción secundaria (modo paralelo)
// sigue pendiente no deben proyectar el mismo versículo dos veces.

interface ProjectionMock {
  loadSong: (song: { title: string }, isBible?: boolean, initialSlide?: number) => void
  state: { songTitle: string; theme: any; slides: any[]; currentSlide: number; isBible: boolean }
}
interface AppMock {
  isSidebarOpen: boolean
  toggleSidebar: () => void
  activeView: string
  shortcutsOpen: boolean
}

let useProjectionStoreMock: UseBoundStore<StoreApi<ProjectionMock>>
let useAppStoreMock: UseBoundStore<StoreApi<AppMock>>

vi.mock('@/stores', () => ({
  useProjectionStore: Object.assign(
    (selector: any) => useProjectionStoreMock(selector),
    { getState: () => useProjectionStoreMock.getState() }
  ),
  useAppStore: Object.assign(
    (selector: any) => useAppStoreMock(selector),
    { getState: () => useAppStoreMock.getState() }
  ),
}))

// Referencia estable: si useLiveQuery devolviera un array nuevo en cada
// render, el useEffect de BibleView que depende de `importedBibles` se
// re-ejecutaría sin fin (bucle infinito de renders).
vi.mock('dexie-react-hooks', () => {
  const EMPTY: any[] = []
  return { useLiveQuery: () => EMPTY }
})
vi.mock('@/db', () => ({ db: { imported_bibles: { toArray: () => Promise.resolve([]) } } }))
vi.mock('@/components/songs/ImportBibleModal', () => ({ default: () => null }))

type Deferred = { resolve: () => void }

// vi.mock se hoistea al tope del archivo, así que todo lo que la factory
// necesita capturar por closure tiene que vivir dentro de vi.hoisted().
const { fetchChapter, getDeferredQueue, resetFetchMock } = vi.hoisted(() => {
  let fetchCallCount = 0
  let deferredQueue: Deferred[] = []

  const makeVerse = (n: number, translation: string, chapter: number) => ({
    reference: `Juan 3:${n}`,
    text: `${translation} v${n}`,
    translation,
    bookId: 'jhn',
    chapter,
  })

  const fetchChapter = vi.fn((_bookId: string, chapter: number, translation: string) => {
    fetchCallCount++
    // Las dos primeras llamadas son los efectos de montaje (capítulo primario +
    // capítulo secundario en paralelo): resuelven de inmediato. Las siguientes
    // son las que dispara stepVerse al proyectar y se dejan pendientes a
    // propósito para simular una traducción secundaria lenta.
    if (fetchCallCount <= 2) {
      return Promise.resolve([1, 2, 3].map(n => makeVerse(n, translation, chapter)))
    }
    return new Promise<any>(resolve => {
      deferredQueue.push({ resolve: () => resolve([1, 2, 3].map(n => makeVerse(n, translation, chapter))) })
    })
  })

  return {
    fetchChapter,
    getDeferredQueue: () => deferredQueue,
    resetFetchMock: () => { fetchCallCount = 0; deferredQueue = [] },
  }
})

vi.mock('@/services/bible', () => ({
  BIBLE_BOOKS: [{ id: 'jhn', name: 'Juan', nameEn: 'John', chapters: 21, testament: 'NT' }],
  SUPPORTED_TRANSLATIONS: [
    { id: 'RVR1960', name: 'Reina Valera 1960', lang: 'Español' },
    { id: 'KJV', name: 'King James Version', lang: 'Inglés' },
  ],
  fetchChapter,
  searchGlobal: vi.fn(async () => []),
  getBookSuggestion: () => null,
  pairVersesByNumber: (primary: any[], secondary: any[]) =>
    primary.map((p, i) => ({ num: i + 1, primary: p, secondary: secondary[i] })),
}))

import BibleView from '@/pages/BibleView'

const pressArrowRight = () => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
  })
}

describe('BibleView – guard de stepVerse', () => {
  beforeEach(() => {
    resetFetchMock()
    fetchChapter.mockClear()
    localStorage.setItem('proclama-bible-parallel', '1')
    localStorage.removeItem('proclama-bible-secondary-translation') // usa el default 'KJV'
    Element.prototype.scrollIntoView = vi.fn()

    useProjectionStoreMock = create<ProjectionMock>()((set) => ({
      loadSong: vi.fn((song: { title: string }) => {
        set(s => ({ state: { ...s.state, songTitle: song.title, isBible: true } }))
      }),
      state: { songTitle: 'Juan 3:1', theme: {}, slides: [], currentSlide: 0, isBible: true },
    }))
    useAppStoreMock = create<AppMock>()(() => ({
      isSidebarOpen: true,
      toggleSidebar: vi.fn(),
      activeView: 'bible',
      shortcutsOpen: false,
    }))
  })

  it('dos flechas seguidas con el fetch secundario pendiente no proyectan el mismo versículo dos veces', async () => {
    render(<BibleView />)

    // Espera a que carguen el capítulo primario y el secundario (2 llamadas).
    await waitFor(() => expect(fetchChapter).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(document.querySelectorAll('.verse-item--parallel')).toHaveLength(3))

    const loadSongSpy = useProjectionStoreMock.getState().loadSong

    // 1ª flecha: arranca projectVerse, que se queda esperando el fetch de la
    // traducción secundaria (llamada #3, deliberadamente sin resolver).
    pressArrowRight()
    expect(fetchChapter).toHaveBeenCalledTimes(3)
    expect(loadSongSpy).not.toHaveBeenCalled()

    // 2ª flecha disparada mientras la primera sigue en vuelo: con el guard
    // roto, esto releería songTitle viejo y repetiría el mismo destino
    // (una 4ª llamada a fetchChapter para el mismo versículo). Con el guard
    // corregido debe quedar bloqueada sin efecto alguno.
    pressArrowRight()
    expect(fetchChapter).toHaveBeenCalledTimes(3)
    expect(getDeferredQueue()).toHaveLength(1)
    expect(loadSongSpy).not.toHaveBeenCalled()

    // Se libera el fetch pendiente: la primera pulsación completa su proyección.
    await act(async () => { getDeferredQueue()[0].resolve() })
    await waitFor(() => expect(loadSongSpy).toHaveBeenCalledTimes(1))
    expect(loadSongSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ title: 'Juan 3:2' }), true, 0)

    // Con el guard ya libre, una nueva pulsación avanza a un versículo DISTINTO.
    pressArrowRight()
    await waitFor(() => expect(getDeferredQueue()).toHaveLength(2))
    await act(async () => { getDeferredQueue()[1].resolve() })
    await waitFor(() => expect(loadSongSpy).toHaveBeenCalledTimes(2))
    expect(loadSongSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: 'Juan 3:3' }), true, 0)
  })
})
