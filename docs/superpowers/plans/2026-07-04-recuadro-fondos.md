# Recuadro Fijo de Fondos de Letra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estante fijo de fondos (`BackgroundShelf`) arriba del sidebar derecho: el usuario fija fondos desde su media local y el que esté activo recibe toda letra proyectada.

**Architecture:** Nuevo array persistido `pinnedBackgroundIds` en `useProjectionStore` (el activo sigue siendo `defaultBackgroundMediaId`, y `favoriteBgOverride` no se toca). Componente nuevo `BackgroundShelf` como primera sección de `MediaPanel` (montado siempre). La estrella actual de la lista de media se convierte en pin. Helpers puros testeables en `src/utils/backgroundShelf.ts`.

**Tech Stack:** React 18 + Vite + TS + Zustand (persist) + Dexie. Tests con vitest.

**Spec:** `docs/superpowers/specs/2026-07-04-recuadro-fondos-design.md`

## Global Constraints

- Gestor de paquetes: **pnpm** (nunca npm).
- Tests en `src/test/`; para tests que importan `@/stores`, stub de localStorage con `vi.hoisted` ANTES del import (patrón de `src/test/editorOnSaved.test.ts`).
- Textos de UI en español.
- `favoriteBgOverride` (src/stores/index.ts:48) NO se modifica — la regla "ninguna letra sobre una imagen distinta del fondo activo" ya vive ahí.
- Solo imágenes se pueden fijar (videos/YouTube no).
- CSS inline en `<style>` dentro del componente (patrón existente de MediaPanel).
- Commits estilo `feat(fondos): ...` / `fix(fondos): ...`.

---

### Task 1: Helpers puros `togglePinned` / `prunePinned` — TDD

**Files:**
- Create: `src/utils/backgroundShelf.ts`
- Test: `src/test/backgroundShelf.test.ts`

**Interfaces:**
- Consumes: tipo `LocalMedia` de `@/types` (campos usados: `id: string`, `type: 'image' | 'video' | 'youtube'`, `url`, `name`, `size`, `createdAt`, `folderId`).
- Produces (Tasks 3-4 los importan):
  - `togglePinned(ids: string[], id: string): string[]` — agrega el id si no está, lo quita si está.
  - `prunePinned(ids: string[], list: LocalMedia[]): string[]` — conserva solo ids que existen como imagen en la lista, en su orden original.

- [ ] **Step 1: Tests que fallan**

Crear `src/test/backgroundShelf.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { togglePinned, prunePinned } from '@/utils/backgroundShelf'
import type { LocalMedia } from '@/types'

const img = (id: string): LocalMedia => ({
  id, url: `blob:${id}`, type: 'image', name: id, size: 1, createdAt: 0, folderId: null,
})
const vid = (id: string): LocalMedia => ({ ...img(id), type: 'video' })

describe('togglePinned', () => {
  it('agrega un id que no estaba', () => {
    expect(togglePinned(['a'], 'b')).toEqual(['a', 'b'])
  })
  it('quita un id que ya estaba', () => {
    expect(togglePinned(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('prunePinned', () => {
  it('quita ids que ya no existen en la media local', () => {
    expect(prunePinned(['a', 'x', 'b'], [img('a'), img('b')])).toEqual(['a', 'b'])
  })
  it('quita ids cuyo item ya no es imagen', () => {
    expect(prunePinned(['a', 'v'], [img('a'), vid('v')])).toEqual(['a'])
  })
  it('conserva el orden original', () => {
    expect(prunePinned(['b', 'a'], [img('a'), img('b')])).toEqual(['b', 'a'])
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `pnpm vitest run src/test/backgroundShelf.test.ts`
Expected: FAIL — módulo `@/utils/backgroundShelf` no existe.

- [ ] **Step 3: Implementar `src/utils/backgroundShelf.ts`**

```ts
import type { LocalMedia } from '@/types'

/** Agrega o quita un id de la lista de fondos fijados al recuadro. */
export function togglePinned(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(p => p !== id) : [...ids, id]
}

