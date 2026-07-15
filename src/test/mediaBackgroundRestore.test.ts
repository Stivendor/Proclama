import { describe, expect, it, beforeEach, vi } from 'vitest'

// El persist de zustand captura localStorage al importar el store: stub ANTES del import
vi.hoisted(() => {
  const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
})

import { useProjectionStore } from '@/stores'

const song = { id: 1, title: 't', artist: '', lyrics: 'linea a\nlinea b\n\nlinea c\nlinea d' } as any
const anuncio = { url: 'blob:anuncio', type: 'image', isBackgroundMode: true, name: 'x' } as any

describe('anuncio temporal + el fondo elegido persiste al navegar', () => {
  beforeEach(() => {
    const s = useProjectionStore.getState()
    s.setDefaultBackgroundMediaId(null)
    s.setLocalMediaList([])
    s.setMedia(null)
    s.updateTheme({ backgroundType: 'color', background: '#000', backgroundImageUrl: '', backgroundVideoUrl: '' })
  })

  it('con favorito fijado, elegir video lo desactiva y el video persiste al navegar', () => {
    const store = useProjectionStore.getState()
    // Favorito de letra fijado (imagen local)
    store.setLocalMediaList([{ id: 'fav1', url: 'blob:fav', type: 'image', name: 'f', size: 0, createdAt: 0 }] as any)
    store.setDefaultBackgroundMediaId('fav1')
    store.updateTheme({ backgroundType: 'image', backgroundImageUrl: 'blob:fav' })

    // El usuario elige un video de la galería (FondosView)
    store.updateTheme({ backgroundType: 'video', backgroundVideoUrl: 'https://cdn/video.mp4' })
    expect(useProjectionStore.getState().defaultBackgroundMediaId).toBeNull()

    // Presenta, pone un anuncio y navega slide
    store.loadSong(song, false, 0)
    store.setMedia(anuncio)
    store.nextSlide()

    const st = useProjectionStore.getState().state
    expect(st.media).toBeNull()                    // el anuncio se quita al navegar
    expect(st.theme.backgroundType).toBe('video')  // el video elegido no se pierde
    expect(st.theme.backgroundVideoUrl).toBe('https://cdn/video.mp4')
  })

  it('sin favorito, el anuncio se limpia al navegar (no queda letra sobre la imagen)', () => {
    const store = useProjectionStore.getState()
    store.updateTheme({ backgroundType: 'video', backgroundVideoUrl: 'https://cdn/v2.mp4' })
    store.loadSong(song, false, 0)
    store.setMedia({ ...anuncio, url: 'blob:anuncio2' })
    store.nextSlide()

    const st = useProjectionStore.getState().state
    expect(st.media).toBeNull()
    expect(st.theme.backgroundType).toBe('video')
  })

  it('activar el favorito NO lo desactiva (updateTheme con la misma url del favorito)', () => {
    const store = useProjectionStore.getState()
    store.setLocalMediaList([{ id: 'fav1', url: 'blob:fav', type: 'image', name: 'f', size: 0, createdAt: 0 }] as any)
    store.setDefaultBackgroundMediaId('fav1')
    store.updateTheme({ backgroundType: 'image', backgroundImageUrl: 'blob:fav' })
    expect(useProjectionStore.getState().defaultBackgroundMediaId).toBe('fav1')
  })
})
