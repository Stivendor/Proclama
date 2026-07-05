import type { LocalMedia } from '@/types'

/** Agrega o quita un id de la lista de fondos fijados al recuadro. */
export function togglePinned(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(p => p !== id) : [...ids, id]
}

/** Depura ids fijados que ya no existen como imagen en la media local. */
export function prunePinned(ids: string[], list: LocalMedia[]): string[] {
  return ids.filter(id => list.some(m => m.id === id && m.type === 'image'))
}
