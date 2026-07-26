import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stub localStorage before importing NoticesView
vi.hoisted(() => {
  const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
})

import NoticesView from '@/pages/NoticesView'

vi.mock('zustand/react/shallow', () => ({
  useShallow: (selector: any) => selector,
}))

let appState: any
let projState: any

vi.mock('@/stores', () => ({
  useAppStore: (selector: any) => selector(appState),
  useProjectionStore: (selector: any) => selector(projState),
}))

vi.mock('@/features/notices/useNotices', () => ({
  useNotices: () => ({
    notices: [{ id: '1', text: 'Reunión de jóvenes el viernes' }],
    add: vi.fn(), update: vi.fn(), remove: vi.fn(),
  }),
}))

vi.mock('@/services/projection', () => ({
  openProjectionWindow: vi.fn(),
  sendTickerUpdate: vi.fn(),
  onMessage: () => () => {},
}))

describe('NoticesView', () => {
  beforeEach(() => {
    appState = { isSidebarOpen: true, toggleSidebar: vi.fn() }
    projState = {
      loadSong: vi.fn(),
      state: { songTitle: '', slides: [] },
      projectionWindow: null,
      setProjectionWindow: vi.fn(),
    }
  })

  it('muestra el aviso y la etiqueta "Pantalla completa"', () => {
    render(<NoticesView />)
    expect(screen.getByText('Reunión de jóvenes el viernes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pantalla completa/i })).toBeInTheDocument()
  })

  it('explica la banda deslizante en el microcopy', () => {
    render(<NoticesView />)
    expect(screen.getByText(/sin interrumpir la proyección/i)).toBeInTheDocument()
  })
})
