import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

vi.mock('zustand/react/shallow', () => ({ useShallow: (s: any) => s }))

interface ProjectionMock {
  nextSlide: () => void
  prevSlide: () => void
  setHideText: (v: boolean) => void
  state: { hideText: boolean; isBible: boolean }
  projectionWindow: Window | null
  setProjectionWindow: (w: Window | null) => void
}

interface AppMock {
  activeView: string
  setActiveView: (v: string) => void
  openEditor: () => void
  shortcutsOpen: boolean
  setShortcutsOpen: (v: boolean | ((prev: boolean) => boolean)) => void
}

let useProjectionStoreMock: UseBoundStore<StoreApi<ProjectionMock>>
let useAppStoreMock: UseBoundStore<StoreApi<AppMock>>
// Snapshots tomados justo tras crear el store: las funciones (acciones/mocks)
// no cambian de identidad entre renders, así que sirven para las aserciones.
let projection: ProjectionMock
let app: AppMock

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
    useProjectionStoreMock = create<ProjectionMock>()((set) => ({
      nextSlide: vi.fn(),
      prevSlide: vi.fn(),
      setHideText: vi.fn(),
      state: { hideText: false, isBible: false },
      projectionWindow: null,
      setProjectionWindow: (w) => set({ projectionWindow: w }),
    }))
    useAppStoreMock = create<AppMock>()((set) => ({
      activeView: 'library',
      setActiveView: vi.fn(),
      openEditor: vi.fn(),
      shortcutsOpen: false,
      setShortcutsOpen: (v) => set(s => ({
        shortcutsOpen: typeof v === 'function' ? (v as (prev: boolean) => boolean)(s.shortcutsOpen) : v
      })),
    }))
    projection = useProjectionStoreMock.getState()
    app = useAppStoreMock.getState()
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

  // Alt+P se retiró: el navegador no trae al frente de forma fiable una ventana
  // en segundo plano, así que el atajo parecía muerto y confundía al operador.
  it('Alt+P no hace nada: la proyección se abre con su botón', () => {
    const liveWindow = { closed: false, focus: vi.fn() } as unknown as Window
    useProjectionStoreMock.setState({ projectionWindow: liveWindow })
    renderHook(() => useKeyboardShortcuts())
    press({ code: 'KeyP', altKey: true })
    expect(liveWindow.focus).not.toHaveBeenCalled()
    expect(useProjectionStoreMock.getState().projectionWindow).toBe(liveWindow)
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
    useAppStoreMock.setState({ activeView: 'bible' })
    useProjectionStoreMock.setState(s => ({ state: { ...s.state, isBible: true } }))
    renderHook(() => useKeyboardShortcuts())
    press({ key: 'ArrowRight' })
    press({ key: ' ' })
    expect(projection.nextSlide).not.toHaveBeenCalled()
  })

  it('en Biblia la T no oculta el texto (es del buscador rápido)', () => {
    useAppStoreMock.setState({ activeView: 'bible' })
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

  it('con el modal de atajos abierto, ArrowRight no cambia el slide proyectado', () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    press({ key: '?' })
    expect(result.current.shortcutsOpen).toBe(true)
    press({ key: 'ArrowRight' })
    press({ key: 'ArrowDown' })
    expect(projection.nextSlide).not.toHaveBeenCalled()
  })

  it('con el modal de atajos abierto, Alt+B sigue ocultando el texto', () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    press({ key: '?' })
    expect(result.current.shortcutsOpen).toBe(true)
    press({ code: 'KeyB', altKey: true })
    expect(projection.setHideText).toHaveBeenCalledWith(true)
  })
})
