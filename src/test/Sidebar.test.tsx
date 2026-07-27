import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stub localStorage before importing Sidebar (jsdom env here doesn't provide a functional one)
vi.hoisted(() => {
  const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
})

import Sidebar from '@/components/layout/Sidebar'

vi.mock('zustand/react/shallow', () => ({ useShallow: (s: any) => s }))

let state: any
vi.mock('@/stores', () => ({
  useAppStore: (selector: any) => selector(state),
}))

describe('Sidebar', () => {
  beforeEach(() => {
    state = {
      activeView: 'library',
      setActiveView: vi.fn(),
      openEditor: vi.fn(),
      toggleSidebar: vi.fn(),
      user: null,
      goToLanding: vi.fn(),
      language: 'es',
    }
  })

  it('muestra Temporizador y Avisos, no "Notas y más"', () => {
    render(<Sidebar />)
    expect(screen.getByText('Temporizador')).toBeInTheDocument()
    expect(screen.getByText('Avisos')).toBeInTheDocument()
    expect(screen.queryByText('Notas y más')).not.toBeInTheDocument()
  })
})
