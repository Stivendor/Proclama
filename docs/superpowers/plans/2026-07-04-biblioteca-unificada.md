# Biblioteca Unificada + Moderación Automática — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una sola biblioteca (sin pestañas Mi Cancionero/Comunidad) y toda canción creada entra automáticamente a Pendientes del panel admin.

**Architecture:** Cambio de política en la rama de creación de `SongEditorModal` (`is_public=true` al crear), re-envío automático de rechazadas al editarlas, y unificación de la query/UI de `LibraryView` con helpers puros testeables en un archivo nuevo. El panel admin no cambia (ya filtra público+no-verificado).

**Tech Stack:** React 18 + Vite + TS + Dexie + Zustand + Supabase. Tests con vitest.

**Spec:** `docs/superpowers/specs/2026-07-04-biblioteca-unificada-design.md`

## Global Constraints

- Gestor de paquetes: **pnpm** (nunca npm).
- Tests en `src/test/`, patrón de mocks de `src/test/SongEditorModal.test.tsx` (vi.mock de `@/db`, `@/stores`, `@/services/supabase`).
- Textos de UI en español.
- Freemium sin cambios: `canCreateSong` / `FREE_SONG_LIMIT` intactos.
- Migración solo hacia adelante: canciones privadas existentes (`!isPublic && !rejectionReason`) conservan el botón "Publicar" y el ícono Lock.
- Panel admin (`PendingSongsPage`) NO se toca.
- Commits estilo `feat(biblioteca): ...` / `fix(biblioteca): ...`.

---

### Task 1: `rejectionReason` en el tipo Song + mapeos de Supabase

**Files:**
- Modify: `src/types/index.ts` (interfaz `Song`, tras `importadaDe`)
- Modify: `src/services/supabase.ts` (`mapRowToSong` ~línea 31, `updateSong` payload ~línea 225)
- Test: `src/test/librarySongs.test.ts` (crear; crece en Task 4)

**Interfaces:**
- Produces: `Song.rejectionReason?: string | null`; `mapRowToSong` la mapea desde `rejection_reason`; `updateSong` acepta `rejectionReason` en updates y lo escribe como `rejection_reason`.

- [ ] **Step 1: Test que falla**

`src/test/librarySongs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mapRowToSong } from '@/services/supabase'

describe('mapRowToSong', () => {
  it('mapea rejection_reason a rejectionReason', () => {
    const song = mapRowToSong({
      id: 1, user_id: 'u1', title: 'T', artist: null, lyrics: null, key: null,
      tags: null, language: null, is_public: false, is_verified: false,
      rejection_reason: 'letra incompleta', usage_count: 0, created_at: null, updated_at: null,
    } as any)
    expect(song.rejectionReason).toBe('letra incompleta')
  })

  it('rejection_reason null queda undefined', () => {
    const song = mapRowToSong({
      id: 2, user_id: null, title: 'T2', artist: null, lyrics: null, key: null,
      tags: null, language: null, is_public: true, is_verified: true,
      rejection_reason: null, usage_count: 0, created_at: null, updated_at: null,
    } as any)
    expect(song.rejectionReason).toBeUndefined()
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm vitest run src/test/librarySongs.test.ts`
Expected: FAIL — `rejectionReason` undefined vs 'letra incompleta' (el mapeo no existe).

- [ ] **Step 3: Implementar**

En `src/types/index.ts`, dentro de `Song` después de `importadaDe?: number`:

```ts
  rejectionReason?: string | null // motivo si el admin la rechazó (rejection_reason en Supabase)
```

En `src/services/supabase.ts`, en `mapRowToSong` después de `sourceUrl: ...`:

```ts
    rejectionReason: row.rejection_reason ?? undefined,
```

En `updateSong`, dentro del objeto `payload` después de la línea de `user_id`:

