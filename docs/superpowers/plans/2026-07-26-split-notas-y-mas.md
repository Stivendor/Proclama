# Separar "Notas y más" en Temporizador + Avisos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dividir la vista `CountdownView` ("Notas y más") en dos vistas de propósito único — `TimerView` (temporizador + reloj) y `NoticesView` (avisos + banda) — con nombres honestos y microcopy que enseñe al usuario a usarlas.

**Architecture:** Extracción mecánica de las dos `<section>` existentes en `CountdownView` a dos componentes de página nuevos. El control `Segmented` (usado por ambas) sube a `src/components/ui/`. Se recablea navegación (sidebar, rutas, i18n, tipo `activeView`) y se añade redirect de `/countdown`. Sin cambios en stores, servicio de proyección ni Asistencia.

**Tech Stack:** React 18 + TypeScript, react-router-dom, Zustand, Vitest + Testing Library, lucide-react.

## Global Constraints

- Usar **pnpm**, nunca npm (un `package-lock.json` rompe el build de Vercel).
- Estilos: CSS vanilla en `src/index.css` / inline styles como el código existente. No frameworks CSS.
- UI en español (strings hardcodeadas). i18n solo para labels de sidebar via `t(lang, 'sidebar.*')`.
- `activeView` value === segmento de ruta: `setActiveView('timer')` navega a `/timer` (ver `src/stores/index.ts:471-473`). Los `id` del sidebar deben coincidir con el `activeView` y con la ruta.
- Type-check es `pnpm tsc --noEmit` (no hay lint). Tests: `pnpm test`.
- No refactors fuera de alcance. No tocar `useCountdownStore`, `useNotices`, `src/services/projection.ts`, ni `NotesView.tsx` (Asistencia).

---

### Task 1: Componente compartido `Segmented`

`Segmented` hoy es local en `CountdownView`. Lo usan ambas vistas nuevas (modo timer/reloj y posición arriba/abajo de la banda). Extraer a UI compartida.

**Files:**
- Create: `src/components/ui/Segmented.tsx`

**Interfaces:**
- Produces: `export default function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] })`

- [ ] **Step 1: Crear el componente**

`src/components/ui/Segmented.tsx`:

```tsx
import type { ReactNode } from 'react'

// Selector segmentado: dos+ opciones mutuamente excluyentes en un solo control
export default function Segmented<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
}) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, padding: 3, gap: 3 }}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
              borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              background: active ? 'var(--bg-hover)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'background .15s, color .15s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS (sin errores; el componente aún no se importa en ningún sitio, es válido).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Segmented.tsx
git commit -m "feat(ui): extraer Segmented a componente compartido"
```

---

### Task 2: Vista `TimerView`

Extraer la sección "Tiempo en pantalla" de `CountdownView` a una página propia con header honesto y microcopy de guía en el modo Temporizador.

**Files:**
- Create: `src/pages/TimerView.tsx`

**Interfaces:**
- Consumes: `Segmented` de `@/components/ui/Segmented` (Task 1).
- Produces: `export default function TimerView()`.

- [ ] **Step 1: Crear la vista**

`src/pages/TimerView.tsx`:

