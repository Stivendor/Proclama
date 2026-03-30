# Design Document — church-notes

## Overview

La feature **church-notes** añade una nueva vista "Notas" a Proclama que permite al operador del culto registrar, por fecha, dos tipos de datos: la asistencia numérica y una lista de avisos/anuncios de texto libre. Los datos se persisten localmente en IndexedDB (Dexie) y se sincronizan con Supabase cuando el usuario está autenticado.

La integración sigue exactamente los patrones existentes de la app: nueva entrada en el sidebar, nueva vista en `src/pages/`, extensión incremental de la DB Dexie, y nuevas funciones en `src/services/supabase.ts`. No se modifica la arquitectura actual.

### Decisiones de diseño clave

- **Sin store Zustand dedicado**: el estado de notas es local a la vista (React state + Dexie hooks), ya que no necesita compartirse entre componentes. Esto evita complejidad innecesaria.
- **Entidad por fecha**: cada `ChurchNote` agrupa asistencia + avisos de un día. La clave natural es `(userId, date)` en formato `YYYY-MM-DD`.
- **Sincronización optimista**: las operaciones se aplican primero en Dexie y luego se propagan a Supabase en background. Si Supabase falla, el dato local se conserva y se muestra un toast de error no bloqueante.
- **Selector de fecha nativo**: se usa `<input type="date">` para máxima compatibilidad y consistencia con el sistema operativo, estilizado con las variables CSS existentes.

---

## Architecture

```
src/
├── pages/
│   └── NotesView.tsx          ← Vista principal (nueva)
├── services/
│   └── supabase.ts            ← +fetchChurchNote, +upsertChurchNote, +deleteChurchNote
├── db/
│   └── index.ts               ← ProclamaDB v4: +tabla church_notes
├── types/
│   └── index.ts               ← +ChurchNote, +Notice
├── components/
│   └── Sidebar.tsx            ← +ítem "Notas" con NotebookPen
└── App.tsx                    ← +activeView 'notes', +<NotesView />
```

### Flujo de datos

```
NotesView
  │
  ├─ useLiveQuery(db.church_notes.where({date, userId}))  ← lectura reactiva Dexie
  │
  ├─ saveAttendance()
  │     ├─ db.church_notes.put(...)          ← Dexie primero
  │     └─ upsertChurchNote(...)             ← Supabase si autenticado
  │
  └─ addNotice() / editNotice() / deleteNotice()
        ├─ db.church_notes.put(...)
        └─ upsertChurchNote(...)
```

---

## Components and Interfaces

### NotesView (`src/pages/NotesView.tsx`)

Componente de página principal. Gestiona:
- Selector de fecha (estado local, default = hoy)
- Carga de `ChurchNote` desde Dexie via `useLiveQuery`
- Formulario de asistencia con validación
- Lista de avisos con acciones inline (editar / eliminar)
- Formulario de nuevo aviso
- Toast de error de sincronización

```tsx
// Estructura interna del componente
function NotesView() {
  const [selectedDate, setSelectedDate] = useState<string>(todayISO())
  const [attendanceInput, setAttendanceInput] = useState('')
  const [attendanceError, setAttendanceError] = useState('')
  const [newNoticeText, setNewNoticeText] = useState('')
  const [noticeError, setNoticeError] = useState('')
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null)
  const [syncError, setSyncError] = useState(false)
  const { user } = useAppStore()

  const note = useLiveQuery(
    () => db.church_notes.where({ date: selectedDate, userId: user?.id ?? 'guest' }).first(),
    [selectedDate, user?.id]
  )
  // ...
}
```

### Sidebar (`src/components/Sidebar.tsx`)

Se añade el ítem "Notas" entre "Contador" y "Ajustes":

```tsx
{ id: 'notes', icon: NotebookPen, label: 'Notas' }
```

### NotesService (`src/services/supabase.ts`)

Tres funciones nuevas exportadas:

```ts
fetchChurchNote(date: string, userId: string): Promise<ChurchNote | null>
upsertChurchNote(note: ChurchNote): Promise<ChurchNote | null>
deleteChurchNote(id: string): Promise<void>
```

---

## Data Models

### Tipos TypeScript (`src/types/index.ts`)

```ts
export interface Notice {
  id: string          // nanoid() — UUID local
  text: string
  createdAt: string   // ISO 8601
  updatedAt: string
}

export interface ChurchNote {
  id?: number         // Dexie autoincrement (local)
  remoteId?: string   // UUID de Supabase
  userId: string      // user.id o 'guest'
  date: string        // 'YYYY-MM-DD'
  attendance?: number // entero positivo > 0, undefined si no registrado
  notices: Notice[]   // array JSON serializable
  createdAt: string
  updatedAt: string
}
```

### Dexie — ProclamaDB v4 (`src/db/index.ts`)

```ts
// Versión incremental: no toca versiones 1-3
this.version(4).stores({
  church_notes: '++id, date, userId, [date+userId]'
})
```

El índice compuesto `[date+userId]` permite la query `where({ date, userId })` eficientemente.

### Supabase — tabla `church_notes`

```sql
CREATE TABLE church_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  attendance  INTEGER CHECK (attendance > 0),
  notices     JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- RLS
ALTER TABLE church_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes"
  ON church_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

El campo `notices` se almacena como JSONB para evitar una tabla separada y simplificar las operaciones CRUD.

---

## UX / UI Design

### Layout de NotesView

```
┌─────────────────────────────────────────────────────┐
│  view-header                                        │
│  [NotebookPen] Notas          [selector de fecha]   │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  ┌─ Asistencia ──────────────────────────────────┐  │
│  │  [Users icon]  Asistencia al culto            │  │
│  │  [  input numérico  ]  [Guardar]              │  │
│  │  (mensaje de error si aplica)                 │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ Avisos ──────────────────────────────────────┐  │
│  │  [Megaphone icon]  Avisos          [+ Añadir] │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │ • Texto del aviso 1    [Edit] [Delete]  │  │  │
│  │  │ • Texto del aviso 2    [Edit] [Delete]  │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │  (formulario inline al añadir/editar)          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [toast error sync — no bloqueante, esquina inf.]   │
└─────────────────────────────────────────────────────┘
```

### Principios de diseño aplicados

**Dark theme y variables CSS**
- Todos los colores usan variables `--bg-*`, `--text-*`, `--gold`, `--blue`, `--red`, `--green`
- Secciones con `background: var(--bg-elevated)`, `border: 1px solid var(--border)`, `border-radius: var(--radius-lg)`
- Sin estilos inline ni frameworks externos

**Touch targets y accesibilidad**
- Botones de acción mínimo 44×44px (cumple `btn-icon` existente)
- Labels asociados a inputs con `htmlFor`
- `aria-live="polite"` en mensajes de error para lectores de pantalla
- `aria-current="page"` en el nav item activo (ya implementado en Sidebar)
- Contraste: texto sobre `--bg-elevated` supera ratio 4.5:1 en dark theme

**Responsive 320px+**
- Layout de una columna en mobile; el selector de fecha se mueve bajo el título
- Botones de acción de avisos colapsan a iconos solos en viewports < 480px
- Input de asistencia + botón en flex-row con `flex-wrap: wrap`

**Indicador de fecha actual**
- Cuando `selectedDate === todayISO()`, el selector muestra un badge "Hoy" junto a la fecha
- Fechas históricas muestran el selector sin badge, con `color: var(--text-secondary)`

**Confirmación de eliminación**
- Usa el componente `ConfirmDialog` existente (`src/components/ConfirmDialog.tsx`) para confirmar borrado de avisos

**Toast de error de sincronización**
- Pequeño banner en la parte inferior de la vista, `background: var(--red-dim)`, `color: var(--red)`
- Se descarta automáticamente a los 5 segundos o con clic en X
- No bloquea la interacción con la vista

### Clases CSS nuevas (en `src/index.css`)

```css
/* Notes View */
.notes-view { display: flex; flex-direction: column; height: 100%; }
.notes-body { flex: 1; overflow-y: auto; padding: 16px 24px; display: flex; flex-direction: column; gap: 16px; }
.notes-section { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.notes-section-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.attendance-row { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
.attendance-row input { flex: 1; min-width: 120px; }
.notice-list { display: flex; flex-direction: column; gap: 4px; }
.notice-item { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.notice-text { flex: 1; font-size: 13px; line-height: 1.5; }
.notice-actions { display: flex; gap: 2px; flex-shrink: 0; }
.notice-form { display: flex; flex-direction: column; gap: 8px; padding: 10px; background: var(--bg-base); border: 1px solid var(--border-light); border-radius: var(--radius-sm); }
.notice-form-actions { display: flex; gap: 6px; justify-content: flex-end; }
.field-error { font-size: 12px; color: var(--red); margin-top: 2px; }
.date-today-badge { font-size: 10px; font-weight: 600; color: var(--gold); background: rgba(212,168,67,0.12); padding: 2px 8px; border-radius: 99px; border: 1px solid var(--gold-dim); }
.sync-error-toast { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--red-dim); border: 1px solid var(--red); border-radius: var(--radius-sm); font-size: 12px; color: var(--red); margin: 0 24px 16px; }
```

---

## Error Handling

| Escenario | Comportamiento |
|---|---|
| Valor de asistencia no numérico | Mensaje de error inline bajo el input; no se guarda |
| Valor de asistencia < 1 o 0 | Mensaje de error inline; no se guarda |
| Aviso con texto vacío o solo espacios | Mensaje de error inline; no se añade |
| Fallo en Supabase (upsert/delete) | Dato conservado en Dexie; toast de error no bloqueante 5s |
| No existe `ChurchNote` para la fecha | Vista vacía sin errores, lista para recibir datos |
| Error de lectura Dexie | `useLiveQuery` devuelve `undefined`; vista muestra estado de carga |
| Migración local→Supabase con duplicado | `UPSERT` con `ON CONFLICT (user_id, date) DO UPDATE` evita duplicados |

### Estrategia de migración local → Supabase

Cuando el usuario se autentica y existen notas locales con `userId === 'guest'`:

1. Se leen todas las `ChurchNote` con `userId === 'guest'` desde Dexie
2. Para cada una, se llama `upsertChurchNote` con el `userId` real
3. Si el upsert tiene éxito, se actualiza el registro local con `userId` real y `remoteId`
4. Si falla, el registro local permanece con `userId === 'guest'` para reintento posterior

Esta migración se dispara en `App.tsx` al detectar el evento `SIGNED_IN` de Supabase Auth.

---

## Testing Strategy

### Enfoque dual: unit tests + property-based tests

**Unit tests** (Vitest + Testing Library):
- Validación de asistencia: ejemplos concretos (0, -1, 1.5, "abc", 42)
- Validación de avisos: string vacío, solo espacios, texto válido
- Renderizado de `NotesView` con nota existente vs. vista vacía
- Comportamiento del toast de error (aparece, desaparece a los 5s)
- Integración Dexie: operaciones CRUD sobre `church_notes` con DB en memoria

**Property-based tests** (fast-check):
- Mínimo 100 iteraciones por propiedad
- Cada test referenciado con: `// Feature: church-notes, Property N: <texto>`

### Librería PBT elegida: fast-check

`fast-check` es la librería de property-based testing estándar para TypeScript/JavaScript. Se integra directamente con Vitest:

```ts
import fc from 'fast-check'
import { test, expect } from 'vitest'

test('Property N: descripción', () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 10000 }),
    (attendance) => {
      // Feature: church-notes, Property N: ...
      expect(validateAttendance(attendance)).toBe(true)
    }
  ), { numRuns: 100 })
})
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Validación de asistencia

*Para cualquier* valor entero mayor que cero, la función de validación de asistencia debe aceptarlo. *Para cualquier* valor que no sea un entero positivo (cero, negativo, decimal, cadena no numérica), la función debe rechazarlo y el estado de la nota no debe cambiar.

**Validates: Requirements 2.2, 2.3**

---

### Property 2: Round-trip de asistencia

*Para cualquier* valor de asistencia válido (entero > 0) y cualquier fecha, guardar ese valor en `church_notes` y luego leerlo de vuelta debe producir exactamente el mismo número.

**Validates: Requirements 2.4, 2.5, 2.6**

---

### Property 3: Rechazo de avisos con solo espacios en blanco

*Para cualquier* cadena compuesta únicamente de caracteres de espacio en blanco (incluyendo la cadena vacía, espacios, tabulaciones y saltos de línea), intentar añadirla como aviso debe ser rechazado y la lista de avisos debe permanecer sin cambios.

**Validates: Requirements 3.4**

---

### Property 4: Round-trip de adición de aviso

*Para cualquier* `ChurchNote` y cualquier texto de aviso válido (no vacío, no solo espacios), añadir el aviso y luego leer la nota desde `Notes_DB` debe resultar en una lista de avisos que contiene el nuevo texto.

**Validates: Requirements 3.3, 3.5**

---

### Property 5: Eliminación de aviso

*Para cualquier* `ChurchNote` con al menos un aviso, eliminar un aviso específico debe resultar en que ese aviso ya no aparezca en la lista, y el resto de avisos debe permanecer intacto.

**Validates: Requirements 3.7**

---

### Property 6: Round-trip de edición de aviso

*Para cualquier* aviso existente y cualquier nuevo texto válido, editar el aviso y luego leer la nota debe devolver el aviso con el texto actualizado, sin modificar los demás avisos de la lista.

**Validates: Requirements 3.9**

---

### Property 7: Carga de nota por fecha

*Para cualquier* `ChurchNote` guardada en `Notes_DB` con una fecha D, seleccionar la fecha D en el selector debe cargar exactamente esa nota (misma asistencia y mismos avisos). Si no existe nota para la fecha D, la vista debe mostrar estado vacío sin errores.

**Validates: Requirements 4.2, 6.2, 6.3**

---

### Property 8: Aislamiento sin autenticación

*Para cualquier* operación CRUD sobre notas (crear, actualizar, eliminar) realizada cuando el usuario no está autenticado, el servicio no debe realizar ninguna llamada a Supabase y debe operar exclusivamente sobre `Notes_DB` local.

**Validates: Requirements 5.2**

---

### Property 9: Preservación local ante fallo de sincronización

*Para cualquier* `ChurchNote` guardada localmente, si la operación de sincronización con Supabase falla (error de red, error de servidor), el registro en `Notes_DB` debe permanecer exactamente igual que antes del intento de sincronización.

**Validates: Requirements 5.3**

---

### Property 10: Idempotencia de migración local → Supabase

*Para cualquier* conjunto de notas locales con `userId === 'guest'`, ejecutar la migración dos veces consecutivas debe producir el mismo número de registros en Supabase que ejecutarla una sola vez (sin duplicados).

**Validates: Requirements 5.4**

---

### Property 11: Actualización no destructiva de la base de datos

*Para cualquier* instancia de `ProclamaDB` con datos en las tablas `songs`, `setlists` y `settings` (versión 3), actualizar a la versión 4 (que añade `church_notes`) debe dejar todos los registros existentes en esas tablas intactos y accesibles.

**Validates: Requirements 4.4**

---

### Property 12: Ítem activo en el sidebar

*Para cualquier* valor de `activeView`, el ítem "Notas" del sidebar debe tener la clase `active` si y solo si `activeView === 'notes'`. Para cualquier otro valor de `activeView`, el ítem "Notas" no debe tener la clase `active`.

**Validates: Requirements 1.3**