/** Depura ids fijados que ya no existen como imagen en la media local. */
export function prunePinned(ids: string[], list: LocalMedia[]): string[] {
  return ids.filter(id => list.some(m => m.id === id && m.type === 'image'))
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `pnpm vitest run src/test/backgroundShelf.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/backgroundShelf.ts src/test/backgroundShelf.test.ts
git commit -m "feat(fondos): helpers puros de fondos fijados"
```

---

### Task 2: `pinnedBackgroundIds` persistido en el store de proyección

**Files:**
- Modify: `src/stores/index.ts` (interfaz `ProjectionStore` ~línea 85, implementación ~línea 109, `partialize` ~línea 285)
- Test: `src/test/backgroundShelf.test.ts` (ampliar)

**Interfaces:**
- Produces (Tasks 3-4 lo consumen):
  - `pinnedBackgroundIds: string[]` en `useProjectionStore`.
  - `setPinnedBackgroundIds(updater: string[] | ((prev: string[]) => string[])): void`.
  - Ambos persistidos en `proclama-projection` vía `partialize`.

- [ ] **Step 1: Test que falla**

Agregar al FINAL de `src/test/backgroundShelf.test.ts` (el stub de localStorage debe quedar ANTES del import de `@/stores` — al ser `vi.hoisted`, puede añadirse junto a los imports):

```ts
// El persist de zustand captura localStorage al importar el store: stub ANTES del import
vi.hoisted(() => {
  const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
})

describe('pinnedBackgroundIds en el store', () => {
  it('setter acepta lista directa y updater funcional', () => {
    useProjectionStore.getState().setPinnedBackgroundIds(['a'])
    expect(useProjectionStore.getState().pinnedBackgroundIds).toEqual(['a'])
    useProjectionStore.getState().setPinnedBackgroundIds(prev => [...prev, 'b'])
    expect(useProjectionStore.getState().pinnedBackgroundIds).toEqual(['a', 'b'])
  })
})
```

Y ajustar los imports del archivo:

```ts
import { describe, expect, it, vi } from 'vitest'
import { useProjectionStore } from '@/stores'
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm vitest run src/test/backgroundShelf.test.ts`
Expected: FAIL — `setPinnedBackgroundIds` is not a function.

- [ ] **Step 3: Implementar en `src/stores/index.ts`**

En la interfaz `ProjectionStore`, después de `setDefaultBackgroundMediaId: (id: string | null) => void`:

```ts
  // Fondos fijados al recuadro (BackgroundShelf). El activo sigue siendo defaultBackgroundMediaId.
  pinnedBackgroundIds: string[]
  setPinnedBackgroundIds: (updater: string[] | ((prev: string[]) => string[])) => void
```

En la implementación, después de `setDefaultBackgroundMediaId: (id) => set({ defaultBackgroundMediaId: id }),`:

```ts
      pinnedBackgroundIds: [],
      setPinnedBackgroundIds: (updater) => set((s) => ({
        pinnedBackgroundIds: typeof updater === 'function' ? updater(s.pinnedBackgroundIds) : updater
      })),
```

En el `partialize` de `proclama-projection`, después de `defaultBackgroundMediaId: s.defaultBackgroundMediaId`:

```ts
        pinnedBackgroundIds: s.pinnedBackgroundIds
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm vitest run src/test/backgroundShelf.test.ts && pnpm tsc --noEmit`
Expected: PASS (6 tests), tsc limpio.

- [ ] **Step 5: Commit**

```bash
git add src/stores/index.ts src/test/backgroundShelf.test.ts
git commit -m "feat(fondos): pinnedBackgroundIds persistido en el store de proyeccion"
```

---

### Task 3: Componente `BackgroundShelf` montado en MediaPanel

**Files:**
- Create: `src/components/media/BackgroundShelf.tsx`
- Modify: `src/components/media/MediaPanel.tsx` (import + render tras abrir el div `.media-panel`, ~línea 517)

**Interfaces:**
- Consumes: `pinnedBackgroundIds`, `setPinnedBackgroundIds` (Task 2); `defaultBackgroundMediaId`, `setDefaultBackgroundMediaId`, `updateTheme`, `localMediaList` (existentes).
- Produces: `<BackgroundShelf />` (default export, sin props), siempre visible arriba del panel de media.

- [ ] **Step 1: Crear `src/components/media/BackgroundShelf.tsx`**

```tsx
import { Star, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectionStore } from '@/stores'
import type { LocalMedia } from '@/types'

/** Estante fijo de fondos de letra: el activo (estrella) recibe toda letra proyectada. */
export default function BackgroundShelf() {
  const {
    localMediaList, pinnedBackgroundIds, setPinnedBackgroundIds,
    defaultBackgroundMediaId, setDefaultBackgroundMediaId, updateTheme,
  } = useProjectionStore(useShallow(s => ({
    localMediaList: s.localMediaList,
    pinnedBackgroundIds: s.pinnedBackgroundIds,
    setPinnedBackgroundIds: s.setPinnedBackgroundIds,
    defaultBackgroundMediaId: s.defaultBackgroundMediaId,
    setDefaultBackgroundMediaId: s.setDefaultBackgroundMediaId,
    updateTheme: s.updateTheme,
  })))

  // Miniaturas resueltas por id contra la media local (las blob URLs nunca se persisten).
  const pinned = pinnedBackgroundIds
    .map(id => localMediaList.find(m => m.id === id && m.type === 'image'))
    .filter((m): m is LocalMedia => !!m)

  const deactivate = () => {
    setDefaultBackgroundMediaId(null)
    updateTheme({ backgroundType: 'color' })
  }

  const activate = (item: LocalMedia) => {
    if (defaultBackgroundMediaId === item.id) { deactivate(); return }
    setDefaultBackgroundMediaId(item.id)
    updateTheme({ backgroundType: 'image', backgroundImageUrl: item.url, backgroundThumbnail: undefined })
  }

  const unpin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (defaultBackgroundMediaId === id) deactivate()
    setPinnedBackgroundIds(prev => prev.filter(p => p !== id))
  }

  return (
    <div className="bg-shelf">
      <div className="bg-shelf-header">
        <Star size={12} /> Fondos de letra
      </div>
      {pinned.length === 0 ? (
        <p className="bg-shelf-hint">Fija fondos con el 📌 de tu media local</p>
      ) : (
        <div className="bg-shelf-row">
          {pinned.map(item => (
            <button
              key={item.id}
              className={`bg-shelf-item ${defaultBackgroundMediaId === item.id ? 'active' : ''}`}
              onClick={() => activate(item)}
              title={defaultBackgroundMediaId === item.id
                ? `${item.name} — fondo activo, clic para desactivar`
                : `${item.name} — clic para usarlo en toda letra/versículo`}
            >
              <img src={item.url} alt={item.name} />
              {defaultBackgroundMediaId === item.id && (
                <Star size={10} fill="currentColor" className="bg-shelf-star" />
              )}
              <span
                className="bg-shelf-remove"
                role="button"
                title="Quitar del recuadro"
                onClick={(e) => unpin(item.id, e)}
              >
                <X size={10} />
              </span>
            </button>
          ))}
        </div>
      )}
      <style>{`
        .bg-shelf { border-bottom: 1px solid var(--border); padding: 8px 0; margin-bottom: 8px; }
        .bg-shelf-header {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;
        }
        .bg-shelf-hint { font-size: 11px; color: var(--text-muted); margin: 0; }
        .bg-shelf-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
        .bg-shelf-item {
          position: relative; flex: 0 0 auto; width: 64px; height: 36px;
          border-radius: 6px; overflow: hidden; border: 2px solid transparent;
          padding: 0; cursor: pointer; background: var(--bg-elevated);
        }
        .bg-shelf-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .bg-shelf-item.active { border-color: var(--gold); }
        .bg-shelf-star { position: absolute; top: 2px; left: 2px; color: var(--gold); }
        .bg-shelf-remove {
          position: absolute; top: 2px; right: 2px; width: 14px; height: 14px;
          border-radius: 4px; background: rgba(0,0,0,0.6); color: #fff;
          display: none; align-items: center; justify-content: center;
        }
        .bg-shelf-item:hover .bg-shelf-remove { display: flex; }
      `}</style>
    </div>
  )
}
```

(Nota: el botón de quitar es un `<span role="button">` porque un `<button>` dentro de otro `<button>` es HTML inválido.)

- [ ] **Step 2: Montarlo en `MediaPanel`**

En `src/components/media/MediaPanel.tsx`, agregar el import:

```tsx
import BackgroundShelf from "./BackgroundShelf";
```

Y renderizarlo como PRIMER hijo del div `.media-panel` (antes del `.recognition-header`):

```tsx
    <div
      className={`media-panel ${isDragging ? "is-dragging" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <BackgroundShelf />
```

- [ ] **Step 3: Verificar**

Run: `pnpm tsc --noEmit && pnpm vitest run`
Expected: tsc limpio, suite completa PASS. (Con `pnpm dev`: el recuadro aparece fijo arriba del sidebar con el hint de vacío.)

- [ ] **Step 4: Commit**

```bash
git add src/components/media/BackgroundShelf.tsx src/components/media/MediaPanel.tsx
git commit -m "feat(fondos): recuadro fijo de fondos de letra en el sidebar"
```

---

### Task 4: Pin en la lista de media + depuración y auto-pin al cargar

**Files:**
- Modify: `src/components/media/MediaPanel.tsx`:
  - efecto de refresco/limpieza (~líneas 122-140)
  - `toggleDefaultBackground` (~líneas 142-152) → `togglePin`
  - botón estrella del item (~líneas 758-766)
  - `removeMedia` (~línea 474) y `clearAllMedia` (~línea 501)
  - import de iconos (línea 2: `Star` → `Pin`)

**Interfaces:**
- Consumes: `togglePinned`, `prunePinned` (Task 1); `pinnedBackgroundIds`, `setPinnedBackgroundIds` (Task 2).
- Produces: comportamiento final — el pin de la lista agrega/quita del recuadro; ids huérfanos se depuran; un `defaultBackgroundMediaId` heredado se auto-fija.

- [ ] **Step 1: Traer el estado nuevo al componente**

En el `useProjectionStore(useShallow(...))` de `MediaPanel`, agregar al objeto destructurado y al selector:

```ts
    pinnedBackgroundIds,
    setPinnedBackgroundIds,
```

```ts
        pinnedBackgroundIds: s.pinnedBackgroundIds,
        setPinnedBackgroundIds: s.setPinnedBackgroundIds,
```

Y los imports:

```tsx
import { Image, X, Upload, MonitorPlay, Zap, Plus, Trash2, AlertCircle, Folder, FolderPlus, Pencil, FolderX, Youtube, Pin } from "lucide-react";
import { togglePinned, prunePinned } from "@/utils/backgroundShelf";
```

(`Star` sale del import — ya solo lo usa `BackgroundShelf`.)

- [ ] **Step 2: Reemplazar el efecto de refresco/limpieza (líneas ~122-140)**

Sustituir el efecto completo que empieza con el comentario "Fondo predeterminado: el blob URL caduca..." por:

```ts
  // Fondo predeterminado y pins: al terminar de cargar la media local se refresca la
  // blob URL caducada del fondo activo, se auto-fija el favorito heredado y se depuran
  // ids que ya no existen. Gateado por `loading`: antes la limpieza corría con la lista
  // aún vacía en el mount y borraba el favorito persistido.
  useEffect(() => {
    if (loading) return;
    setPinnedBackgroundIds((prev) => {
      let next = prunePinned(prev, localMediaList);
      if (
        defaultBackgroundMediaId &&
        localMediaList.some((m) => m.id === defaultBackgroundMediaId && m.type === "image") &&
        !next.includes(defaultBackgroundMediaId)
      ) {
        next = [...next, defaultBackgroundMediaId];
      }
      // Devolver la misma referencia si no cambió nada evita re-renders en bucle.
      return next.length === prev.length && next.every((v, i) => v === prev[i]) ? prev : next;
    });

    if (!defaultBackgroundMediaId) return;
    const item = localMediaList.find((m) => m.id === defaultBackgroundMediaId);
    if (!item || item.type !== "image") {
      // La imagen default fue eliminada → limpiar la marca.
      setDefaultBackgroundMediaId(null);
      return;
    }
    const t = useProjectionStore.getState().state.theme;
    if (t.backgroundType === "image" && t.backgroundImageUrl !== item.url) {
      updateTheme({ backgroundType: "image", backgroundImageUrl: item.url });
    }
  }, [loading, localMediaList, defaultBackgroundMediaId, setDefaultBackgroundMediaId, setPinnedBackgroundIds, updateTheme]);
```

- [ ] **Step 3: `toggleDefaultBackground` → `togglePin`**

Sustituir la función completa (líneas ~142-152) por:

```ts
  const togglePin = (item: LocalMedia, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type !== "image") return;
    // Quitar el pin del fondo activo también lo desactiva como predeterminado.
    if (pinnedBackgroundIds.includes(item.id) && defaultBackgroundMediaId === item.id) {
      setDefaultBackgroundMediaId(null);
      updateTheme({ backgroundType: "color" });
    }
    setPinnedBackgroundIds((prev) => togglePinned(prev, item.id));
  };
```

- [ ] **Step 4: Botón del item (líneas ~758-766)**

Sustituir el botón `media-item-default` por:

```tsx
                  {item.type === "image" && (
                    <button
                      className={`media-item-default ${pinnedBackgroundIds.includes(item.id) ? "active" : ""}`}
                      onClick={(e) => togglePin(item, e)}
                      title={pinnedBackgroundIds.includes(item.id) ? "Quitar del recuadro de fondos" : "Fijar al recuadro de fondos de letra"}
                    >
                      <Pin size={12} fill={pinnedBackgroundIds.includes(item.id) ? "currentColor" : "none"} />
                    </button>
                  )}
```

- [ ] **Step 5: Borrado de media**

En `removeMedia`, después del bloque `if (defaultBackgroundMediaId === id) {...}`:

```ts
    setPinnedBackgroundIds((prev) => prev.filter((p) => p !== id));
```

En `clearAllMedia`, después de `setLocalMediaList([]);`:

```ts
      setPinnedBackgroundIds([]);
```

- [ ] **Step 6: Verificar**

Run: `pnpm tsc --noEmit && pnpm vitest run && pnpm build`
Expected: tsc limpio (sin referencias restantes a `toggleDefaultBackground`/`Star` en MediaPanel), suite completa PASS, build OK.

- [ ] **Step 7: Commit**

```bash
git add src/components/media/MediaPanel.tsx
git commit -m "feat(fondos): pin de media al recuadro con depuracion y auto-pin del favorito"
```

---

### Task 5: Verificación end-to-end

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa + build**

Run: `pnpm tsc --noEmit && pnpm vitest run && pnpm build`
Expected: todo verde.

- [ ] **Step 2: Prueba funcional (con `pnpm dev`)**

1. El recuadro "Fondos de letra" aparece fijo arriba del sidebar derecho (con y sin canción activa).
2. Pin (📌) en una imagen de la media → aparece en el recuadro.
3. Clic en su miniatura → borde/estrella dorada y el fondo de proyección cambia a esa imagen.
4. Proyectar una letra con un anuncio/imagen distinta en pantalla → la letra sale sobre el fondo activo, nunca sobre la otra imagen.
5. Clic en la miniatura activa → se desactiva (fondo vuelve a color).
6. X en hover → sale del recuadro (y se desactiva si era la activa).
7. Recargar la app → los pins y el fondo activo persisten (miniaturas se resuelven al cargar la media).
8. Si había un fondo favorito marcado antes de este cambio → aparece auto-fijado en el recuadro.
9. Borrar de la media una imagen fijada → desaparece del recuadro.

Expected: los 9 pasos funcionan.

- [ ] **Step 3: Commit final si hubo ajustes**

```bash
git add -A && git commit -m "feat(fondos): recuadro de fondos end-to-end"
```

Luego usar superpowers:finishing-a-development-branch.

---

## Self-review (hecho al escribir el plan)

- **Cobertura del spec:** estado persistido + migración auto-pin (T2, T4), BackgroundShelf con clic-activa/clic-desactiva/X/hint (T3), pin en la lista reemplaza la estrella (T4), depuración de ids huérfanos y al borrar media (T4), `favoriteBgOverride` intacto (constraint global), blob URLs resueltas por id (T3). ✓
- **Placeholders:** todo el código está completo; no hay TBDs. ✓
- **Consistencia de tipos:** `togglePinned`/`prunePinned` firmas idénticas en T1 y T4; `setPinnedBackgroundIds(updater)` igual en T2, T3 y T4. ✓
- **Extra justificado:** el gate por `loading` en T4 corrige un bug latente (la limpieza corría en el mount con la lista vacía y podía borrar el favorito persistido); queda documentado en el comentario del efecto. ✓
