# Implementation Plan: church-notes

## Overview

Añadir la vista "Notas" a Proclama: tipos TypeScript, tabla Dexie v4, servicios Supabase, componente de página `NotesView`, integración en `Sidebar` y `App.tsx`, y estilos CSS. El estado es local al componente (React state + `useLiveQuery`), sin store Zustand dedicado.

## Tasks

- [x] 1. Añadir tipos `Notice` y `ChurchNote` a `src/types/index.ts`
  - Añadir la interfaz `Notice` con campos `id`, `text`, `createdAt`, `updatedAt`
  - Añadir la interfaz `ChurchNote` con campos `id?`, `remoteId?`, `userId`, `date`, `attendance?`, `notices`, `createdAt`, `updatedAt`
  - _Requirements: 2.1, 3.1, 4.1_

- [x] 2. Extender `ProclamaDB` a versión 4 con tabla `church_notes`
  - [x] 2.1 Añadir `ChurchNote` como tipo de tabla en `src/db/index.ts`
    - Declarar `church_notes!: Table<ChurchNote>` en la clase `ProclamaDB`
    - Añadir `this.version(4).stores({ church_notes: '++id, date, userId, [date+userId]' })` sin modificar versiones 1-3
    - _Requirements: 4.1, 4.4_

  - [ ]* 2.2 Escribir property test para actualización no destructiva de la DB (Property 11)
    - **Property 11: Actualización no destructiva de la base de datos**
    - Verificar que tras la migración a v4, los registros existentes en `songs`, `setlists` y `settings` permanecen intactos
    - **Validates: Requirements 4.4**

- [x] 3. Implementar funciones de servicio Supabase para `church_notes`
  - [x] 3.1 Añadir `fetchChurchNote`, `upsertChurchNote` y `deleteChurchNote` en `src/services/supabase.ts`
    - `fetchChurchNote(date: string, userId: string): Promise<ChurchNote | null>` — SELECT con filtro `(user_id, date)`
    - `upsertChurchNote(note: ChurchNote): Promise<ChurchNote | null>` — INSERT ... ON CONFLICT (user_id, date) DO UPDATE
    - `deleteChurchNote(id: string): Promise<void>` — DELETE por `id` (remoteId UUID)
    - Mapear snake_case de Supabase a camelCase del frontend en ambas direcciones
    - _Requirements: 5.1, 5.3, 5.4_

  - [ ]* 3.2 Escribir property test para aislamiento sin autenticación (Property 8)
    - **Property 8: Aislamiento sin autenticación**
    - Para cualquier operación CRUD sin usuario autenticado, verificar que no se llama a ninguna función de Supabase
    - **Validates: Requirements 5.2**

  - [ ]* 3.3 Escribir property test para preservación local ante fallo de sincronización (Property 9)
    - **Property 9: Preservación local ante fallo de sincronización**
    - Simular fallo de Supabase y verificar que el registro en Dexie permanece igual tras el intento
    - **Validates: Requirements 5.3**

  - [ ]* 3.4 Escribir property test para idempotencia de migración local → Supabase (Property 10)
    - **Property 10: Idempotencia de migración local → Supabase**
    - Ejecutar la migración de notas `guest` dos veces y verificar que no se crean duplicados en Supabase
    - **Validates: Requirements 5.4**

- [ ] 4. Checkpoint — Verificar tipos, DB y servicios
  - Asegurarse de que no hay errores de TypeScript en los archivos modificados hasta este punto. Preguntar al usuario si hay dudas.