```tsx
import { useState } from 'react'
import { Play, Pause, RotateCcw, Menu, Clock } from 'lucide-react'
import { useAppStore, useProjectionStore } from '@/stores'
import { useShallow } from 'zustand/react/shallow'
import { useCountdownStore } from '@/features/countdown'
import { openProjectionWindow } from '@/services/projection'
import Segmented from '@/components/ui/Segmented'

export default function TimerView() {
  const { isSidebarOpen, toggleSidebar } = useAppStore(useShallow(s => ({
    isSidebarOpen: s.isSidebarOpen, toggleSidebar: s.toggleSidebar
  })))
  const { config, status, remainingTime, updateConfig, start, pause, reset, showClock } = useCountdownStore(useShallow(s => ({
    config: s.config, status: s.status, remainingTime: s.remainingTime,
    updateConfig: s.updateConfig, start: s.start, pause: s.pause, reset: s.reset, showClock: s.showClock
  })))
  const { projectionWindow, setProjectionWindow } = useProjectionStore(useShallow(s => ({
    projectionWindow: s.projectionWindow,
    setProjectionWindow: s.setProjectionWindow,
  })))

  const isClock = status === 'clock'
  const [mode, setMode] = useState<'timer' | 'clock'>(status === 'clock' ? 'clock' : 'timer')

  function ensureProjection() {
    if (!projectionWindow || projectionWindow.closed) setProjectionWindow(openProjectionWindow())
  }

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Estado real en pantalla (independiente de la pestaña que se esté editando)
  const onScreen =
    status === 'running' ? { dot: 'var(--green)', label: `En pantalla · ${formatTime(remainingTime)}` }
      : status === 'paused' ? { dot: 'var(--gold)', label: `Pausado · ${formatTime(remainingTime)}` }
        : status === 'clock' ? { dot: 'var(--green)', label: 'Reloj en pantalla' }
          : status === 'finished' ? { dot: 'var(--text-muted)', label: 'Finalizado' }
            : null

  return (
    <div className="notes-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar} aria-label="Abrir menú">
              <Menu size={20} />
            </button>
          )}
          <h1>Temporizador</h1>
        </div>
      </div>

      <div className="notes-body">
        <section className="notes-section" aria-labelledby="time-label">
          <div className="notes-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} />
              <span id="time-label">Tiempo en pantalla</span>
            </div>
            {onScreen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: onScreen.dot }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                  {onScreen.label}
                </span>
              </div>
            )}
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Cuenta atrás o reloj en la pantalla de proyección.
          </p>

          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'timer', label: <><Play size={13} /> Temporizador</> },
              { value: 'clock', label: <><Clock size={13} /> Reloj</> },
            ]}
          />

          {mode === 'timer' ? (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Cuenta atrás hasta que empieza el servicio. Al iniciar se abre la ventana de proyección.
              </p>
              <div>
                <label htmlFor="cd-title" style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Título</label>
                <input
                  id="cd-title"
                  type="text"
                  className="input"
                  placeholder="El servicio comienza en..."
                  value={config.title}
                  onChange={e => updateConfig({ title: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="cd-min" style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Minutos</label>
                  <input
                    id="cd-min"
                    type="number"
                    className="input"
                    min={0}
                    max={99}
                    value={config.durationMinutes}
                    onChange={e => updateConfig({ durationMinutes: parseInt(e.target.value) || 0 })}
                    disabled={status === 'running' || status === 'paused'}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="cd-sec" style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Segundos</label>
                  <input
                    id="cd-sec"
                    type="number"
                    className="input"
                    min={0}
                    max={59}
                    value={config.durationSeconds}
                    onChange={e => updateConfig({ durationSeconds: parseInt(e.target.value) || 0 })}
                    disabled={status === 'running' || status === 'paused'}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {status === 'running' ? (
                  <button className="btn-primary" onClick={pause} style={{ background: 'var(--red)', borderColor: 'var(--red)', color: 'white' }}>
                    <Pause size={16} /> Pausar
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => { start(); ensureProjection() }} disabled={config.durationMinutes === 0 && config.durationSeconds === 0}>
                    <Play size={16} /> {status === 'paused' ? 'Reanudar' : 'Iniciar'}
                  </button>
                )}
                <button className="btn-ghost" onClick={reset} disabled={status === 'idle'}>
                  <RotateCcw size={15} /> Reiniciar
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, maxWidth: 360, lineHeight: 1.5 }}>
                Muestra la hora actual en la pantalla de proyección, en formato 12&nbsp;horas.
              </p>
              <button
                className="btn-primary"
                onClick={() => { if (isClock) { reset() } else { showClock(); ensureProjection() } }}
                style={isClock ? { background: 'var(--red)', borderColor: 'var(--red)', color: 'white' } : undefined}
              >
                <Clock size={16} /> {isClock ? 'Ocultar reloj' : 'Mostrar la hora'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/TimerView.tsx
git commit -m "feat(timer): extraer TimerView con microcopy de guía"
```

---

### Task 3: Vista `NoticesView`

Extraer la sección "Avisos" de `CountdownView` con: subtítulo, tira "Ahora en pantalla", botón de aviso con etiqueta "Pantalla completa" + tooltip, microcopy de banda mejorada, y una línea que contraste ambos modos. `Switch` queda local (único consumidor). Un test verifica el microcopy clave.

**Files:**
- Create: `src/pages/NoticesView.tsx`
- Test: `src/test/NoticesView.test.tsx`

