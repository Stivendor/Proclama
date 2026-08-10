import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { LrclibTrack } from '@/services/lyricsSearch'

// El debounce del hook es una constante privada (300 ms); se repite aquí a
// propósito para no acoplar el test a un export que el hook no necesita.
const DEBOUNCE_MS = 300

const searchLrclibMock = vi.fn()

// buildResults/titleKey/artistKey son puros y rápidos: se dejan reales para
// no reimplementar su lógica en el test. Solo se mockea la llamada de red.
vi.mock('@/services/lyricsSearch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/lyricsSearch')>()
  return {
    ...actual,
    searchLrclib: (query: string, signal?: AbortSignal) => searchLrclibMock(query, signal),
  }
})

vi.mock('@/services/supabase', () => ({
  fetchCommunityArtists: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/db', () => ({
  db: { songs: { toArray: vi.fn().mockResolvedValue([]) } },
}))

import { useLyricsSearch } from '@/hooks/useLyricsSearch'

function track(over: Partial<LrclibTrack> = {}): LrclibTrack {
  return {
    id: 1,
    trackName: 'Amazing Grace',
    artistName: 'Hillsong',
    instrumental: false,
    plainLyrics: 'Línea uno\nLínea dos',
    syncedLyrics: null,
    ...over,
  }
}

describe('useLyricsSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    searchLrclibMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cambiar de query antes de que resuelva la anterior aborta esa petición: solo queda una en vuelo', async () => {
    let signalA: AbortSignal | undefined
    searchLrclibMock.mockImplementationOnce((_q: string, signal: AbortSignal) => {
      signalA = signal
      return new Promise(() => {}) // nunca resuelve: simula una petición colgada
    })
    searchLrclibMock.mockImplementationOnce(() => Promise.resolve([track()]))

    const { result } = renderHook(() => useLyricsSearch())

    act(() => { result.current.setQuery('shout to the lord') })
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS) })

    act(() => { result.current.setQuery('amazing grace') })
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS) })

    expect(searchLrclibMock).toHaveBeenCalledTimes(2)
    expect(signalA?.aborted).toBe(true)
    expect(result.current.loading).toBe(false)
    expect(result.current.results.length).toBeGreaterThan(0)
  })

  it('repetir la misma query usa la caché y no vuelve a llamar a searchLrclib', async () => {
    searchLrclibMock.mockResolvedValue([track()])

    const { result } = renderHook(() => useLyricsSearch())

    act(() => { result.current.setQuery('amazing grace') })
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS) })
    expect(searchLrclibMock).toHaveBeenCalledTimes(1)
    expect(result.current.results.length).toBeGreaterThan(0)

    act(() => { result.current.setQuery('') })
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS) })

    act(() => { result.current.setQuery('amazing grace') })
    await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS) })

    expect(searchLrclibMock).toHaveBeenCalledTimes(1)
    expect(result.current.results.length).toBeGreaterThan(0)
  })
})
