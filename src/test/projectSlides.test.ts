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

import { useProjectionStore } from '@/stores'
import type { Slide } from '@/types'

describe('projectSlides normaliza el estado de proyección', () => {
  it('limpia el media/anuncio y muestra el texto al proyectar asistencia', () => {
    // Simula un anuncio (media) activo que oculta el texto (bug reportado)
    useProjectionStore.getState().setMedia({ url: 'blob:anuncio', type: 'image', isBackgroundMode: true, name: 'anuncio' })
    expect(useProjectionStore.getState().state.hideText).toBe(true)

    const slides: Slide[] = [{ index: 0, label: '', lines: ['Asistencia', 'Total  10'] }]
    useProjectionStore.getState().projectSlides('Asistencia', slides)

    const s = useProjectionStore.getState().state
    expect(s.media).toBeNull()
    expect(s.hideText).toBe(false)
    expect(s.songTitle).toBe('Asistencia')
    expect(s.slides).toEqual(slides)
    expect(s.currentSlide).toBe(0)
    expect(s.isBible).toBe(false)
  })
})
