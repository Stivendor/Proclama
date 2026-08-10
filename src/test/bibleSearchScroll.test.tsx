import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

// Al buscar por texto, el resultado se proyecta y la vista salta a su capítulo.
// La lista de versículos debe quedar centrada en el versículo encontrado, igual
// que en la búsqueda rápida. El scroll se pide en el mismo batch que el cambio
// de capítulo, así que si el efecto no espera a que ese capítulo esté cargado
// corre sobre la lista vieja (donde el versículo puede no existir) y se pierde.

vi.hoisted(() => {
  const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
})

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

vi.mock('dexie-react-hooks', () => {
  const EMPTY: any[] = []
  return { useLiveQuery: () => EMPTY }
})
vi.mock('@/db', () => ({ db: { imported_bibles: { toArray: () => Promise.resolve([]) } } }))
vi.mock('@/components/songs/ImportBibleModal', () => ({ default: () => null }))

// Juan 3 (capítulo inicial) tiene 1 versículo; Juan 5 tiene 5. El destino es
// Juan 5:4: no existe en la lista vieja, así que sólo se acierta si el scroll
// espera al capítulo correcto.
const searchHit = { reference: 'Juan 5:4', text: 'texto encontrado', translation: 'RVR1960', bookId: 'jhn', chapter: 5 }

vi.mock('@/services/bible', () => ({
  BIBLE_BOOKS: [{ id: 'jhn', name: 'Juan', nameEn: 'John', chapters: 21, testament: 'NT' }],
  SUPPORTED_TRANSLATIONS: [
    { id: 'RVR1960', name: 'Reina Valera 1960', lang: 'Español' },
    { id: 'KJV', name: 'King James Version', lang: 'Inglés' },
  ],
  fetchChapter: vi.fn(async (_bookId: string, chapter: number, translation: string) =>
    Array.from({ length: 5 }, (_, i) => ({
      reference: `Juan ${chapter}:${i + 1}`,
      text: `${translation} ${chapter}:${i + 1}`,
      translation,
      bookId: 'jhn',
      chapter,
    }))
  ),
  searchGlobal: vi.fn(async () => [searchHit]),
  getBookSuggestion: () => null,
  pairVersesByNumber: (primary: any[], secondary: any[]) =>
    primary.map((p, i) => ({ num: i + 1, primary: p, secondary: secondary[i] })),
}))

import BibleView from '@/pages/BibleView'

describe('BibleView – la búsqueda por texto lleva la lista al versículo', () => {
  let scrolled: (string | null)[]

  beforeEach(() => {
    scrolled = []
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this.textContent)
    })

    useProjectionStoreMock = create<ProjectionMock>()(() => ({
      loadSong: vi.fn(),
      state: { songTitle: '', theme: {}, slides: [], currentSlide: 0, isBible: false },
    }))
    useAppStoreMock = create<AppMock>()(() => ({
      isSidebarOpen: true,
      toggleSidebar: vi.fn(),
      activeView: 'bible',
      shortcutsOpen: false,
    }))
  })

  it('centra el versículo encontrado tras cargar su capítulo', async () => {
    render(<BibleView />)
    await waitFor(() => expect(document.querySelector('.verses-list')).not.toBeNull())

    fireEvent.change(screen.getByLabelText('Buscar en la Biblia'), { target: { value: 'texto encontrado' } })
    fireEvent.click(screen.getByText('Buscar'))

    // Un único scroll, y al versículo del capítulo nuevo: sin el guard el efecto
    // corría antes sobre la lista de Juan 3 y saltaba al 3:4.
    await waitFor(() => expect(scrolled.length).toBeGreaterThan(0))
    expect(scrolled).toEqual([expect.stringContaining('RVR1960 5:4')])
  })
})
