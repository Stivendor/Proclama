# Atajos de teclado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a Proclama atajos de teclado de navegación y acción, y hacer que en la vista Biblia las flechas proyecten el versículo siguiente/anterior.

**Architecture:** El hook global `useKeyboardShortcuts` (ya montado una vez en `MainApp`) concentra los atajos globales y cede las flechas a `BibleView` cuando hay un versículo proyectado. `BibleView` registra su propio listener y reutiliza su `projectVerse()` para avanzar de versículo, incluso cruzando de capítulo. Un `ShortcutsModal` lista los atajos y se abre con `?`.

**Tech Stack:** React 18 + TypeScript, Zustand (`useAppStore`, `useProjectionStore`), Vitest + jsdom + @testing-library/react 16 (`renderHook`), Dexie para el caché de capítulos vía `fetchChapter`.

Spec: `docs/superpowers/specs/2026-08-05-atajos-de-teclado-design.md`.

## Global Constraints

- Usar **pnpm**, nunca npm (un `package-lock.json` rompe el build de Vercel).
- Tests unitarios sólo en `src/**/*.{test,spec}.{ts,tsx}`; `tests/` es exclusivo de Playwright.
- No hay lint; el chequeo de tipos es `pnpm tsc --noEmit`.
- UI en español; los identificadores de código en inglés, como el resto del repo.
- Ningún atajo debe dispararse cuando el foco está en `INPUT`, `TEXTAREA` o `SELECT`.
- Dentro de la vista Biblia las teclas de letra pertenecen a la búsqueda rápida: los atajos de letra suelta (`T`) no actúan ahí. Los atajos con `Alt` funcionan en todas las vistas.
- Estilos: CSS plano, sin framework. Los modales usan las clases `modal-overlay` y `modal` de `src/index.css`.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/constants/nav.ts` (nuevo) | `NAV_ORDER`: orden canónico de las vistas del menú. Lo consumen el Sidebar y los atajos `Alt+n`. |
| `src/components/layout/Sidebar.tsx` (modificar) | Renderiza el menú a partir de `NAV_ORDER` + un mapa local de ícono/label. |
| `src/hooks/useKeyboardShortcuts.ts` (modificar) | Todos los atajos globales; devuelve el estado del modal de ayuda. |
| `src/components/ui/ShortcutsModal.tsx` (nuevo) | Modal con la lista de atajos. |
| `src/App.tsx` (modificar) | Renderiza el modal con lo que devuelve el hook. |
| `src/pages/BibleView.tsx` (modificar) | `stepVerse(dir)` + listener de teclas que proyecta el versículo vecino. |
| `src/test/useKeyboardShortcuts.test.tsx` (nuevo) | Cubre el hook: cambio de vista, negro, guarda de inputs, cesión en Biblia. |
| `src/test/bibleStepVerse.test.ts` (nuevo) | Cubre la función pura que decide a qué versículo/capítulo saltar. |

---

### Task 1: Orden de navegación compartido

Extrae el orden de las vistas a una constante para que `Alt+n` y el menú lateral no se desincronicen.

**Files:**
- Create: `src/constants/nav.ts`
- Modify: `src/components/layout/Sidebar.tsx:29-38` (el array `nav` dentro del componente) y `src/components/layout/Sidebar.tsx:90` (el `.map`)
- Test: `src/test/Sidebar.test.tsx` (ya existe; sirve de red — no se modifica)

**Interfaces:**
- Consumes: nada.
- Produces: `NAV_ORDER: readonly ['library','setlists','bible','timer','notices','notes','fondos','settings']` y `type NavView = typeof NAV_ORDER[number]`, exportados desde `@/constants/nav`.

- [ ] **Step 1: Crear la constante**

`src/constants/nav.ts`:

```ts
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
```

- [ ] **Step 2: Que el Sidebar use la constante**

En `src/components/layout/Sidebar.tsx`, agregar a los imports:

```ts
import { NAV_ORDER, type NavView } from '@/constants/nav'
import type { LucideIcon } from 'lucide-react'
```

Reemplazar el array `nav` (líneas 29-38, dentro del componente) por un mapa a nivel de módulo — ponerlo arriba del `export default function Sidebar()`:

```ts
const NAV_META: Record<NavView, { icon: LucideIcon; labelKey: string }> = {
  library: { icon: Library, labelKey: 'sidebar.songs' },
  setlists: { icon: List, labelKey: 'sidebar.setlists' },
  bible: { icon: BookIcon, labelKey: 'sidebar.bible' },
  timer: { icon: Timer, labelKey: 'sidebar.timer' },
  notices: { icon: Megaphone, labelKey: 'sidebar.notices' },
  notes: { icon: Users, labelKey: 'sidebar.notes' },
  fondos: { icon: Image, labelKey: 'sidebar.fondos' },
  settings: { icon: Settings, labelKey: 'sidebar.settings' },
}
```

Y dentro del componente, donde estaban `nav` y `visibleNav`:

```ts
  const visibleNav = NAV_ORDER.map(id => ({ id, ...NAV_META[id] }))
