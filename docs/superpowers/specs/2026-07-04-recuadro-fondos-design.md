# Recuadro fijo de fondos de letra — Diseño

**Fecha:** 2026-07-04
**Estado:** Aprobado (enfoque A)

## Problema

El fondo favorito existe (`defaultBackgroundMediaId` + `favoriteBgOverride`): toda letra/versículo proyectado se redirige a esa imagen. Pero se gestiona con una estrella escondida en cada item de la lista de media (a veces dentro de carpetas) y no hay ningún lugar fijo donde ver ni cambiar rápidamente el fondo que va a recibir la letra.

## Solución (enfoque A: extender el store de proyección)

Un **estante fijo de fondos** (`BackgroundShelf`) arriba del sidebar derecho: una pequeña colección de fondos fijados por el usuario, de los cuales el que esté activo recibe toda letra proyectada.

### Estado (src/stores/index.ts)

- Nuevo campo persistido en `useProjectionStore`: `pinnedBackgroundIds: string[]` con setter `setPinnedBackgroundIds` (acepta updater funcional, como `setLocalMediaList`).
- `defaultBackgroundMediaId` sigue siendo "el fondo activo" — sin cambios en su semántica ni en `favoriteBgOverride` (la regla "ninguna letra se superpone a una imagen distinta del fondo activo" ya está implementada ahí y no se toca).
- Migración implícita: si al cargar hay `defaultBackgroundMediaId` pero no está en `pinnedBackgroundIds`, se agrega (auto-pin del favorito existente). Corre en el mismo efecto de `MediaPanel` que hoy valida/limpia el default al (re)cargar la media local.

### BackgroundShelf (componente nuevo, src/components/media/BackgroundShelf.tsx)

- Se renderiza como primera sección dentro de `MediaPanel`, que ya está montado en ambos estados de `ControlPanel` → el recuadro queda fijo siempre.
- Franja de miniaturas de los fondos fijados (solo imágenes; resuelve la URL desde `localMediaList` por id).
- **Clic en miniatura** = activarla como fondo predeterminado (mismo efecto que la estrella actual: `setDefaultBackgroundMediaId(id)` + `updateTheme({ backgroundType: 'image', backgroundImageUrl, backgroundThumbnail: undefined })`). La activa se resalta (borde + estrella).
- **Clic en la activa** = desactivar (`setDefaultBackgroundMediaId(null)` + `updateTheme({ backgroundType: 'color' })`) — queda sin fondo predeterminado.
- **X en hover** = quitar del estante; si era la activa, también se desactiva.
- Vacío: hint corto "Fija fondos con el 📌 de tu media".

### Lista de media (src/components/media/MediaPanel.tsx)

- El botón estrella actual de cada imagen se convierte en **pin** ("Fijar al recuadro de fondos"): agrega/quita el id de `pinnedBackgroundIds`. Ya no marca el default directamente (`toggleDefaultBackground` se reemplaza por `togglePin`).
- Quitar el pin de la imagen activa también la desactiva como default.
- El efecto existente de refresco de blob URL caducado y el de limpieza cuando se borra la imagen default se extienden para depurar también ids fijados que ya no existen en la media local.

## Casos borde

- Imagen borrada de la media local → sale sola del estante (y del default si lo era).
- Solo imágenes se pueden fijar (videos y YouTube no, igual que hoy).
- Sin fondo activo → la letra usa el tema tal cual (comportamiento actual sin favorito).
- Blob URLs caducan al recargar → las miniaturas del estante se resuelven siempre por id contra `localMediaList` (nunca se persiste la URL).

## Fuera de alcance

- Subida directa de imágenes al recuadro (se fija desde la media ya subida).
- Cambios en `favoriteBgOverride`, panel admin, freemium.

## Testing

- Tests puros en `src/test/` para la lógica de pin/activación (helpers si se extraen) siguiendo el patrón de mocks existente; verificación manual del flujo en `pnpm dev`.
