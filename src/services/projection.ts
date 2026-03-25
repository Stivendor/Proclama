import type { BroadcastMessage, ProjectionState, CountdownState } from '@/types'

export const CHANNEL_NAME = 'proclama-projection'

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
    'proclama-projection',
    'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no,scrollbars=no'
  )
  return w
}