```

En el `.map` del `<nav>` (línea 90), cambiar la desestructuración para usar `labelKey`:

```tsx
        {visibleNav.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            className={`nav-item ${activeView === id ? 'active' : ''}`}
            onClick={() => setActiveView(id)}
            aria-current={activeView === id ? 'page' : undefined}
          >
            <Icon size={18} />
            {t(language, labelKey)}
          </button>
        ))}
```

Nota: el filtro `!('adminOnly' in item)` que había en `visibleNav` no filtraba nada (ningún item tenía esa propiedad) y desaparece; el enlace de admin sigue siendo el bloque aparte de las líneas 101-106.

- [ ] **Step 3: Verificar que el menú no cambió**

Run: `pnpm vitest --run src/test/Sidebar.test.tsx`
Expected: PASS (sigue encontrando "Temporizador" y "Avisos", y no "Notas y más").

- [ ] **Step 4: Chequear tipos**

Run: `pnpm tsc --noEmit`
Expected: sin salida.

- [ ] **Step 5: Commit**

```bash
git add src/constants/nav.ts src/components/layout/Sidebar.tsx
git commit -m "refactor(nav): orden de vistas compartido en NAV_ORDER"
```

---

### Task 2: Atajos globales en el hook

**Files:**
- Modify: `src/hooks/useKeyboardShortcuts.ts` (archivo completo, hoy 46 líneas)
- Test: `src/test/useKeyboardShortcuts.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `NAV_ORDER` de `@/constants/nav`; `openProjectionWindow()` de `@/services/projection`; del store `useAppStore.getState()` → `{ activeView, setActiveView, openEditor }`, y de `useProjectionStore` → `{ nextSlide, prevSlide, setHideText, state.hideText, state.isBible }`.
- Produces: `useKeyboardShortcuts(): { shortcutsOpen: boolean; closeShortcuts: () => void }`.

- [ ] **Step 1: Escribir el test que falla**

`src/test/useKeyboardShortcuts.test.tsx`:

```tsx
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

  it('Alt+B alterna la pantalla en negro', () => {
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
})
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `pnpm vitest --run src/test/useKeyboardShortcuts.test.tsx`
Expected: FAIL — el hook actual no acepta `Alt+…`, no devuelve `shortcutsOpen` (será `undefined`) y sigue llamando `nextSlide` en Biblia.

- [ ] **Step 3: Reescribir el hook**

`src/hooks/useKeyboardShortcuts.ts` completo:

```ts
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import { openProjectionWindow } from '@/services/projection'
import { NAV_ORDER } from '@/constants/nav'

/** Teclas que avanzan (incluye las que mandan los controles de presentación). */
const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' ']
const PREV_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp']