- [x] 5. Implementar lógica de validación pura para asistencia y avisos
  - [x] 5.1 Crear funciones `validateAttendance(value: unknown): boolean` y `validateNoticeText(text: string): boolean` en `src/pages/NotesView.tsx` (o en un módulo auxiliar si se prefiere)
    - `validateAttendance`: acepta solo enteros > 0; rechaza 0, negativos, decimales y no numéricos
    - `validateNoticeText`: rechaza cadenas vacías o compuestas solo de espacios en blanco
    - _Requirements: 2.2, 2.3, 3.4_

  - [ ]* 5.2 Escribir property test para validación de asistencia (Property 1)
    - **Property 1: Validación de asistencia**
    - `fc.integer({ min: 1, max: 100000 })` → `validateAttendance` debe retornar `true`
    - `fc.oneof(fc.constant(0), fc.integer({ max: -1 }), fc.float({ noNaN: true }).filter(n => !Number.isInteger(n)), fc.string())` → debe retornar `false`
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 5.3 Escribir property test para rechazo de avisos con solo espacios (Property 3)
    - **Property 3: Rechazo de avisos con solo espacios en blanco**
    - `fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'))` → `validateNoticeText` debe retornar `false`
    - `fc.string().filter(s => s.trim().length > 0)` → debe retornar `true`
    - **Validates: Requirements 3.4**

- [x] 6. Implementar `NotesView` — estructura base y selector de fecha
  - Crear `src/pages/NotesView.tsx` con estado local: `selectedDate` (default `todayISO()`), `syncError`
  - Añadir helper `todayISO()` que retorna la fecha actual en formato `YYYY-MM-DD`
  - Renderizar el `view-header` con icono `NotebookPen`, título "Notas" y `<input type="date">` para `selectedDate`
  - Mostrar badge "Hoy" (`date-today-badge`) cuando `selectedDate === todayISO()`
  - Usar `useLiveQuery` de `dexie-react-hooks` para cargar la `ChurchNote` de `(selectedDate, userId ?? 'guest')`
  - _Requirements: 1.2, 4.2, 4.3, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.1 Escribir property test para carga de nota por fecha (Property 7)
    - **Property 7: Carga de nota por fecha**
    - Para cualquier `ChurchNote` guardada con fecha D, seleccionar D debe cargar exactamente esa nota; para fechas sin nota, el resultado debe ser `undefined`/vacío
    - **Validates: Requirements 4.2, 6.2, 6.3**

- [x] 7. Implementar sección de asistencia en `NotesView`
  - Añadir estado local `attendanceInput` y `attendanceError`
  - Renderizar sección `.notes-section` con icono `Users`, input numérico y botón "Guardar"
  - Al confirmar: validar con `validateAttendance`; si válido, hacer `db.church_notes.put(...)` y llamar `upsertChurchNote` si hay usuario autenticado; si falla Supabase, mostrar `syncError`
  - Mostrar el valor guardado en el input al cargar la nota del día
  - Mostrar `.field-error` si la validación falla
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3_

  - [ ]* 7.1 Escribir property test para round-trip de asistencia (Property 2)
    - **Property 2: Round-trip de asistencia**
    - Para cualquier entero > 0 y cualquier fecha, guardar en Dexie y leer de vuelta debe producir el mismo número
    - **Validates: Requirements 2.4, 2.5, 2.6**