**Interfaces:**
- Consumes: `Segmented` de `@/components/ui/Segmented` (Task 1).
- Produces: `export default function NoticesView()`.

- [ ] **Step 1: Escribir el test que falla**

`src/test/NoticesView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
```

- [ ] **Step 2: Ejecutar el test para ver que falla**

Run: `pnpm vitest --run src/test/NoticesView.test.tsx`
Expected: FAIL — no se puede resolver `@/pages/NoticesView` (aún no existe).

- [ ] **Step 3: Crear la vista**

`src/pages/NoticesView.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { Menu, Megaphone, Plus, Pencil, Trash2, Tv2, Check, ScrollText, PanelTop, PanelBottom } from 'lucide-react'
import { useAppStore, useProjectionStore } from '@/stores'
import { useShallow } from 'zustand/react/shallow'
import { openProjectionWindow, sendTickerUpdate, onMessage } from '@/services/projection'
import { useNotices } from '@/features/notices/useNotices'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Segmented from '@/components/ui/Segmented'
import type { Notice } from '@/types'

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 42, height: 24, borderRadius: 999, border: 'none', flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        background: checked ? 'var(--green)' : 'var(--bg-hover)', position: 'relative',
        transition: 'background .15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 20 : 2, width: 20, height: 20, borderRadius: '50%',
        background: '#fff', transition: 'left .15s',
      }} />
    </button>
  )
}

export default function NoticesView() {
  const { isSidebarOpen, toggleSidebar } = useAppStore(useShallow(s => ({
    isSidebarOpen: s.isSidebarOpen, toggleSidebar: s.toggleSidebar
  })))

  // ─── Avisos (localStorage, sin fecha) ─────────────────────────────────────────
  const { notices, add, update, remove } = useNotices()
  const { loadSong, projectedTitle, projectedSlides, projectionWindow, setProjectionWindow } = useProjectionStore(useShallow(s => ({
    loadSong: s.loadSong,
    projectedTitle: s.state.songTitle,
    projectedSlides: s.state.slides,
    projectionWindow: s.projectionWindow,
    setProjectionWindow: s.setProjectionWindow,
  })))
  const [showAddForm, setShowAddForm] = useState(false)
  const [newNoticeText, setNewNoticeText] = useState('')
  const [noticeError, setNoticeError] = useState('')
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deletingNoticeId, setDeletingNoticeId] = useState<string | null>(null)

  // ─── Banda deslizante (ticker) ────────────────────────────────────────────────
  const [band, setBand] = useState<{ active: boolean; position: 'top' | 'bottom' }>(() => {
    try {
      const raw = localStorage.getItem('proclama-ticker')
      return raw ? JSON.parse(raw) : { active: false, position: 'bottom' }
    } catch { return { active: false, position: 'bottom' } }
  })
  const tickerText = notices.map(n => n.text).join('       •       ')

  useEffect(() => { localStorage.setItem('proclama-ticker', JSON.stringify(band)) }, [band])

  // Emite el ticker a la proyección cuando cambia el estado o los avisos
  useEffect(() => {
    sendTickerUpdate({ active: band.active, position: band.position, text: band.active ? tickerText : '' })
  }, [band.active, band.position, tickerText])

  // Reemite la banda cuando una ventana de proyección recién abierta lo solicita
  useEffect(() => {
    return onMessage((msg) => {
      if (msg.type === 'PROJECTION_READY' && band.active) {
        sendTickerUpdate({ active: true, position: band.position, text: tickerText })
      }
    })
  }, [band.active, band.position, tickerText])

  function ensureProjection() {
    if (!projectionWindow || projectionWindow.closed) setProjectionWindow(openProjectionWindow())
  }

  function toggleBand() {
    setBand(b => {
      const next = { ...b, active: !b.active }
      if (next.active) ensureProjection()
      return next
    })
  }

  function addNotice() {
    if (!newNoticeText.trim()) { setNoticeError('El aviso no puede estar vacío'); return }
    add(newNoticeText)
    setNewNoticeText('')
    setNoticeError('')
    setShowAddForm(false)
  }

  function confirmEditNotice() {
    if (!editingNoticeId || !editingText.trim()) { setNoticeError('El aviso no puede estar vacío'); return }
    update(editingNoticeId, editingText)
    setEditingNoticeId(null)
    setEditingText('')
    setNoticeError('')
  }

  function projectNotice(notice: Notice) {
    loadSong({
      id: undefined, title: 'Aviso', artist: '',
      lyrics: notice.text, key: '', tags: [], language: 'Español',
      usageCount: 0, isPublic: false, isVerified: false,
      createdAt: new Date(), updatedAt: new Date(),
    }, false, 0)
    ensureProjection()
  }

  const noNotices = notices.length === 0
  const onAir =
    projectedTitle === 'Aviso' ? 'Aviso a pantalla completa'
      : band.active && !noNotices ? 'Banda de avisos'
        : null

  return (
    <div className="notes-view">
      <div className="view-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar} aria-label="Abrir menú">
              <Menu size={20} />
            </button>
          )}
          <h1>Avisos</h1>
        </div>
      </div>

      <div className="notes-body">
        <section className="notes-section" aria-labelledby="notices-label">
          <div className="notes-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Megaphone size={15} />
              <span id="notices-label">Avisos</span>
            </div>
            <button
              className="btn-ghost"
              onClick={() => { setShowAddForm(v => !v); setNewNoticeText(''); setNoticeError('') }}
              aria-expanded={showAddForm}
            >
              <Plus size={14} />
              Nuevo aviso
            </button>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Muestra recordatorios en la proyección: uno a <strong>pantalla completa</strong> (interrumpe lo proyectado)
            o todos en una <strong>banda deslizante</strong> (sin interrumpir).
          </p>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: onAir ? 'var(--green)' : 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Ahora en pantalla: {onAir ?? '—'}
            </span>
          </div>

          {/* Control de banda */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ScrollText size={16} color="var(--gold)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Banda en pantalla</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {noNotices ? 'Agrega un aviso para activarla' : 'Cinta continua con todos los avisos, sin interrumpir la proyección'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {band.active && !noNotices && (
                <Segmented
                  value={band.position}
                  onChange={pos => setBand(b => ({ ...b, position: pos }))}
                  options={[
                    { value: 'top', label: <><PanelTop size={14} /> Arriba</> },
                    { value: 'bottom', label: <><PanelBottom size={14} /> Abajo</> },
                  ]}
                />
              )}
              <Switch checked={band.active} disabled={noNotices} onChange={toggleBand} />
            </div>
          </div>

          {showAddForm && (
            <div className="notice-form">
              <label htmlFor="new-notice-input" className="sr-only">Texto del aviso</label>
              <textarea
                id="new-notice-input"
                className="input"
                rows={3}
                placeholder="Escribe el aviso..."
                value={newNoticeText}
                onChange={e => { setNewNoticeText(e.target.value); setNoticeError('') }}
                autoFocus
              />
              {noticeError && !editingNoticeId && (
                <p className="field-error" role="alert" aria-live="polite">{noticeError}</p>
              )}
              <div className="notice-form-actions">
                <button className="btn-ghost" onClick={() => { setShowAddForm(false); setNewNoticeText(''); setNoticeError('') }}>Cancelar</button>
                <button className="btn-primary" onClick={addNotice}><Check size={14} />Añadir</button>
              </div>
            </div>
          )}

          {notices.length > 0 && (
            <ul className="notice-list" aria-label="Lista de avisos">
              {notices.map(notice => {
                const isProjected = projectedTitle === 'Aviso' &&
                  projectedSlides.some(s => s.lines.join('\n') === notice.text.split('\n').slice(0, 4).join('\n'))
                return (
                  <li key={notice.id} className={`notice-item${isProjected ? ' notice-item--projected' : ''}`}>
                    {editingNoticeId === notice.id ? (
                      <div className="notice-form" style={{ flex: 1 }}>
                        <label htmlFor={`edit-${notice.id}`} className="sr-only">Editar aviso</label>
                        <textarea
                          id={`edit-${notice.id}`}
                          className="input"
                          rows={3}
                          value={editingText}
                          onChange={e => { setEditingText(e.target.value); setNoticeError('') }}
                          autoFocus
                        />
                        {noticeError && editingNoticeId === notice.id && (
                          <p className="field-error" role="alert" aria-live="polite">{noticeError}</p>
                        )}
                        <div className="notice-form-actions">
                          <button className="btn-ghost" onClick={() => { setEditingNoticeId(null); setEditingText(''); setNoticeError('') }}>Cancelar</button>
                          <button className="btn-primary" onClick={confirmEditNotice}><Check size={14} />Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="notice-text">{notice.text}</p>
                        <div className="notice-actions">
                          <button className="btn-icon" onClick={() => { setEditingNoticeId(notice.id); setEditingText(notice.text); setNoticeError('') }} aria-label="Editar" title="Editar"><Pencil size={14} /></button>
                          <button
                            className={`btn-ghost${isProjected ? ' notice-project-active' : ''}`}
                            onClick={() => projectNotice(notice)}
                            aria-label="Pantalla completa"
                            title="Interrumpe lo proyectado y muestra este aviso solo"
                          ><Tv2 size={14} /> Pantalla completa</button>
                          <button className="btn-icon danger" onClick={() => setDeletingNoticeId(notice.id)} aria-label="Eliminar" title="Eliminar"><Trash2 size={14} /></button>
                        </div>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {noNotices && !showAddForm && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
              Aún no hay avisos. Crea uno para mostrarlo en pantalla.
            </p>
          )}
        </section>
      </div>

      {deletingNoticeId && (
        <ConfirmDialog
          message="¿Eliminar este aviso? Esta acción no se puede deshacer."
          onConfirm={() => { remove(deletingNoticeId); setDeletingNoticeId(null) }}
          onCancel={() => setDeletingNoticeId(null)}
          confirmLabel="Eliminar"
          danger
        />
      )}
    </div>
  )
}
```