export function useKeyboardShortcuts() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const { nextSlide, prevSlide, setHideText, hideText, isBible } = useProjectionStore(useShallow(s => ({
    nextSlide: s.nextSlide,
    prevSlide: s.prevSlide,
    setHideText: s.setHideText,
    hideText: s.state.hideText,
    isBible: s.state.isBible,
  })))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // No activar si el foco está en un input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const app = useAppStore.getState()

      if (e.altKey) {
        const digit = /^Digit([1-8])$/.exec(e.code)
        if (digit) {
          e.preventDefault()
          app.setActiveView(NAV_ORDER[Number(digit[1]) - 1])
          return
        }
        switch (e.code) {
          case 'KeyP':
            e.preventDefault()
            openProjectionWindow()
            return
          case 'KeyN':
            e.preventDefault()
            app.openEditor()
            return
          case 'KeyB':
            e.preventDefault()
            setHideText(!hideText)
            return
        }
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(v => !v)
        return
      }

      // En la vista Biblia las letras son del buscador rápido, y con un versículo
      // proyectado las flechas las maneja BibleView (avanzan versículo, no slide).
      const inBible = app.activeView === 'bible'
      if (inBible && isBible && (NEXT_KEYS.includes(e.key) || PREV_KEYS.includes(e.key))) return

      if (NEXT_KEYS.includes(e.key)) {
        e.preventDefault()
        nextSlide()
        return
      }
      if (PREV_KEYS.includes(e.key)) {
        e.preventDefault()
        prevSlide()
        return
      }

      switch (e.key) {
        case 't':
        case 'T':
          if (inBible) return
          setHideText(!hideText)
          break
        case 'Escape':
          setShortcutsOpen(false)
          setHideText(false)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextSlide, prevSlide, setHideText, hideText, isBible])

  return { shortcutsOpen, closeShortcuts: () => setShortcutsOpen(false) }
}
```

- [ ] **Step 4: Correr el test hasta verde**

Run: `pnpm vitest --run src/test/useKeyboardShortcuts.test.tsx`
Expected: PASS, 9 tests.

- [ ] **Step 5: Chequear tipos y suite completa**

Run: `pnpm tsc --noEmit; pnpm test`
Expected: sin errores de tipos; 30 archivos de test en verde.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/test/useKeyboardShortcuts.test.tsx
git commit -m "feat(atajos): navegacion Alt+n, Alt+P, Alt+N, Alt+B y ayuda con ?"
```

---

### Task 3: Modal con la lista de atajos

**Files:**
- Create: `src/components/ui/ShortcutsModal.tsx`
- Modify: `src/App.tsx:179` (la llamada a `useKeyboardShortcuts`) y el JSX de `MainApp` (`src/App.tsx:218-223`)

**Interfaces:**
- Consumes: `{ shortcutsOpen, closeShortcuts }` de `useKeyboardShortcuts()` (Task 2).
- Produces: `default export function ShortcutsModal({ onClose }: { onClose: () => void })`.

- [ ] **Step 1: Crear el modal**

`src/components/ui/ShortcutsModal.tsx`:

```tsx
import { useEffect } from 'react'
import { Keyboard, X } from 'lucide-react'

/** Mantener sincronizado con el switch de src/hooks/useKeyboardShortcuts.ts */
const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Navegación',
    items: [
      ['Alt + 1…8', 'Ir a Canciones, Setlists, Biblia, Temporizador, Avisos, Notas, Fondos, Ajustes'],
      ['Alt + N', 'Nueva canción'],
      ['?', 'Mostrar u ocultar esta lista'],
    ],
  },
  {
    title: 'Proyección',
    items: [
      ['Alt + P', 'Abrir la ventana de proyección'],
      ['→ ↓ Espacio PageDown', 'Slide siguiente'],
      ['← ↑ PageUp', 'Slide anterior'],
      ['Alt + B', 'Pantalla en negro'],
      ['T', 'Ocultar el texto (fuera de la Biblia)'],
      ['Esc', 'Volver a mostrar el texto'],
    ],
  },
  {
    title: 'Biblia',
    items: [
      ['→ Espacio PageDown', 'Proyectar el versículo siguiente'],
      ['← PageUp', 'Proyectar el versículo anterior'],
      ['Cualquier letra', 'Abrir la búsqueda rápida de pasaje'],
    ],
  },
]

export default function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2><Keyboard size={18} /> Atajos de teclado</h2>
          <button className="btn-icon" onClick={onClose} title="Cerrar"><X size={16} /></button>
        </div>
        <div className="shortcuts-body">
          {GROUPS.map(group => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.items.map(([keys, description]) => (
                  <div key={keys} className="shortcuts-row">
                    <dt><kbd>{keys}</kbd></dt>
                    <dd>{description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="shortcuts-foot">Los atajos no actúan mientras escribes en un campo de texto.</p>
      </div>
      <style>{`
        .shortcuts-modal { max-width: 560px; width: 100%; }
        .shortcuts-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
        .shortcuts-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; }
        .shortcuts-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 18px; max-height: 60vh; overflow-y: auto; }
        .shortcuts-body h3 { margin: 0 0 8px; font-size: 11px; letter-spacing: 1px; color: var(--text-muted); text-transform: uppercase; }
        .shortcuts-body dl { margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .shortcuts-row { display: flex; align-items: baseline; gap: 12px; }
        .shortcuts-row dt { flex: 0 0 190px; }
        .shortcuts-row dd { margin: 0; font-size: 13px; color: var(--text-muted); }
        .shortcuts-modal kbd {
          font-family: inherit; font-size: 11px; font-weight: 600;
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: 6px; padding: 3px 8px; white-space: nowrap;
        }
        .shortcuts-foot { margin: 0; padding: 12px 20px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text-muted); }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Montarlo en la app**

