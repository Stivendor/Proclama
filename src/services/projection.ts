import type { BroadcastMessage, ProjectionState, CountdownState, TickerState } from '@/types'

export const CHANNEL_NAME = 'proclama-projection'

/** Nombre de la ventana de proyección: window.open lo reutiliza en vez de abrir otra. */
export const PROJECTION_WINDOW_NAME = 'proclama-projection'

let channel: BroadcastChannel | null = null

export function getChannel(): BroadcastChannel {
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

export function sendProjectionUpdate(state: ProjectionState) {
  getChannel().postMessage({ type: 'PROJECTION_UPDATE', payload: state } satisfies BroadcastMessage)
}

export function sendCountdownUpdate(state: CountdownState) {
  getChannel().postMessage({ type: 'COUNTDOWN_UPDATE', payload: state } satisfies BroadcastMessage)
}

export function sendTickerUpdate(state: TickerState) {
  getChannel().postMessage({ type: 'TICKER_UPDATE', payload: state } satisfies BroadcastMessage)
}

export function sendSlideCommand(cmd: 'NEXT_SLIDE' | 'PREV_SLIDE') {
  getChannel().postMessage({ type: cmd } satisfies BroadcastMessage)
}

export function sendGoToSlide(index: number) {
  getChannel().postMessage({ type: 'GO_TO_SLIDE', payload: index } satisfies BroadcastMessage)
}



export function sendMediaCommand(action: 'play' | 'pause' | 'seek', value?: number) {
  getChannel().postMessage({ type: 'MEDIA_COMMAND', payload: { action, value } } satisfies BroadcastMessage)
}

export function sendMediaStatus(currentTime: number, duration: number, isPlaying: boolean) {
  getChannel().postMessage({ type: 'MEDIA_STATUS', payload: { currentTime, duration, isPlaying } } satisfies BroadcastMessage)
}

export function onMessage(handler: (msg: BroadcastMessage) => void): () => void {
  const ch = getChannel()
  const listener = (e: MessageEvent) => handler(e.data as BroadcastMessage)
  ch.addEventListener('message', listener)
  return () => ch.removeEventListener('message', listener)
}

/**
 * Abre la ventana de proyección en el segundo monitor.
 * El operador debe moverla manualmente si no hay API de Window Management.
 */
export function openProjectionWindow(): Window | null {
  const w = window.open(
    '/projection',
    PROJECTION_WINDOW_NAME,
    'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,scrollbars=no'
  )
  return w
}

/**
 * Trae al frente la ventana de proyección que ya está abierta.
 *
 * `w.focus()` a secas no basta: Chrome lo ignora sobre una ventana en segundo
 * plano, así que el operador pulsaba el atajo y no pasaba nada. `window.open`
 * con URL vacía reutiliza la ventana que tiene ese nombre y la levanta SIN
 * re-navegarla, de modo que lo proyectado sigue intacto en la pantalla.
 */
export function focusProjectionWindow(existing: Window | null): Window | null {
  const w = window.open('', PROJECTION_WINDOW_NAME) ?? existing
  w?.focus()
  return w
}

/**
 * Returns a promise that resolves when the projection window is ready.
 *
 * - If the window reference is valid → resolves immediately.
 * - Otherwise probes via PING/PONG on the BroadcastChannel (up to 1s).
 * - If the window is alive (PONG received) → resolves without calling
 *   `window.open`, so the existing window stays on the TV / projector.
 * - Only calls `window.open` if no PONG arrives, then waits for the new
 *   window to mount.
 */
export function ensureProjectionReady(existingWindow: Window | null): Promise<Window | null> {
  if (existingWindow && !existingWindow.closed) return Promise.resolve(null)

  const ch = getChannel()

  function waitForPong(timeout: number, interval: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let attempts = 0
      const max = Math.ceil(timeout / interval)
      let done = false

      const listener = (e: MessageEvent) => {
        if (e.data.type === 'PONG' && !done) {
          done = true
          ch.removeEventListener('message', listener)
          resolve(true)
        }
      }
      ch.addEventListener('message', listener)

      const ping = () => {
        if (done) return
        ch.postMessage({ type: 'PING' })
        attempts++
        if (attempts < max) {
          setTimeout(ping, interval)
        } else {
          done = true
          ch.removeEventListener('message', listener)
          resolve(false)
        }
      }
      ping()
    })
  }

  // 1) Quick probe: is the window alive? (~1s)
  return waitForPong(1000, 100).then((alive) => {
    if (alive) return null

    // 2) Not alive — open a new window
    const w = window.open(
      '/projection',
      'proclama-projection',
      'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,scrollbars=no'
    )
    if (!w || w.closed) return null

    // 3) Wait for the new window to mount (~4s max)
    return waitForPong(4000, 200).then(() => w)
  })
}