Nota: el botón "Pantalla completa" pasa de `btn-icon` (icono mudo) a `btn-ghost` con texto, para que la acción sea legible. `aria-label="Pantalla completa"` cumple el test.

- [ ] **Step 4: Ejecutar el test para ver que pasa**

Run: `pnpm vitest --run src/test/NoticesView.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/NoticesView.tsx src/test/NoticesView.test.tsx
git commit -m "feat(notices): extraer NoticesView con microcopy y estado en pantalla"
```

---

### Task 4: Recablear navegación y borrar `CountdownView`

Registrar las dos vistas en sidebar, rutas, i18n y el tipo `activeView`; redirigir `/countdown`; borrar el archivo viejo. Un test verifica los labels del sidebar.

**Files:**
- Modify: `src/i18n/es.ts:146-162` (bloque `sidebar`)
- Modify: `src/components/layout/Sidebar.tsx:2` (import icono), `:30-36` (nav array)
- Modify: `src/stores/index.ts:338` (tipo `activeView`)
- Modify: `src/App.tsx:2` (import `Navigate`), `:22` (lazy imports), `:35-44` (VIEW_PATHS), `:201` (rutas)
- Delete: `src/pages/CountdownView.tsx`
- Test: `src/test/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `TimerView` (Task 2), `NoticesView` (Task 3).

- [ ] **Step 1: i18n — reemplazar label**

En `src/i18n/es.ts`, dentro del bloque `sidebar` (línea 151), reemplazar:

```ts
    countdown: 'Notas y más',
