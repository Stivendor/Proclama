# Repertorio colaborativo — Diseño

**Fecha:** 2026-07-03
**Estado:** Aprobado

## Problema

Los setlists de Proclama viven solo en el navegador del operador (Dexie/IndexedDB, sin sync — ver `src/features/setlists/index.ts`). El líder de alabanza no tiene forma de armar el repertorio sin sentarse en la computadora de la iglesia.

## Solución

El operador genera un **link permanente por colaborador** (token aleatorio, revocable). El líder lo abre en cualquier dispositivo — sin cuenta, sin login — y puede **crear y editar setlists**: buscar en la biblioteca de canciones (3000+ en Supabase + las propias del operador), agregar, quitar, reordenar y anotar. Los cambios se sincronizan con el Proclama del operador (realtime si está abierto; al iniciar si no).

## Alcance del colaborador

- ✅ Crear setlists nuevos y editar existentes (nombre, fecha, canciones, orden, notas)
- ✅ Buscar canciones en la nube (públicas verificadas + las del dueño) y ver letras (solo lectura)
- ❌ Editar letras, sugerir canciones nuevas, acceder a cualquier otra parte de Proclama

## Arquitectura

### 1. Datos (Supabase — tablas nuevas)

```sql
setlists (
  id uuid PK default gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users,  -- dueño/operador
  name text NOT NULL,
  date date,
  song_ids bigint[] NOT NULL DEFAULT '{}',       -- remoteIds de songs
  notes text,
  updated_by text NOT NULL DEFAULT 'owner',      -- 'owner' o nombre del colaborador
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

collaborators (
  id uuid PK default gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users,
  name text NOT NULL,                            -- "Juan"
  token text UNIQUE NOT NULL,                    -- aleatorio, >= 32 bytes url-safe
  revoked_at timestamptz,                        -- NULL = activo
  last_seen_at timestamptz,
  created_at timestamptz DEFAULT now()
)
```

RLS activado en ambas tablas. El dueño autenticado hace CRUD de lo suyo (`user_id = auth.uid()` / `owner_id = auth.uid()`). **No hay políticas anónimas directas.**

### 2. Acceso anónimo del líder — RPCs `security definer`

El token es la única llave. Cada RPC valida `token` contra `collaborators` (existe y `revoked_at IS NULL`), actualiza `last_seen_at`, y opera en nombre del dueño:

| RPC | Función |
|---|---|
| `collab_info(token)` | Nombre del colaborador y de la iglesia; error si inválido/revocado |
| `collab_search_songs(token, query, offset)` | Busca en `songs` (públicas verificadas + del dueño), `ilike` sobre título/artista, páginas de ~30. Nunca se descarga la biblioteca completa. |
| `collab_get_song(token, song_id)` | Letra completa para vista read-only |
| `collab_list_setlists(token)` | Setlists del dueño |
| `collab_upsert_setlist(token, setlist)` | Crear/actualizar setlist; fija `updated_by` = nombre del colaborador |
| `collab_delete_setlist(token, id)` | Borrar setlist |

### 3. Sync Dexie ↔ Supabase (patrón `attendanceSync.ts`)

- **Push:** al crear/editar/borrar un setlist local, se sube (mapeando `songIds` locales → `remoteId`).
- **Pull:** al iniciar sesión / reconectar, se bajan los setlists de la nube y se hace merge en Dexie (mapeando `remoteId` → id local; canciones de nube que no están en Dexie se importan como ya hace el sync de canciones).
- **Conflictos:** last-write-wins por `updated_at`.
- **Canciones solo-locales** (sin `remoteId`): se conservan en el setlist local pero no viajan a la nube ni las ve el líder (caso raro; documentado, v1).
- **Realtime (operador):** suscripción `postgres_changes` a `setlists` filtrada por `user_id` (patrón `useAttendanceRealtime`) → cambios del líder visibles al instante.
- **Refresco (líder):** refetch al enfocar la pestaña y tras cada guardado. Sin realtime anónimo en v1.

### 4. Vista pública `/colaborar/:token`

Ruta lazy-loaded en la SPA, sin sidebar ni auth:

- Header: "Hola {nombre} — {iglesia}"
- Lista de setlists + botón "Nuevo repertorio"
- Editor: nombre, fecha, buscador de canciones (server-side, paginado), agregar con +, reordenar drag & drop, quitar, notas
- Modal de letra read-only
- Guardado automático en cada cambio (sin botón "enviar")
- Token inválido/revocado → pantalla "Enlace no válido, pide uno nuevo al administrador"

### 5. Gestión de colaboradores (operador)

En `SetlistsView`, sección "Colaboradores":

- Crear: escribir nombre → se genera link `https://{host}/colaborar/{token}` → botón copiar
- Lista con nombre y último acceso
- Revocar (setea `revoked_at`; el link muere)

## Manejo de errores

- Token inválido/revocado → pantalla dedicada, sin filtrar información.
- Líder offline → los cambios no guardados muestran indicador de error y se reintenta al reconectar (mínimo: aviso "sin conexión, reintentando").
- Operador offline → sync al reconectar (patrón existente).
- RPC caída/lenta → estados de carga y error visibles en la vista pública.

## Testing

- Unit tests: mapeo `songIds` local ↔ `remoteId`, merge last-write-wins del sync (patrón de tests existentes en `src/test/`).
- Migración SQL aplicada primero en rama/entorno de prueba vía MCP de Supabase.
- `get_advisors` tras crear tablas y RPCs para validar RLS y seguridad.

## Fuera de alcance (v1)

- Cuenta/login para el líder
- Merge fino de ediciones simultáneas (gana el último)
- Realtime para el líder
- Sugerir/crear canciones nuevas desde la vista de colaborador
- Permisos por-setlist o links por evento
