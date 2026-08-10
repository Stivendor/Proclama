import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Song } from '@/types'

const toArrayMock = vi.fn()

vi.mock('@/db', () => ({
  db: { songs: { toArray: (...args: unknown[]) => toArrayMock(...args) } },
}))

import { useLocalLyricsMatchCount, countLocalLyricsMatches } from '@/hooks/useLocalLyricsMatchCount'

function song(over: Partial<Song> = {}): Song {
  return {
    title: 'Título',
    artist: 'Artista',
    lyrics: '',
    key: '',
    tags: [],
    language: 'Español',
    usageCount: 0,
    isPublic: false,
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

describe('countLocalLyricsMatches', () => {
  it('cuenta título, artista y letra, ignorando acentos', () => {
    const songs = [
      song({ title: 'Renuévame', lyrics: 'nada que ver' }),
      song({ title: 'Otra', artist: 'renuevame band', lyrics: 'nada que ver' }),
      song({ title: 'Otra más', lyrics: 'letra irrelevante' }),
    ]
    expect(countLocalLyricsMatches('renuevame', songs)).toBe(2)
  })
})

describe('useLocalLyricsMatchCount', () => {
  beforeEach(() => {
    toArrayMock.mockReset()
  })

  it('cuenta las canciones cuya letra contiene la query, aunque no aparezca en título ni artista', async () => {
    toArrayMock.mockResolvedValue([
      song({ title: 'A', lyrics: 'este verso habla de tu gracia infinita' }),
      song({ title: 'B', lyrics: 'nada que ver' }),
      song({ title: 'C', lyrics: 'tu gracia me alcanzó en la cruz' }),
      song({ title: 'D', lyrics: 'otra letra distinta' }),
    ])

    const { result } = renderHook(() => useLocalLyricsMatchCount('gracia', true))

    await waitFor(() => expect(result.current).toBe(2))
  })

  it('no consulta Dexie mientras enabled es false', () => {
    const { result } = renderHook(() => useLocalLyricsMatchCount('gracia', false))
    expect(result.current).toBeNull()
    expect(toArrayMock).not.toHaveBeenCalled()
  })

  it('ignora una respuesta tardía de una query anterior si la query ya cambió', async () => {
    let resolverAnterior: (songs: Song[]) => void = () => {}
    toArrayMock
      .mockImplementationOnce(() => new Promise(res => { resolverAnterior = res }))
      .mockResolvedValueOnce([song({ lyrics: 'gloria a Dios' })])

    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useLocalLyricsMatchCount(q, true),
      { initialProps: { q: 'vieja' } }
    )

    rerender({ q: 'gloria' })
    await waitFor(() => expect(result.current).toBe(1))

    // La petición de "vieja" resuelve después: no debe pisar el recuento de "gloria".
    await act(async () => {
      resolverAnterior([song(), song(), song()])
      await Promise.resolve()
    })
    expect(result.current).toBe(1)
  })
})