En `src/App.tsx`, agregar el lazy import junto a los otros (arriba, donde están `Toast` y compañía):

```ts
const ShortcutsModal = lazy(() => import("@/components/ui/ShortcutsModal"));
```

Y en `MainApp`, cambiar la línea 179 y agregar el render antes del `<Toast />`:

```tsx
  const { shortcutsOpen, closeShortcuts } = useKeyboardShortcuts();
```

```tsx
      {shortcutsOpen && (
        <Suspense fallback={null}>
          <ShortcutsModal onClose={closeShortcuts} />
        </Suspense>
      )}
```

- [ ] **Step 3: Chequear tipos**

Run: `pnpm tsc --noEmit`
Expected: sin salida.

- [ ] **Step 4: Probar a mano**

Run: `pnpm dev`
Expected: con la app abierta y el foco fuera de un campo de texto, `?` abre el modal; `Esc`, la X y el clic fuera lo cierran; `Alt+3` lleva a la Biblia.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ShortcutsModal.tsx src/App.tsx
git commit -m "feat(atajos): modal de ayuda con la lista de atajos"
```

---

### Task 4: Decidir el salto de versículo (función pura)

Aísla la parte con lógica de bordes para poder probarla sin fetch ni React.

**Files:**
- Create: `src/utils/verseStep.ts`
- Test: `src/test/bibleStepVerse.test.ts` (nuevo)

**Interfaces:**
- Consumes: nada.
- Produces:

```ts
export type VerseStep =
  | { kind: 'same-chapter'; index: number }
  | { kind: 'other-chapter'; chapter: number; edge: 'first' | 'last' }
  | { kind: 'none' }

export function planVerseStep(args: {
  currentIndex: number      // índice del versículo proyectado dentro del capítulo, -1 si no se encontró
  verseCount: number        // versículos del capítulo cargado
  chapter: number           // capítulo actual (1-based)
  chapterCount: number      // capítulos del libro
  dir: 1 | -1
}): VerseStep
```

- [ ] **Step 1: Escribir el test que falla**

`src/test/bibleStepVerse.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { planVerseStep } from '@/utils/verseStep'

const base = { verseCount: 36, chapter: 3, chapterCount: 21, dir: 1 as 1 | -1 }

describe('planVerseStep', () => {
  it('avanza dentro del capítulo', () => {
    expect(planVerseStep({ ...base, currentIndex: 15 })).toEqual({ kind: 'same-chapter', index: 16 })
  })

  it('retrocede dentro del capítulo', () => {
    expect(planVerseStep({ ...base, currentIndex: 15, dir: -1 })).toEqual({ kind: 'same-chapter', index: 14 })
  })

  it('pasa al primer versículo del capítulo siguiente', () => {
    expect(planVerseStep({ ...base, currentIndex: 35 })).toEqual({
      kind: 'other-chapter', chapter: 4, edge: 'first',
    })
  })

  it('pasa al último versículo del capítulo anterior', () => {
    expect(planVerseStep({ ...base, currentIndex: 0, dir: -1 })).toEqual({
      kind: 'other-chapter', chapter: 2, edge: 'last',
    })
  })

  it('no salta de libro al final', () => {
    expect(planVerseStep({ ...base, currentIndex: 35, chapter: 21 })).toEqual({ kind: 'none' })
  })

  it('no salta de libro al principio', () => {
    expect(planVerseStep({ ...base, currentIndex: 0, chapter: 1, dir: -1 })).toEqual({ kind: 'none' })
  })

  it('no hace nada si no ubicó el versículo proyectado', () => {
    expect(planVerseStep({ ...base, currentIndex: -1 })).toEqual({ kind: 'none' })
  })
})
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `pnpm vitest --run src/test/bibleStepVerse.test.ts`
Expected: FAIL — no existe `@/utils/verseStep`.

