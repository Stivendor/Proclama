import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import AppErrorBoundary from '@/components/ui/AppErrorBoundary'

function Boom(): never {
  throw new Error('Cannot read properties of undefined (reading \'toLowerCase\')')
}

// React imprime el stack del error por console.error: aquí es esperado.
// Igual, jsdom reporta como "uncaught" el ErrorEvent que React despacha para
// capturar errores de render: se cancela para no ensuciar la salida del suite.
let consoleError: ReturnType<typeof vi.spyOn>
const swallowWindowError = (e: ErrorEvent) => e.preventDefault()

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  window.addEventListener('error', swallowWindowError)
})

afterEach(() => {
  window.removeEventListener('error', swallowWindowError)
  consoleError.mockRestore()
  cleanup()
})

describe('AppErrorBoundary', () => {
  it('renderiza a sus hijos cuando no hay error', () => {
    render(
      <AppErrorBoundary>
        <div>contenido normal</div>
      </AppErrorBoundary>
    )

    expect(screen.getByText('contenido normal')).toBeTruthy()
  })

  it('ante un error de render muestra un aviso con el mensaje, no pantalla negra', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>
    )

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Algo salió mal en Proclama')).toBeTruthy()
    expect(screen.getByText(/Cannot read properties of undefined/)).toBeTruthy()
    expect(screen.queryByText('contenido normal')).toBeNull()
  })

  it('permite reintentar y seguir funcionando si el fallo ya no se reproduce', () => {
    // Falla sólo la primera vez: simula un error puntual de render/red.
    let shouldThrow = true
    function Flaky(): JSX.Element {
      if (shouldThrow) throw new Error('fallo puntual')
      return <div>contenido recuperado</div>
    }

    render(
      <AppErrorBoundary>
        <Flaky />
      </AppErrorBoundary>
    )
    expect(screen.getByRole('alert')).toBeTruthy()

    shouldThrow = false
    fireEvent.click(screen.getByText('Intentar de nuevo'))

    expect(screen.getByText('contenido recuperado')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
