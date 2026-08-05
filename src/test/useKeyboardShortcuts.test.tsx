import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('zustand/react/shallow', () => ({ useShallow: (s: any) => s }))

let projection: any
let app: any

vi.mock('@/stores', () => ({
  useProjectionStore: (selector: any) => selector(projection),
  useAppStore: Object.assign((selector: any) => selector(app), { getState: () => app }),
}))

const openProjectionWindow = vi.fn()
vi.mock('@/services/projection', () => ({ openProjectionWindow: () => openProjectionWindow() }))

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

const press = (init: KeyboardEventInit & { target?: Element }) => {
  const { target, ...rest } = init
  act(() => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...rest })
    ;(target ?? window).dispatchEvent(event)
  })
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    openProjectionWindow.mockClear()
    projection = {
      nextSlide: vi.fn(),
      prevSlide: vi.fn(),
      setHideText: vi.fn(),
      state: { hideText: false, isBible: false },
    }
    app = {
      activeView: 'library',
      setActiveView: vi.fn(),
      openEditor: vi.fn(),
    }
  })

  it('Alt+3 va a la vista Biblia', () => {
    renderHook(() => useKeyboardShortcuts())
    press({ code: 'Digit3', altKey: true })
    expect(app.setActiveView).toHaveBeenCalledWith('bible')
  })

  it('Alt+B oculta el texto', () => {
    renderHook(() => useKeyboardShortcuts())
    press({ code: 'KeyB', altKey: true })
    expect(projection.setHideText).toHaveBeenCalledWith(true)
  })

  it('Alt+P abre la ventana de proyección', () => {
    renderHook(() => useKeyboardShortcuts())
    press({ code: 'KeyP', altKey: true })
    expect(openProjectionWindow).toHaveBeenCalledOnce()
  })

  it('Alt+N abre el editor de canción nueva', () => {
    renderHook(() => useKeyboardShortcuts())
    press({ code: 'KeyN', altKey: true })
    expect(app.openEditor).toHaveBeenCalledOnce()
  })

  it('la flecha derecha pasa de slide', () => {
    renderHook(() => useKeyboardShortcuts())
    press({ key: 'ArrowRight' })
    expect(projection.nextSlide).toHaveBeenCalledOnce()
  })

  it('no dispara nada con el foco en un input', () => {
    renderHook(() => useKeyboardShortcuts())
    const input = document.createElement('input')
    document.body.appendChild(input)
    press({ key: 'ArrowRight', target: input })
    press({ code: 'Digit3', altKey: true, target: input })
    expect(projection.nextSlide).not.toHaveBeenCalled()
    expect(app.setActiveView).not.toHaveBeenCalled()
    input.remove()
  })

  it('en Biblia con un versículo proyectado cede las flechas a BibleView', () => {
    app.activeView = 'bible'
    projection.state.isBible = true
    renderHook(() => useKeyboardShortcuts())
    press({ key: 'ArrowRight' })
    press({ key: ' ' })
    expect(projection.nextSlide).not.toHaveBeenCalled()
  })

  it('en Biblia la T no oculta el texto (es del buscador rápido)', () => {
    app.activeView = 'bible'
    renderHook(() => useKeyboardShortcuts())
    press({ key: 't' })
    expect(projection.setHideText).not.toHaveBeenCalled()
  })

  it('? abre y cierra la lista de atajos', () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    expect(result.current.shortcutsOpen).toBe(false)
    press({ key: '?' })
    expect(result.current.shortcutsOpen).toBe(true)
    act(() => result.current.closeShortcuts())
    expect(result.current.shortcutsOpen).toBe(false)
  })

  it('con el modal de atajos abierto, Escape solo lo cierra y no revela el texto', () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    press({ key: '?' })
    expect(result.current.shortcutsOpen).toBe(true)
    press({ key: 'Escape' })
    expect(result.current.shortcutsOpen).toBe(false)
    expect(projection.setHideText).not.toHaveBeenCalled()
  })

  it('con el modal cerrado, Escape vuelve a mostrar el texto', () => {
    renderHook(() => useKeyboardShortcuts())
    press({ key: 'Escape' })
    expect(projection.setHideText).toHaveBeenCalledWith(false)
  })
})