```

por:

```ts
    timer: 'Temporizador',
    notices: 'Avisos',
```

- [ ] **Step 2: Tipo `activeView`**

En `src/stores/index.ts:338`, reemplazar `'countdown'` por `'timer' | 'notices'`:

```ts
  activeView: 'library' | 'setlists' | 'settings' | 'bible' | 'timer' | 'notices' | 'notes' | 'terms' | 'fondos' | 'reports' | 'admin-users'
```

- [ ] **Step 3: Sidebar — icono y nav**

En `src/components/layout/Sidebar.tsx`, asegurar que `Timer` y `Megaphone` están importados de `lucide-react` (línea 2 aprox — `Timer` ya se importa; añadir `Megaphone` si falta). Reemplazar la entrada `countdown` (línea 33):

```tsx
    { id: 'countdown', icon: Timer, label: t(language, 'sidebar.countdown') },
```

por:

```tsx
    { id: 'timer', icon: Timer, label: t(language, 'sidebar.timer') },
    { id: 'notices', icon: Megaphone, label: t(language, 'sidebar.notices') },
```

- [ ] **Step 4: App.tsx — imports, rutas, redirect, VIEW_PATHS**

En `src/App.tsx`:

a) Import `Navigate` (línea 2):

```tsx
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
```

b) Reemplazar el lazy import de `CountdownView` (línea 22):

```tsx
const TimerView = lazy(() => import("@/pages/TimerView"));
const NoticesView = lazy(() => import("@/pages/NoticesView"));
```

c) En `VIEW_PATHS` (líneas 35-44), reemplazar `'/countdown': 'countdown',` por:

```ts
  '/timer': 'timer',
  '/notices': 'notices',