- [x] 8. Implementar sección de avisos en `NotesView`
  - [x] 8.1 Renderizar lista de avisos y formulario de nuevo aviso
    - Añadir estado local `newNoticeText`, `noticeError`, `editingNoticeId`
    - Renderizar sección `.notes-section` con icono `Megaphone`, lista `.notice-list` y botón "+ Añadir" (`Plus`)
    - Mostrar formulario inline `.notice-form` al pulsar "Añadir"
    - _Requirements: 3.1, 3.2_

  - [x] 8.2 Implementar `addNotice`
    - Validar con `validateNoticeText`; si válido, crear `Notice` con `nanoid()`, añadirlo a `notices[]`, hacer `db.church_notes.put(...)` y llamar `upsertChurchNote` si autenticado
    - Mostrar `.field-error` si el texto es inválido
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ]* 8.3 Escribir property test para round-trip de adición de aviso (Property 4)
    - **Property 4: Round-trip de adición de aviso**
    - Para cualquier texto válido, añadir el aviso y leer la nota debe incluir ese texto en `notices[]`
    - **Validates: Requirements 3.3, 3.5**

  - [x] 8.4 Implementar `deleteNotice` con confirmación
    - Al pulsar el botón de eliminar (`Trash2`), abrir `ConfirmDialog` existente
    - Al confirmar, filtrar el aviso de `notices[]`, hacer `db.church_notes.put(...)` y llamar `upsertChurchNote`
    - _Requirements: 3.6, 3.7_

  - [ ]* 8.5 Escribir property test para eliminación de aviso (Property 5)
    - **Property 5: Eliminación de aviso**
    - Para cualquier `ChurchNote` con ≥1 aviso, eliminar uno debe resultar en que ese aviso no aparezca y el resto permanezca intacto
    - **Validates: Requirements 3.7**

  - [x] 8.6 Implementar `editNotice`
    - Al pulsar el botón de editar (`Pencil`), mostrar el texto del aviso en un campo editable con el contenido previo
    - Al confirmar, validar con `validateNoticeText`, actualizar `text` y `updatedAt` del aviso, hacer `db.church_notes.put(...)` y llamar `upsertChurchNote`
    - _Requirements: 3.8, 3.9_

  - [ ]* 8.7 Escribir property test para round-trip de edición de aviso (Property 6)
    - **Property 6: Round-trip de edición de aviso**
    - Para cualquier aviso existente y cualquier nuevo texto válido, editar y leer debe devolver el texto actualizado sin modificar los demás avisos
    - **Validates: Requirements 3.9**

- [ ] 9. Checkpoint — Verificar lógica de notas y persistencia
  - Asegurarse de que todos los tests no opcionales pasan. Preguntar al usuario si hay dudas.

- [x] 10. Añadir ítem "Notas" al `Sidebar`
  - Importar `NotebookPen` de `lucide-react`
  - Añadir `{ id: 'notes', icon: NotebookPen, label: 'Notas' }` al array `nav` entre `'countdown'` y `'settings'`
  - _Requirements: 1.1, 1.3_

  - [ ]* 10.1 Escribir property test para ítem activo en el sidebar (Property 12)
    - **Property 12: Ítem activo en el sidebar**
    - Para cualquier valor de `activeView`, el ítem "Notas" tiene clase `active` si y solo si `activeView === 'notes'`
    - **Validates: Requirements 1.3**

- [x] 11. Integrar `NotesView` en `App.tsx`
  - Añadir `'notes'` al tipo union de `activeView` en `src/stores/index.ts`
  - Importar `NotesView` en `App.tsx`
  - Añadir `{activeView === 'notes' && <NotesView />}` en `MainApp`
  - Añadir lógica de migración `guest → userId` en el handler `SIGNED_IN` de `onAuthStateChange`: leer notas con `userId === 'guest'`, llamar `upsertChurchNote` para cada una, actualizar `userId` y `remoteId` en Dexie si el upsert tiene éxito
  - _Requirements: 1.2, 1.4, 5.4_

- [x] 12. Añadir clases CSS de `notes-view` a `src/index.css`
  - Añadir al final del archivo todas las clases definidas en el design: `.notes-view`, `.notes-body`, `.notes-section`, `.notes-section-header`, `.attendance-row`, `.notice-list`, `.notice-item`, `.notice-text`, `.notice-actions`, `.notice-form`, `.notice-form-actions`, `.field-error`, `.date-today-badge`, `.sync-error-toast`
  - Usar exclusivamente variables CSS existentes (`--bg-*`, `--text-*`, `--gold`, `--blue`, `--red`, `--border`, `--radius-*`)
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 13. Checkpoint final — Verificar integración completa
  - Asegurarse de que todos los tests pasan y que no hay errores de TypeScript. Preguntar al usuario si hay dudas antes de cerrar.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos para trazabilidad
- Los property tests usan `fast-check` integrado con Vitest: `import fc from 'fast-check'`
- Los tests de propiedades deben anotarse con `// Feature: church-notes, Property N: <texto>`
- `nanoid` ya está disponible en el proyecto o puede instalarse con `npm i nanoid`
- La migración `guest → userId` se dispara en `App.tsx` al detectar el evento `SIGNED_IN`
