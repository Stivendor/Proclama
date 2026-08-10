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
| `source_url` | `text` | URL de origen. El buscador de letras online (lrclib) la escribe en cada import (`https://lrclib.net/api/get/<id>`), ver `src/services/lyricsImport.ts` |
| `rejection_reason` | `text` | Motivo de rechazo (moderación) |
| `usage_count` | `integer` | Contador de usos en proyección |
| `created_at` | `timestamptz` | Fecha de creación |
| `updated_at` | `timestamptz` | Fecha de última modificación |

**Estados de una canción**:
- `is_public=false, is_verified=false` → Privada (solo el dueño la ve)
- `is_public=true, is_verified=false` → Pendiente de moderación (ícono reloj ⏳)
- `is_public=true, is_verified=true` → Pública y verificada (ícono shield ✓)

**Visibilidad pública real (desde `20260810154735`)**: la política `songs_select_public`
exige `is_public = true AND is_verified = true`. Antes de esa migración solo se
comprobaba `is_public`, así que la cola de aprobación era cosmética: lo que
esperaba revisión ya se veía en el catálogo público. El autor sigue leyendo sus
propias canciones sin esa condición (`songs_select_own`), para poder proyectar
lo que acaba de importar sin esperar aprobación.

**Guard de escritura de `is_verified`** (trigger `songs_enforce_verification`,
función `enforce_song_verification()`, migraciones `20260810155417` →
`20260810160254` → `20260810170442`): `is_verified` es inmutable para quien no
sea admin/service_role.
- En `INSERT` siempre se fuerza a `false`, sin importar lo que envíe el cliente.
- En `UPDATE`, el autor no puede tocarlo: conserva el valor que ya tenía.
- Si el autor edita el contenido (`lyrics`, `title` o `artist`) de una canción
  ya verificada, `is_verified` vuelve a `false` automáticamente — un cambio de
  contenido reabre la revisión. Tocar solo tonalidad, etiquetas o idioma no la
  reabre.
- Los administradores (`is_admin()`/`is_superadmin()`) y `service_role` quedan
  exentos: es exactamente lo que hace `approve()`/`saveChanges` en
  `PendingSongsPage`.

**Trampa operativa — `pg_restore` y `COPY` disparan este trigger.** El guard es
`BEFORE INSERT ... FOR EACH ROW`, y tanto `pg_restore` como `COPY` corren fila a
fila disparando triggers `BEFORE INSERT` igual que un `INSERT` normal. Restaurar
un backup de `songs` sin `--disable-triggers` (o sin ejecutarlo como uno de los
roles exentos) forzaría `is_verified=false` en las ~3100 canciones del catálogo,
y el catálogo público desaparecería de golpe, sin ningún error visible. Por eso
el guard comprueba `current_user IN ('postgres', 'supabase_admin',
'service_role')` además de `auth.role() = 'service_role'`: en una conexión
directa (`psql`, SQL editor de Studio, `supabase db push`, un restore) no hay
sesión de Auth y `auth.role()` devuelve `NULL`, que sin ese chequeo adicional
dejaba pasar la escritura pero con `is_verified` ya forzado a `false`, en
silencio.

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
| `20260810154735_online_search_visibility.sql` | Visibilidad pública exige `is_verified`; elimina `search_songs_community` (agujero `SECURITY DEFINER`); añade `community_artists()` |
| `20260810155417_songs_verification_write_guard.sql` | Trigger que congela `is_verified` para quien no sea admin: cierra el lado de escritura de la cola de aprobación |
| `20260810160254_verification_guard_hardening.sql` | Corrige el guard anterior: cubre `current_user` (conexión directa/`pg_restore`), quita `SECURITY DEFINER` innecesario, revoca `TRUNCATE` de `anon` |
| `20260810170442_requeue_verified_song_on_edit.sql` | Editar `lyrics`/`title`/`artist` de una canción ya verificada la devuelve a la cola de revisión |

---

## Búsqueda Full-Text (FTS)

**Eliminada** (migración `20260810154735`). `search_songs_community` era
`SECURITY DEFINER` — se saltaba RLS — con `public_only=false` por defecto y
concedida a `anon`: cualquiera con la clave anónima podía pedir la tabla
entera, incluidas canciones privadas de otros usuarios. No tenía consumidores
ni en el cliente ni en Edge Functions, así que se borró sin reemplazo; hoy la
búsqueda en el catálogo local es en cliente (`LibraryView`, filtrando sobre lo
ya sincronizado a Dexie) y la búsqueda de letras online usa lrclib
(`src/services/lyricsSearch.ts`), no esta función.

Si algún día hace falta reintroducir búsqueda comunitaria en servidor, la
función tiene que ser `SECURITY INVOKER` (para que respete RLS) y **sin ningún
parámetro capaz de desactivar el filtro** — el `public_only=false` de la
versión anterior era exactamente el agujero.

---

## Edge Functions

| Función | Propósito |
|---------|-----------|
| `api-bible-proxy` | Proxy para API de Biblia, protege la API key del servidor |

Las funciones validan autenticación y restringen CORS antes de operar.