```ts
    ...(updates.rejectionReason !== undefined && { rejection_reason: updates.rejectionReason }),
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm vitest run src/test/librarySongs.test.ts && pnpm tsc --noEmit`
Expected: PASS (2 tests), tsc limpio.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/services/supabase.ts src/test/librarySongs.test.ts
git commit -m "feat(biblioteca): rejectionReason en Song y mapeos de Supabase"
```

---

### Task 2: Crear canción → moderación automática

**Files:**
- Modify: `src/components/songs/SongEditorModal.tsx` (rama de creación, líneas ~98-127, y toast ~136)
- Test: `src/test/SongEditorModal.test.tsx` (agregar un test)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: toda canción creada sube con `isPublic: true, isVerified: false` (local y nube) → entra a Pendientes del admin.

- [ ] **Step 1: Test que falla**

En `src/test/SongEditorModal.test.tsx`, agregar dentro del `describe('SongEditorModal')` (usar los mocks ya definidos en ese archivo; `createSong` ya está mockeado allí):

```tsx
  it('crea canciones como publicas pendientes de verificacion', async () => {
    vi.mocked(createSong).mockResolvedValue(null as any)
    render(<SongEditorModal />)

    fireEvent.change(screen.getByPlaceholderText(/t[ií]tulo/i), { target: { value: 'Nueva Cancion' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(createSong).toHaveBeenCalled())
    const arg = vi.mocked(createSong).mock.calls[0][0]
    expect(arg.isPublic).toBe(true)
    expect(arg.isVerified).toBe(false)
  })
```

(Ajustar el selector del título al placeholder/label real del modal — verificarlo en el JSX antes de dar por bueno el test. Si el archivo de test usa helpers propios para render, seguir su patrón.)

- [ ] **Step 2: Verificar que falla**

Run: `pnpm vitest run src/test/SongEditorModal.test.tsx`
Expected: FAIL — `isPublic` esperado true, recibido false.

- [ ] **Step 3: Implementar**

En la rama de creación de `handleSave` (donde hoy dice `isPublic: false, isVerified: false` en el `db.songs.add`), cambiar a:

```ts
        const localId = await db.songs.add({
          ...form,
          remoteId: undefined,
          isPublic: true,      // toda canción creada entra a moderación pública
          isVerified: false,
          createdAt: now,
          updatedAt: now,
          userId: user?.id ?? undefined,
        })
```

Y en el `createSong({...})` de esa misma rama, agregar explícitamente después de `userId: user.id`:

```ts
            isPublic: true,
            isVerified: false,
```

Cambiar el toast de creación (línea ~136) a:

```ts
        useAppStore.getState().setToast(`✅ "${form.title}" guardada — enviada a revisión de la comunidad`)
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm vitest run src/test/SongEditorModal.test.tsx && pnpm tsc --noEmit`
Expected: PASS (todos los tests del archivo).

- [ ] **Step 5: Commit**

```bash
git add src/components/songs/SongEditorModal.tsx src/test/SongEditorModal.test.tsx
git commit -m "feat(biblioteca): canciones creadas entran automaticamente a moderacion"
```

---

### Task 3: Re-envío automático de canciones rechazadas al editarlas

**Files:**
- Modify: `src/components/songs/SongEditorModal.tsx` (rama de actualización ~líneas 89-96 y bloque de sync a nube ~154-169)
- Test: `src/test/SongEditorModal.test.tsx` (agregar un test)

**Interfaces:**
- Consumes: `Song.rejectionReason` (Task 1).
- Produces: editar una canción propia rechazada la re-envía a moderación (`isPublic=true, isVerified=false, rejectionReason=null`, local y nube).

- [ ] **Step 1: Test que falla**

Agregar en `src/test/SongEditorModal.test.tsx` (el mock del store de ese archivo define `editingSong`; seguir su patrón para inyectar una canción rechazada propia del usuario mockeado):

```tsx
  it('editar una cancion propia rechazada la re-envia a moderacion', async () => {
    // editingSong: propia del user mockeado, con remoteId, rechazada
    setMockEditingSong({
      id: 7, remoteId: 700, userId: MOCK_USER_ID,
      title: 'Rechazada', artist: '', lyrics: 'x', key: '', tags: [], language: 'Español',
      usageCount: 0, isPublic: false, isVerified: false, rejectionReason: 'letra incompleta',
      createdAt: new Date(), updatedAt: new Date(),
    })
    vi.mocked(updateSong).mockResolvedValue(null as any)
    render(<SongEditorModal />)

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(updateSong).toHaveBeenCalled())
    const [, updates] = vi.mocked(updateSong).mock.calls[0]
    expect(updates.isPublic).toBe(true)
    expect(updates.isVerified).toBe(false)
    expect(updates.rejectionReason).toBeNull()
  })
```

(`setMockEditingSong`/`MOCK_USER_ID`: si el mock del store del archivo no expone un setter, crearlo siguiendo la estructura del `vi.mock('@/stores', ...)` existente — el mock actual resuelve un objeto de estado fijo; convertir ese objeto en variable mutable del módulo de test.)

- [ ] **Step 2: Verificar que falla**

Run: `pnpm vitest run src/test/SongEditorModal.test.tsx`
Expected: FAIL — `isPublic` esperado true / updateSong sin rejectionReason.

- [ ] **Step 3: Implementar**

En `handleSave`, antes de la rama de actualización, calcular:

```ts
      // Canción propia rechazada: al editarla se re-envía a moderación
      const resubmit = !!editingSong && !editingSong.isPublic &&
        !!editingSong.rejectionReason && editingSong.userId === user?.id
```

En el `db.songs.update` de la rama de actualización (la de canciones propias, NO la de `isCommunitySong`), cambiar las tres líneas de estado:

```ts
        await db.songs.update(editingSong.id, {
          ...form,
          remoteId: canEditCloud ? editingSong.remoteId : undefined,
          isPublic: resubmit ? true : (canEditCloud ? editingSong.isPublic : false),
          isVerified: resubmit ? false : (canEditCloud ? editingSong.isVerified : false),
          ...(resubmit && { rejectionReason: null }),
          updatedAt: now,
          userId: editingSong.userId,
        })
```

En el bloque `if (canEditCloud && editingSong?.remoteId)` del sync a nube, cambiar las dos líneas de estado y agregar el clear:

```ts
          isPublic: resubmit ? true : editingSong.isPublic,
          isVerified: resubmit ? false : editingSong.isVerified,
          ...(resubmit && { rejectionReason: null }),
```

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm vitest run src/test/SongEditorModal.test.tsx && pnpm tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/songs/SongEditorModal.tsx src/test/SongEditorModal.test.tsx
git commit -m "feat(biblioteca): editar una cancion rechazada la re-envia a moderacion"
```

---

### Task 4: Helpers puros de biblioteca unificada — TDD

**Files:**
- Create: `src/utils/librarySongs.ts`
- Test: `src/test/librarySongs.test.ts` (ampliar el de Task 1)

**Interfaces:**
- Consumes: tipo `Song`.
- Produces (Task 5 los importa):
  - `inUnifiedLibrary(s: Song, userId?: string, isAdmin?: boolean): boolean`
  - `dedupImported(songs: Song[], userId?: string): Song[]`

- [ ] **Step 1: Tests que fallan**

Agregar a `src/test/librarySongs.test.ts`:

```ts
import { inUnifiedLibrary, dedupImported } from '@/utils/librarySongs'
import type { Song } from '@/types'

const base: Song = {
  title: 'x', artist: '', lyrics: '', key: '', tags: [], language: 'Español',
  usageCount: 0, isPublic: false, isVerified: false, createdAt: new Date(), updatedAt: new Date(),
}

describe('inUnifiedLibrary', () => {
  it('incluye canciones propias en cualquier estado', () => {
    expect(inUnifiedLibrary({ ...base, userId: 'u1', isPublic: false }, 'u1')).toBe(true)
    expect(inUnifiedLibrary({ ...base, userId: 'u1', isPublic: true, rejectionReason: null }, 'u1')).toBe(true)
  })

  it('incluye comunidad solo si publica Y verificada', () => {
    expect(inUnifiedLibrary({ ...base, remoteId: 9, userId: 'otro', isPublic: true, isVerified: true }, 'u1')).toBe(true)
    expect(inUnifiedLibrary({ ...base, remoteId: 9, userId: 'otro', isPublic: true, isVerified: false }, 'u1')).toBe(false)
    expect(inUnifiedLibrary({ ...base, remoteId: 9, userId: 'otro', isPublic: false }, 'u1')).toBe(false)
  })

  it('incluye locales sin remoteId (guest) y admin ve todo', () => {
    expect(inUnifiedLibrary({ ...base }, undefined)).toBe(true)
    expect(inUnifiedLibrary({ ...base, remoteId: 9, userId: 'otro', isPublic: true, isVerified: false }, 'admin1', true)).toBe(true)
  })
})

describe('dedupImported', () => {
  it('oculta el original de comunidad cuando existe mi copia importada', () => {
    const original: Song = { ...base, id: 1, remoteId: 100, userId: 'otro', isPublic: true, isVerified: true }
    const miCopia: Song = { ...base, id: 2, userId: 'u1', importadaDe: 100 }
    const out = dedupImported([original, miCopia], 'u1')
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe(2)
  })

  it('no oculta nada si la copia es de otro usuario', () => {
    const original: Song = { ...base, id: 1, remoteId: 100, userId: 'u1', isPublic: true, isVerified: true }
    const copiaAjena: Song = { ...base, id: 2, userId: 'u1', importadaDe: 999 }
    expect(dedupImported([original, copiaAjena], 'u1')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `pnpm vitest run src/test/librarySongs.test.ts`
Expected: FAIL — módulo `@/utils/librarySongs` no existe.

- [ ] **Step 3: Implementar `src/utils/librarySongs.ts`**

```ts
import type { Song } from '@/types'

/** Biblioteca unificada: mis canciones (cualquier estado) + comunidad aprobada. */
export function inUnifiedLibrary(s: Song, userId?: string, isAdmin = false): boolean {
  if (isAdmin) return true
  if (userId && s.userId === userId) return true // mías: pendientes/rechazadas/privadas incluidas
  if (!s.remoteId) return true                   // locales sin dueño (modo guest)
  return !!s.isPublic && !!s.isVerified          // comunidad: solo aprobadas
}

/** Si el usuario importó una canción de comunidad, oculta el original (muestra solo su copia). */
export function dedupImported(songs: Song[], userId?: string): Song[] {
  if (!userId) return songs
  const importadas = new Set(
    songs.filter(s => s.userId === userId && s.importadaDe != null).map(s => s.importadaDe!)
  )
  if (importadas.size === 0) return songs
  return songs.filter(s => !(s.remoteId != null && importadas.has(s.remoteId) && s.userId !== userId))
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `pnpm vitest run src/test/librarySongs.test.ts`
Expected: PASS (7 tests con los de Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/utils/librarySongs.ts src/test/librarySongs.test.ts
git commit -m "feat(biblioteca): helpers puros de biblioteca unificada con dedup"
```

---

### Task 5: LibraryView unificada (sin pestañas) + badge de rechazada

**Files:**
- Modify: `src/pages/LibraryView.tsx` (múltiples zonas — anclas exactas abajo)

**Interfaces:**
- Consumes: `inUnifiedLibrary`, `dedupImported` de `@/utils/librarySongs` (Task 4); `Song.rejectionReason` (Task 1).
- Produces: una sola lista, sin `libraryTab`.

- [ ] **Step 1: Eliminar el concepto de pestañas**

En `src/pages/LibraryView.tsx`:

1. Borrar el tipo `LibraryTab` y las funciones `matchesTab` y `matchesSearch` (líneas ~16-31) y agregar el import:
```ts
import { inUnifiedLibrary, dedupImported } from '@/utils/librarySongs'
```
2. Borrar `const [libraryTab, setLibraryTab] = useState<...>('community')` (línea ~54).
3. En la query de `songs` (línea ~275), reemplazar
```ts
    results = results.filter(s => matchesTab(s, libraryTab, user?.id, userRole === 'admin'))
```
por
```ts
    results = dedupImported(
      results.filter(s => inUnifiedLibrary(s, user?.id, userRole === 'admin')),
      user?.id
    )
```
y quitar `libraryTab` del array de dependencias del `useLiveQuery` (línea ~303).
4. Borrar el bloque completo de `otherTab` / `otherTabCount` (líneas ~305-314) y el botón `cross-tab-hint` del JSX (líneas ~576-594).
5. Borrar el `<div className="library-tabs">...</div>` completo (líneas ~524-538).
6. Header (línea ~495): título fijo y conteo unificado:
```tsx
            <h1><Library size={18} style={{ display: 'inline', marginRight: 8 }} />Biblioteca</h1>
```
y en el subtítulo del conteo:
```tsx
              {songs.length} de {totalRemoteSongs ? totalRemoteSongs.toLocaleString('es') : '...'} canciones
```
7. Sección de recientes (línea ~555): quitar `libraryTab === 'locals' &&` (queda `!localSearch && recentSongs && recentSongs.length > 0`).
8. Estado vacío (~línea 609): eliminar el ternario por pestaña; dejar solo la rama de "locals" (crear canción / buscar online) con texto neutro:
```tsx
                <h3>No hay canciones aquí</h3>
                <p>Crea una canción nueva o ajusta tu búsqueda.</p>
```
(los botones existentes de crear/buscar online se conservan tal cual).
9. Botón "Crear «texto»" (línea ~645): quitar la condición `libraryTab === 'locals' &&`.
10. Quitar imports que queden sin uso (`Music2`/`Globe` solo si ya no se usan en el archivo — verificar con tsc).

- [ ] **Step 2: Badge de rechazada en `SongListItem`**

En `getStatusIcon` (línea ~755), reemplazar la primera línea por:

```tsx
    if (!song.isPublic && song.rejectionReason) return <span title={`Rechazada: ${song.rejectionReason}`}><X size={12} style={{ color: 'var(--red, #e5484d)' }} /></span>
    if (!song.isPublic) return <span title="No publicada — solo visible para ti"><Lock size={12} className="status-icon-private" /></span>
```

(el resto de `getStatusIcon` queda igual; el botón "Publicar" existente ya solo aparece para `!song.isPublic`, que ahora significa "privada pre-migración o rechazada" — correcto: publicar una rechazada corregida también es válido manualmente, y el re-envío automático de Task 3 cubre el caso de edición).

- [ ] **Step 3: Verificar**

Run: `pnpm tsc --noEmit && pnpm vitest run && pnpm build`
Expected: tsc limpio (atención a imports sin uso), suite completa PASS, build OK.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LibraryView.tsx
git commit -m "feat(biblioteca): biblioteca unificada sin pestanas con badges de estado"
```

---

### Task 6: Verificación end-to-end

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa + build**

Run: `pnpm tsc --noEmit && pnpm vitest run && pnpm build`
Expected: todo verde.

- [ ] **Step 2: Prueba funcional (con `pnpm dev`)**

1. Biblioteca muestra una sola lista con título "Biblioteca" (sin pestañas).
2. Crear canción → toast "enviada a revisión" → aparece en la lista con ícono reloj (pendiente).
3. En `/admin` → Pendientes: la canción aparece. Rechazarla con motivo.
4. En Biblioteca: la canción muestra la X roja con el motivo en tooltip. Solo la ve su creador.
5. Editarla y guardar → vuelve a Pendientes (reloj) y desaparece la X.
6. Aprobarla en admin → ícono escudo (verificada).
7. Canción privada vieja (si existe): ícono candado + botón Publicar visible.

Expected: los 7 pasos funcionan.

- [ ] **Step 3: Commit final si hubo ajustes**

```bash
git add -A && git commit -m "feat(biblioteca): biblioteca unificada end-to-end"
```

Luego usar superpowers:finishing-a-development-branch.

---

## Self-review (hecho al escribir el plan)

- **Cobertura del spec:** creación→moderación (T2), re-envío de rechazadas (T3), lista unificada + dedup importadaDe (T4+T5), badges pendiente/rechazada/no-publicada (T5), botón Publicar solo para privadas viejas (T5 Step 2, ya condicionado por `!isPublic`), freemium intacto (sin cambios), admin intacto (sin tareas). ✓
- **Placeholders:** los dos tests de Task 2/3 indican explícitamente ajustar selectores/mocks al patrón real del archivo de test — es una verificación dirigida, no un TBD; el resto es código completo. ✓
- **Consistencia de tipos:** `rejectionReason?: string | null` (T1) usado igual en T3 (null al limpiar) y T5 (truthy check); `inUnifiedLibrary`/`dedupImported` firmas idénticas en T4 y T5. ✓