```

d) En el `<Routes>` de `AppContent` (línea 201), reemplazar `<Route path="/countdown" element={<CountdownView />} />` por:

```tsx
            <Route path="/timer" element={<TimerView />} />
            <Route path="/notices" element={<NoticesView />} />
            <Route path="/countdown" element={<Navigate to="/timer" replace />} />
```

- [ ] **Step 5: Borrar la vista vieja**

```bash
git rm src/pages/CountdownView.tsx
```

- [ ] **Step 6: Escribir test de sidebar**

`src/test/Sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
```

Si `Sidebar` consume más campos del store y el test falla por `undefined`, añadirlos a `state` con `vi.fn()`/valores neutros hasta que renderice. No cambiar `Sidebar` para acomodar el test.

- [ ] **Step 7: Ejecutar el test de sidebar**

Run: `pnpm vitest --run src/test/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 8: Type-check completo (detecta referencias colgantes)**

Run: `pnpm tsc --noEmit`
Expected: PASS. Si falla por algún uso residual de `'countdown'` o `CountdownView`, corregirlo (buscar con `grep -rn "countdown\|CountdownView" src/`).

- [ ] **Step 9: Commit**

```bash
git add src/i18n/es.ts src/stores/index.ts src/components/layout/Sidebar.tsx src/App.tsx src/test/Sidebar.test.tsx
git commit -m "refactor(nav): reemplazar 'Notas y más' por Temporizador y Avisos"
```

---

### Task 5: Verificación final

Confirmar que no hay regresión funcional ni referencias colgantes, y revisar manualmente el flujo real.

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite completa de tests**

Run: `pnpm test`
Expected: PASS (incluye los nuevos `NoticesView.test.tsx` y `Sidebar.test.tsx`).

- [ ] **Step 2: Build de producción (tsc + vite-react-ssg)**

Run: `pnpm build`
Expected: PASS, sin errores de tipo ni de referencias faltantes.

- [ ] **Step 3: Buscar residuos**

Run: `grep -rn "CountdownView\|'countdown'\|sidebar.countdown" src/`
Expected: sin resultados (salvo, si acaso, el redirect `/countdown` en `App.tsx`, que es intencional).

- [ ] **Step 4: Revisión manual en `pnpm dev`**

Run: `pnpm dev` y comprobar:
- Sidebar muestra "Temporizador" y "Avisos"; ya no "Notas y más".
- `/timer`: temporizador y reloj funcionan; al iniciar se abre proyección; píldora de estado visible.
- `/notices`: crear/editar/borrar aviso; botón "Pantalla completa" proyecta el aviso; toggle de banda muestra la cinta; posición arriba/abajo funciona; tira "Ahora en pantalla" refleja el estado.
- Navegar a `/countdown` redirige a `/timer`.

- [ ] **Step 5: Refrescar el grafo de codebase-memory**

Tras confirmar todo, correr `detect_changes` / re-index del proyecto en codebase-memory para reflejar los archivos nuevos y el borrado (según CLAUDE.md).

---

## Self-Review (autor del plan)

- **Cobertura del spec:** navegación/routing → Task 4; TimerView → Task 2; NoticesView + microcopy + estado en pantalla + botón "Pantalla completa" + microcopy banda → Task 3; estructura de archivos (Segmented compartido, borrar CountdownView) → Task 1 + Task 4; redirect `/countdown` → Task 4 Step 4d; criterios de éxito (build, sin residuos, sin regresión) → Task 5. Sin huecos.
- **Placeholders:** ninguno; todo el código está completo.
- **Consistencia de tipos:** `activeView` incluye `'timer' | 'notices'` (Task 4 Step 2), coincidente con los `id` del sidebar (Step 3), las claves de `VIEW_PATHS` (Step 4c) y las rutas (Step 4d). `Segmented` firma idéntica en Task 1 y en sus consumidores (Task 2, Task 3). Nota: `Switch` es local en `NoticesView` (único consumidor) — decisión deliberada, no se comparte.
