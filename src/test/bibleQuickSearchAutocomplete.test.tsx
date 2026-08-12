import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

// La búsqueda rápida debe autocompletar como el campo Libro: el capítulo salta
// solo cuando el número ya no puede crecer, ofrece el capítulo abierto en gris y
// acepta una referencia escrita de corrido ("3:16").

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

// Juan: 21 capítulos y 36 versículos por capítulo. Con esos números "3" ya es un
// capítulo único (no existe el 30) y "16" un versículo único (no existe el 160).
vi.mock('@/services/bible', () => ({
  BIBLE_BOOKS: [{ id: 'jhn', name: 'Juan', nameEn: 'John', chapters: 21, testament: 'NT' }],
  SUPPORTED_TRANSLATIONS: [
    { id: 'RVR1960', name: 'Reina Valera 1960', lang: 'Español' },
  ],
  fetchChapter: vi.fn(async (_bookId: string, chapter: number, translation: string) =>
    Array.from({ length: 36 }, (_, i) => ({
      reference: `Juan ${chapter}:${i + 1}`,
      text: `${translation} ${chapter}:${i + 1}`,
      translation,
      bookId: 'jhn',
      chapter,
    }))
  ),
  searchGlobal: vi.fn(async () => []),
  getBookSuggestion: (q: string) =>
    'juan'.startsWith(q.toLowerCase()) ? { id: 'jhn', name: 'Juan', nameEn: 'John' } : null,
  pairVersesByNumber: (primary: any[], secondary: any[]) =>
    primary.map((p, i) => ({ num: i + 1, primary: p, secondary: secondary[i] })),
}))

import BibleView from '@/pages/BibleView'

const inputs = () => {
  const book = document.querySelector('.section-input-book') as HTMLInputElement
  const [chapter, verse] = Array.from(
    document.querySelectorAll('.section-input-number')
  ) as HTMLInputElement[]
  return { book, chapter, verse }
}

// Abre la búsqueda rápida y deja el libro fijado en Juan.
const lockBook = async () => {
  fireEvent(window, new KeyboardEvent('keypress', { key: 'j', bubbles: true }))
  await waitFor(() => expect(inputs().book).not.toBeNull())
  fireEvent.change(inputs().book, { target: { value: 'ju' } })
  await waitFor(() => expect(inputs().book.value).toBe('Juan'))
  // Al abrirse, la búsqueda rápida fuerza el foco al libro a los 50 ms. Hay que
  // dejar pasar ese temporizador o robaría el foco que damos después.
  await new Promise(r => setTimeout(r, 80))
}

describe('BibleView – autocompletado de capítulo en la búsqueda rápida', () => {
  let loadSong: Mock<ProjectionMock['loadSong']>

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    loadSong = vi.fn<ProjectionMock['loadSong']>()
    useProjectionStoreMock = create<ProjectionMock>()(() => ({
      loadSong,
      state: { songTitle: '', theme: {}, slides: [], currentSlide: 0, isBible: false },
    }))
    useAppStoreMock = create<AppMock>()(() => ({
      isSidebarOpen: true,
      toggleSidebar: vi.fn(),
      activeView: 'bible',
      shortcutsOpen: false,
    }))
  })

  it('ofrece en gris el capítulo abierto y lo acepta con TAB', async () => {
    render(<BibleView />)
    await lockBook()

    // La vista arranca en Juan 3, así que ese es el capítulo sugerido
    expect(inputs().chapter.placeholder).toBe('3')

    fireEvent.keyDown(inputs().chapter, { key: 'Tab' })
    await waitFor(() => expect(inputs().chapter.value).toBe('3'))
    await waitFor(() => expect(document.activeElement).toBe(inputs().verse))
  })

  it('salta al versículo cuando el capítulo ya no puede crecer', async () => {
    render(<BibleView />)
    await lockBook()

    // "1" todavía puede ser 10-19: se queda en el campo
    fireEvent.change(inputs().chapter, { target: { value: '1' } })
    await waitFor(() => expect(inputs().chapter.value).toBe('1'))
    expect(document.activeElement).not.toBe(inputs().verse)

    // "3" ya no puede crecer (Juan no llega a 30)
    fireEvent.change(inputs().chapter, { target: { value: '3' } })
    await waitFor(() => expect(document.activeElement).toBe(inputs().verse))
  })

  it('proyecta al completar un versículo que ya no puede crecer', async () => {
    render(<BibleView />)
    await lockBook()

    fireEvent.change(inputs().chapter, { target: { value: '3' } })
    await waitFor(() => expect(document.activeElement).toBe(inputs().verse))

    // "1" puede ser 10-19: nada se proyecta todavía
    fireEvent.change(inputs().verse, { target: { value: '1' } })
    expect(loadSong).not.toHaveBeenCalled()

    fireEvent.change(inputs().verse, { target: { value: '16' } })
    await waitFor(() => expect(loadSong).toHaveBeenCalled())
    expect(loadSong.mock.calls[0][0].title).toBe('Juan 3:16')
  })

  it('reparte una referencia escrita de corrido en el campo Capítulo', async () => {
    render(<BibleView />)
    await lockBook()

    fireEvent.change(inputs().chapter, { target: { value: '3:16' } })
    await waitFor(() => expect(inputs().chapter.value).toBe('3'))
    expect(inputs().verse.value).toBe('16')
  })
})
