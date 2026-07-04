# Crear canción desde la vista de setlist — Diseño

**Fecha:** 2026-07-04
**Estado:** Aprobado (enfoque A)

## Problema

En `SetlistsView`, el buscador "Agregar canción al set..." solo encuentra canciones existentes. Si la canción no está en la biblioteca, el operador debe ir a Biblioteca, crearla, volver y buscarla — pierde el contexto del setlist.

## Solución

Reutilizar el `SongEditorModal` existente con un callback de "canción creada":

1. **Store** (`src/stores/index.ts`):

   - Nuevo campo `editorOnSaved: ((localId: number) => void) | null` con setter `setEditorOnSaved`.
   - `closeEditor()` lo resetea a `null` (evita callbacks huérfanos si el usuario cancela).
2. **SongEditorModal** (`src/components/songs/SongEditorModal.tsx`):

   - En la rama de creación (tras `const localId = await db.songs.add(...)`), invocar `useAppStore.getState().editorOnSaved?.(localId)` antes de `closeEditor()`.
   - Solo aplica a canciones nuevas; la edición de existentes no dispara el callback.
3. **SetlistsView** (`src/pages/SetlistsView.tsx`):

   - En `search-results-overlay`, como última fila fija (visible siempre que `songSearch` tenga texto): botón *"➕ Crear «{songSearch}» como canción nueva"*.
   - Al pulsarlo: registrar `setEditorOnSaved(cb)` donde `cb` agrega `localId` a `editingSetlist.songIds` vía `updateSetlistInState` (que ya persiste y hace `schedulePush`), limpiar `songSearch`, y abrir `openEditor({ title: songSearch, ... } as Song)` — objeto **sin `id`** con el título pre-llenado para que el modal entre en modo crear.

## Sync con colaborador

Sin trabajo nuevo: la canción sube a la nube por el flujo existente (`createSong` asigna `remoteId` async). Mientras no tenga `remoteId`, el setlist la trata como "solo-local" (comportamiento ya diseñado); el líder la ve tras el siguiente push del setlist con el `remoteId` ya asignado.

## Errores

- Usuario cancela el editor → `closeEditor()` limpia el callback; nada se agrega.
- Canción se crea pero el setlist se cerró mientras tanto → el callback captura el id del setlist (no el estado `editingSetlist` vivo); usa `db.setlists.update` directo si el estado ya no está.

## Testing

- Unit test: `editorOnSaved` se invoca con el id al crear y NO al editar; `closeEditor` lo limpia.
- Manual: buscar texto inexistente → crear → canción queda en el setlist y en la biblioteca.

## Fuera de alcance

- Crear canciones desde la vista del colaborador.
- Prellenar más campos que el título.
