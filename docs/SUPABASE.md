# Supabase - Base de Datos y Configuración

## Esquema de Tablas

### `songs`
Catálogo de canciones con soporte para moderación y visibilidad pública/privada.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `bigint PK` | Auto-increment |
| `user_id` | `uuid FK → auth.users` | Dueño de la canción |
| `title` | `text NOT NULL` | Título |
| `artist` | `text` | Artista o autor |
| `lyrics` | `text` | Letra completa |
| `key` | `text` | Tono musical |
| `tags` | `text[]` | Etiquetas |
| `language` | `text` | Idioma (Español, Inglés, Portugués, Otro) |
| `is_public` | `boolean` | Visible para todos los usuarios |
| `is_verified` | `boolean` | Aprobada por admin (visible públicamente) |
| `source_url` | `text` | URL de origen (Genius, lrclib) |
| `rejection_reason` | `text` | Motivo de rechazo (moderación) |
| `usage_count` | `integer` | Contador de usos en proyección |
| `created_at` | `timestamptz` | Fecha de creación |
| `updated_at` | `timestamptz` | Fecha de última modificación |

**Estados de una canción**:
- `is_public=false, is_verified=false` → Privada (solo el dueño la ve)
- `is_public=true, is_verified=false` → Pendiente de moderación (ícono reloj ⏳)
- `is_public=true, is_verified=true` → Pública y verificada (ícono shield ✓)

### `setlists`
Listas de canciones planificadas para servicios.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `bigint PK` | Auto-increment |
| `user_id` | `uuid FK → auth.users` | Dueño del setlist |
| `name` | `text NOT NULL` | Nombre del setlist |
| `date` | `date` | Fecha del servicio |
| `song_ids` | `bigint[]` | IDs de canciones en orden |
| `notes` | `text` | Notas adicionales |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `profiles`
Datos de usuario extendidos (role, plan, preferencias).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid PK FK → auth.users` | Misma ID que auth.users |
| `email` | `text` | Email del usuario |
| `role` | `text` | `'admin'` o `'user'` (CHECK constraint) |
| `plan` | `text` | `'free'` o `'premium'` |
| `premium_expires_at` | `timestamptz` | Fecha de expiración del premium (`NULL` = vitalicio) |
| `terms_version` | `text` | Versión de términos aceptada |
| `terms_accepted_at` | `timestamptz` | Fecha de aceptación de términos |
| `settings` | `jsonb` | Preferencias del usuario |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `backgrounds`
Fondos multimedia (imágenes/videos) para proyección.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `bigint PK` | |
| `user_id` | `uuid FK → auth.users` | |
| `url` | `text` | URL del archivo |
| `type` | `text` | `'image'` o `'video'` |
| `category` | `text` | Categoría del fondo |
| `thumbnail` | `text` | URL del thumbnail |
| `created_at` | `timestamptz` | |

### `song_reports`
Reportes de usuarios sobre canciones inapropiadas.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid PK` | |
| `song_id` | `bigint FK → songs` | Canción reportada |
| `user_id` | `uuid FK → auth.users` | Usuario que reporta (puede ser null) |
| `reason` | `text` | Motivo del reporte |
| `details` | `text` | Detalles adicionales |
| `created_at` | `timestamptz` | |

### `admin_logs`
Auditoría de acciones del panel de administración.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `bigint PK` | |
| `admin_id` | `uuid FK → auth.users` | Admin que ejecutó la acción |
| `admin_email` | `text` | Email del admin |
| `action` | `text` | Tipo de acción (`approve_song`, `reject_song`, `edit_song`, etc.) |
| `target_type` | `text` | Tipo de objetivo (`song`, `user`, `report`) |
| `target_id` | `text` | ID del objetivo |
| `target_label` | `text` | Nombre/etiqueta del objetivo |
| `note` | `text` | Nota adicional |
| `created_at` | `timestamptz` | |

### Otras tablas
- `attendance_records` — Registro de asistencia (también en Dexie local)
- `feedback` — Comentarios de usuarios
- `premium_interest` — Interés en plan premium
- `user_devices` — Dispositivos registrados por usuario
- `user_activity` — Heartbeat diario por usuario (quién usa la app y cuánto); lectura solo admin vía RPCs `admin_user_activity` / `admin_daily_active_users`

---

## Políticas RLS (Row Level Security)

### Tabla `songs`

Las políticas deben permitir:

| Operación | Usuario regular | Admin |
|-----------|----------------|-------|
| `SELECT` | Sus propias canciones + canciones públicas verificadas | Todas las canciones |
| `INSERT` | Solo sus propias canciones | Solo sus propias canciones |
| `UPDATE` | Solo sus propias canciones | Cualquier canción |
| `DELETE` | Solo sus propias canciones | Cualquier canción |

**Migración aplicada**: `supabase/migrations/20260519000000_songs_admin_rls_policies.sql`

### Tabla `song_reports`

| Operación | Cualquiera | Admin |
|-----------|-----------|-------|
| `INSERT` | Sí (con user_id propio o null) | Sí |
| `SELECT` | No | Sí |
| `DELETE` | No | Sí |

### Notas de Seguridad
- Las políticas RLS deben versionarse en migraciones SQL dentro del repositorio.
- El cliente nunca debe tener acceso directo a tablas sensibles.

---

## Migraciones

Las migraciones están en `supabase/migrations/` y se ejecutan con `supabase migration up`.

| Archivo | Descripción |
|---------|-------------|
| `20260510_attendance_records_complements.sql` | Índices + trigger updated_at |
| `20260513000000_song_reports_anonymous_insert.sql` | Tabla song_reports + RLS |
| `20260516000000_subscription_fields.sql` | Agrega `premium_expires_at` a profiles |
| `20260519000000_songs_admin_rls_policies.sql` | Políticas RLS admin para songs |
| `20260603000000_add_rejection_reason.sql` | Columna `rejection_reason` en songs |
| `20260613000000_rls_hardening.sql` | Endurecimiento de políticas RLS |
| `20260613000001_protect_profile_sensitive_fields.sql` | Protección de campos sensibles en profiles |
| `20260615000000_simplify_roles.sql` | Colapsa roles a `admin`/`user` con CHECK constraint |
| `20260615000001_remove_mp_columns.sql` | Elimina `mp_subscription_id` y `subscription_plan` |
| `20260615000002_protect_premium_expiry.sql` | RLS para proteger `premium_expires_at` |
| `20260615000003_remove_is_authorized.sql` | Elimina columna `is_authorized` |
| `20260615000004_add_attendance_time.sql` | Agrega hora al registro de asistencia |

---

## Búsqueda Full-Text (FTS)

La búsqueda optimizada usa una función RPC `search_songs_community` con `unaccent`:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TEXT SEARCH CONFIGURATION public.spanish_unaccent (COPY = spanish);
ALTER TEXT SEARCH CONFIGURATION public.spanish_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;
```

Requiere crear la función RPC en Supabase. Si no existe, `searchSongs()` en el frontend cae a un fallback básico con `ilike`.

---

## Edge Functions

| Función | Propósito |
|---------|-----------|
| `api-bible-proxy` | Proxy para API de Biblia, protege la API key del servidor |

Las funciones validan autenticación y restringen CORS antes de operar.
