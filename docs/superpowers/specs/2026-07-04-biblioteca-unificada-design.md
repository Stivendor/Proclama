# Biblioteca unificada + moderación automática — Diseño

**Fecha:** 2026-07-04
**Estado:** Aprobado (enfoque A, migración solo hacia adelante)

## Problema

Las pestañas "Mi Cancionero" / "Comunidad" confunden a los equipos (mismo concepto, dos lugares). Además, publicar una canción a la comunidad requiere un paso manual ("Publicar") que casi nadie ejecuta, así que la biblioteca global crece menos de lo que podría.

## Decisiones tomadas

- **Sin canciones privadas hacia adelante**: toda canción creada se envía automáticamente a moderación pública.
- **Freemium sin cambios**: `canCreateSong` / `FREE_SONG_LIMIT` siguen aplicando a canciones creadas por el usuario.
- **Migración solo hacia adelante**: las canciones privadas existentes NO se auto-envían; conservan su botón "Publicar" individual (evita inundar la cola de moderación con material viejo).

## Solución

### 1. Creación → moderación automática

En `SongEditorModal`, la rama de creación sube a Supabase con `is_public = true, is_verified = false` (hoy sube `is_public = false`). Con eso la canción:

- Aparece automáticamente en **Pendientes** del panel admin (`PendingSongsPage` ya filtra público + no verificado — cero cambios allí).
- Es usable y proyectable por su creador de inmediato, sin esperar aprobación.
- Si el admin la rechaza: `is_public = false` + `rejection_reason` (flujo existente); solo la ve su creador, con el motivo.

### 2. Biblioteca unificada (`LibraryView`)

- Eliminar `libraryTab`, las dos pestañas, `otherTabCount` y el botón `cross-tab-hint`.
- Query única: **verificadas públicas ∪ canciones del usuario** (cualquier estado).
- **Dedup**: si el usuario importó una canción de comunidad (`importadaDe`), se muestra solo su copia local, no el original.
- **Badges de estado** en `SongListItem`, visibles solo para canciones propias:
  - 🟠 "Pendiente" — `isPublic && !isVerified`
  - 🔴 "Rechazada" — `!isPublic && rejectionReason` (tooltip con el motivo)
  - ⚪ "No publicada" — `!isPublic && !rejectionReason` (canciones privadas pre-migración) + botón "Publicar" existente solo en este estado
  - Sin badge — aprobada / de comunidad
- El botón "Publicar" desaparece para todo lo demás.
- Filtros existentes (búsqueda, tag, idioma) y "Crear «texto» como canción nueva" se mantienen sobre la lista unificada.

### 3. Sin cambios

- Panel admin (PendingSongsPage, aprobar/rechazar, rejection_reason).
- RLS/backend: las columnas y políticas existentes ya permiten este flujo (`handlePublish` ya crea con `is_public=true` hoy).
- Sync de canciones, setlists, colaboradores.

## Errores

- Falla la subida a la nube al crear: comportamiento actual (canción local + alerta de sync fallido); quedará pendiente de moderación cuando el sync la suba.
- Canción rechazada y re-editada por el creador: al guardar se re-envía a moderación (`is_public=true`, `rejection_reason=null`) — el ciclo natural de corrección.

## Testing

- Unit: la rama de creación del editor produce payload `is_public=true, is_verified=false` (test existente de SongEditorModal se ajusta).
- Unit: dedup por `importadaDe` en el filtro de la lista unificada.
- Manual: crear canción → aparece en Pendientes del admin; rechazar → badge con motivo; aprobar → sin badge y visible para otros usuarios.

## Proceso

- Se implementa en la rama `feat/biblioteca-unificada`, creada **después de mergear** `feat/repertorio-colaborativo` a main.

## Fuera de alcance

- Cambios al modelo freemium.
- Auto-enviar canciones privadas existentes a moderación.
- Notificaciones al usuario cuando su canción es aprobada/rechazada (futuro).
