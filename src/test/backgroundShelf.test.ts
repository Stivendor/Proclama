import { describe, expect, it, vi } from 'vitest'

// El persist de zustand captura localStorage al importar el store: stub ANTES del import
vi.hoisted(() => {
  const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
})

import { togglePinned, prunePinned } from '@/utils/backgroundShelf'
import { useProjectionStore } from '@/stores'
import type { LocalMedia } from '@/types'

const img = (id: string): LocalMedia => ({
  id, url: `blob:${id}`, type: 'image', name: id, size: 1, createdAt: 0, folderId: null,
})
const vid = (id: string): LocalMedia => ({ ...img(id), type: 'video' })

describe('togglePinned', () => {
  it('agrega un id que no estaba', () => {
    expect(togglePinned(['a'], 'b')).toEqual(['a', 'b'])
  })
  it('quita un id que ya estaba', () => {
    expect(togglePinned(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('prunePinned', () => {
  it('quita ids que ya no existen en la media local', () => {
    expect(prunePinned(['a', 'x', 'b'], [img('a'), img('b')])).toEqual(['a', 'b'])
  })
  it('quita ids cuyo item ya no es imagen', () => {
    expect(prunePinned(['a', 'v'], [img('a'), vid('v')])).toEqual(['a'])
  })
  it('conserva el orden original', () => {
    expect(prunePinned(['b', 'a'], [img('a'), img('b')])).toEqual(['b', 'a'])
  })
})

describe('pinnedBackgroundIds en el store', () => {
  it('setter acepta lista directa y updater funcional', () => {
    useProjectionStore.getState().setPinnedBackgroundIds(['a'])
    expect(useProjectionStore.getState().pinnedBackgroundIds).toEqual(['a'])
    useProjectionStore.getState().setPinnedBackgroundIds(prev => [...prev, 'b'])
    expect(useProjectionStore.getState().pinnedBackgroundIds).toEqual(['a', 'b'])
  })
})

describe('setMedia oculta la letra', () => {
  it('proyectar media oculta el texto y quitarla lo restaura', () => {
    const { setMedia } = useProjectionStore.getState()
    setMedia({ url: 'blob:anuncio', type: 'image', isBackgroundMode: true, name: 'anuncio' })
    expect(useProjectionStore.getState().state.hideText).toBe(true)
    setMedia(null)
    expect(useProjectionStore.getState().state.hideText).toBe(false)
  })
})
