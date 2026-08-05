/**
 * Orden canónico de las vistas del menú lateral.
 * Alt+1..Alt+8 mapea a este orden (ver src/hooks/useKeyboardShortcuts.ts),
 * así que agregar una vista acá le da su atajo automáticamente.
 */
export const NAV_ORDER = [
  'library',
  'setlists',
  'bible',
  'timer',
  'notices',
  'notes',
  'fondos',
  'settings',
] as const

export type NavView = (typeof NAV_ORDER)[number]