- [ ] **Step 3: Implementar**

`src/utils/verseStep.ts`:

```ts
export type VerseStep =
  | { kind: 'same-chapter'; index: number }
  | { kind: 'other-chapter'; chapter: number; edge: 'first' | 'last' }
  | { kind: 'none' }

/**
 * Decide a qué versículo saltar al pulsar una flecha en la Biblia.
 * No salta de libro: en el borde del libro devuelve 'none'.
 */
export function planVerseStep({
  currentIndex,
  verseCount,
  chapter,
  chapterCount,
  dir,
}: {
  currentIndex: number
  verseCount: number
  chapter: number
  chapterCount: number
  dir: 1 | -1
}): VerseStep {
  if (currentIndex < 0) return { kind: 'none' }

  const target = currentIndex + dir
  if (target >= 0 && target < verseCount) return { kind: 'same-chapter', index: target }

  const nextChapter = chapter + dir
  if (nextChapter < 1 || nextChapter > chapterCount) return { kind: 'none' }

  return { kind: 'other-chapter', chapter: nextChapter, edge: dir === 1 ? 'first' : 'last' }
}
```

- [ ] **Step 4: Correr el test hasta verde**

Run: `pnpm vitest --run src/test/bibleStepVerse.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/verseStep.ts src/test/bibleStepVerse.test.ts
git commit -m "feat(biblia): planVerseStep decide el salto de versiculo"
```

---

### Task 5: Flechas de versículo en BibleView

**Files:**
- Modify: `src/pages/BibleView.tsx` — imports (líneas 1-10), el selector del store (líneas 69-76) y un bloque nuevo justo después de `projectVerse` (línea 507)

**Interfaces:**
- Consumes: `planVerseStep` de `@/utils/verseStep` (Task 4); el hook global ya cede las teclas cuando `activeView === 'bible'` y `state.isBible` (Task 2).
- Produces: nada para otras tareas.

- [ ] **Step 1: Traer `isBible` del store**

En `src/pages/BibleView.tsx`, el selector de las líneas 69-75 pasa a incluirlo:

```ts
  const { loadSong, songTitle, theme, slides, currentSlide, isBible } = useProjectionStore(useShallow(s => ({
    loadSong: s.loadSong,
    songTitle: s.state.songTitle,
    theme: s.state.theme,
    slides: s.state.slides,
    currentSlide: s.state.currentSlide,
    isBible: s.state.isBible
  })))
```

`const state = { songTitle, theme, slides, currentSlide }` (línea 76) queda igual: `isBible` se usa sólo en el handler nuevo.

- [ ] **Step 2: Importar el helper**

```ts
import { planVerseStep } from '@/utils/verseStep'
```

- [ ] **Step 3: Agregar el paso de versículo y su listener**

Justo después de `projectVerse` (línea 507, antes del `if (!book)`):

```tsx
  // Flechas = versículo siguiente/anterior. El hook global (useKeyboardShortcuts)
  // se aparta mientras haya un versículo proyectado en esta vista.
  const steppingRef = useRef(false)

  const stepVerse = async (dir: 1 | -1) => {
    if (steppingRef.current || !book) return

    // songTitle guarda la referencia proyectada; con selección múltiple, la última.
    const projectedRef = songTitle?.split(',').pop()?.trim()
    const currentIndex = projectedRef ? verses.findIndex(v => v.reference === projectedRef) : -1

    const step = planVerseStep({
      currentIndex,
      verseCount: verses.length,
      chapter: selectedChapter,
      chapterCount: book.chapters,
      dir,
    })

    if (step.kind === 'none') return

    if (step.kind === 'same-chapter') {
      const target = verses[step.index]
      projectVerse(target)
      setScrollToVerse(extractVerseNumber(target.reference))
      return
    }

    steppingRef.current = true
    try {
      const chapterVerses = await fetchChapter(selectedBook, step.chapter, selectedTranslation)
      const target = step.edge === 'first' ? chapterVerses[0] : chapterVerses[chapterVerses.length - 1]
      if (!target) return
      setSelectedChapter(step.chapter)
      projectVerse(target)
      setScrollToVerse(extractVerseNumber(target.reference))
    } catch (error) {
      console.error('Error cargando el capítulo contiguo', error)
    } finally {
      steppingRef.current = false
    }
  }

  // Ref para que el listener no se re-registre en cada render ni lea estado viejo.
  const stepVerseRef = useRef(stepVerse)
  stepVerseRef.current = stepVerse

  useEffect(() => {
    const NEXT = ['ArrowRight', 'PageDown', ' ']
    const PREV = ['ArrowLeft', 'PageUp']
    const onKey = (e: KeyboardEvent) => {
      if (!isBible) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const dir = NEXT.includes(e.key) ? 1 : PREV.includes(e.key) ? -1 : 0
      if (!dir) return
      e.preventDefault()
      void stepVerseRef.current(dir as 1 | -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isBible])
```

