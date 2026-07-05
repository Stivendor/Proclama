import { describe, expect, it } from 'vitest'
import { togglePinned, prunePinned } from '@/utils/backgroundShelf'
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
