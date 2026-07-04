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

import { useAppStore } from '@/stores'

describe('editorOnSaved (crear canción desde setlist)', () => {
  it('registra el callback y closeEditor lo limpia', () => {
    const cb = vi.fn()
    useAppStore.getState().setEditorOnSaved(cb)
    expect(useAppStore.getState().editorOnSaved).toBe(cb)

    useAppStore.getState().closeEditor()
    expect(useAppStore.getState().editorOnSaved).toBeNull()
  })

  it('el callback recibe el id local al invocarse', () => {
    const cb = vi.fn()
    useAppStore.getState().setEditorOnSaved(cb)

    // Simula lo que hace SongEditorModal tras db.songs.add
    useAppStore.getState().editorOnSaved?.(42)
    expect(cb).toHaveBeenCalledWith(42)
  })

  it('openEditor no borra un callback ya registrado (se registra antes de abrir)', () => {
    const cb = vi.fn()
    useAppStore.getState().setEditorOnSaved(cb)
    useAppStore.getState().openEditor(null)
    expect(useAppStore.getState().editorOnSaved).toBe(cb)
    useAppStore.getState().closeEditor()
  })
})