- [ ] **Step 4: Chequear tipos y suite**

Run: `pnpm tsc --noEmit; pnpm test`
Expected: sin errores; 32 archivos de test en verde (los dos nuevos incluidos).

- [ ] **Step 5: Probar a mano el flujo completo**

Run: `pnpm dev` → vista Biblia.
Expected:
- proyectar Juan 3:16 y pulsar `→`: se proyecta 3:17 y la lista se desplaza a ese versículo;
- seguir hasta el último versículo del capítulo 3 y pulsar `→`: pasa a Juan 4:1 y el selector de capítulo muestra 4;
- pulsar `←` desde Juan 4:1: vuelve al último versículo de Juan 3;
- en Génesis 1:1, `←` no hace nada;
- `↑` y `↓` siguen haciendo scroll de la lista;
- escribir `t` abre la búsqueda rápida y **no** oculta el texto;
- `Alt+B` pone la proyección en negro también desde esta vista.

- [ ] **Step 6: Commit**

```bash
git add src/pages/BibleView.tsx
git commit -m "feat(biblia): flechas proyectan el versiculo siguiente y anterior"
```

---

### Task 6: Documentar los atajos

**Files:**
- Modify: `README.md` (sección de funcionalidades) y `docs/ARQUITECTURA.md` (donde se describe la proyección)

- [ ] **Step 1: Agregar la tabla al README**

En `README.md`, dentro de la lista de funcionalidades, agregar una sección corta:

```markdown
### Atajos de teclado

| Tecla | Acción |
|---|---|
| `Alt` + `1`…`8` | Saltar a la vista n del menú lateral |
| `Alt` + `P` | Abrir la ventana de proyección |
| `Alt` + `N` | Nueva canción |
| `Alt` + `B` | Pantalla en negro |
| `→` `Espacio` `PageDown` | Slide siguiente (en Biblia, versículo siguiente) |
| `←` `PageUp` | Slide anterior (en Biblia, versículo anterior) |
| `T` | Ocultar el texto (fuera de la Biblia) |
| `Esc` | Volver a mostrar el texto |
| `?` | Ver esta lista dentro de la app |

Los atajos no actúan mientras el foco está en un campo de texto. En la vista Biblia, cualquier letra abre la búsqueda rápida de pasaje.
```

- [ ] **Step 2: Nota en la arquitectura**

En `docs/ARQUITECTURA.md`, junto a la explicación de la proyección, agregar:

```markdown
Los atajos globales viven en `src/hooks/useKeyboardShortcuts.ts` (montado una vez en `MainApp`). En la vista Biblia con un versículo proyectado, el hook cede las flechas a `BibleView`, que las usa para proyectar el versículo vecino (`planVerseStep` en `src/utils/verseStep.ts`).
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/ARQUITECTURA.md
git commit -m "docs: atajos de teclado"
```

---

## Verificación final

- [ ] `pnpm tsc --noEmit` sin salida.
- [ ] `pnpm test` en verde, incluidos `useKeyboardShortcuts.test.tsx` y `bibleStepVerse.test.ts`.
- [ ] Recorrido manual del Step 5 de la Task 5 completo.
- [ ] `?` abre el modal y su contenido coincide con lo que hace el hook.
