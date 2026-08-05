import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

// Stub localStorage (parallelMode/secondaryTranslation y recentVerses se leen
// con localStorage.getItem en el useState inicial de BibleView).
vi.hoisted(() => {
  const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
})

// Con el modal de atajos (shortcutsOpen) abierto, el listener de 'keypress'
// de BibleView que abre la búsqueda rápida debía ignorar la tecla. Sin el
// arreglo, cualquier letra abría la búsqueda rápida detrás del modal y le
// robaba el foco, dejando el modal de ayuda atrapado (Escape no lo cerraba
// porque el foco quedaba en un INPUT). Ver residual-fix-report en
// .superpowers/sdd/2026-08-05-atajos-de-teclado/.

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

vi.mock('@/services/bible', () => ({
  BIBLE_BOOKS: [{ id: 'jhn', name: 'Juan', nameEn: 'John', chapters: 21, testament: 'NT' }],
  SUPPORTED_TRANSLATIONS: [
    { id: 'RVR1960', name: 'Reina Valera 1960', lang: 'Español' },
    { id: 'KJV', name: 'King James Version', lang: 'Inglés' },
  ],
  fetchChapter: vi.fn(async (_bookId: string, chapter: number, translation: string) =>
    [1, 2, 3].map(n => ({
      reference: `Juan 3:${n}`,
      text: `${translation} v${n}`,
      translation,
      bookId: 'jhn',
      chapter,
    }))
  ),
  searchGlobal: vi.fn(async () => []),
  getBookSuggestion: () => null,
  pairVersesByNumber: (primary: any[], secondary: any[]) =>
    primary.map((p, i) => ({ num: i + 1, primary: p, secondary: secondary[i] })),
}))

import BibleView from '@/pages/BibleView'

const pressLetterA = () => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keypress', { key: 'a', bubbles: true, cancelable: true }))
  })
}

describe('BibleView – listener de búsqueda rápida vs modal de atajos', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()

    useProjectionStoreMock = create<ProjectionMock>()(() => ({
      loadSong: vi.fn(),
      state: { songTitle: 'Juan 3:1', theme: {}, slides: [], currentSlide: 0, isBible: false },
    }))
    useAppStoreMock = create<AppMock>()(() => ({
      isSidebarOpen: true,
      toggleSidebar: vi.fn(),
      activeView: 'bible',
      shortcutsOpen: false,
    }))
  })

  it('con el modal de atajos abierto, pulsar una letra NO abre la búsqueda rápida', async () => {
    act(() => { useAppStoreMock.setState({ shortcutsOpen: true }) })
    render(<BibleView />)

    pressLetterA()

    expect(document.querySelector('.quick-search-overlay')).toBeNull()
  })

  it('con el modal de atajos cerrado, pulsar una letra sí abre la búsqueda rápida', async () => {
    render(<BibleView />)

    pressLetterA()

    await waitFor(() => {
      expect(document.querySelector('.quick-search-overlay')).not.toBeNull()
    })
  })
})
