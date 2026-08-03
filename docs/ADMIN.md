# Panel de Administración

El panel de administración se accede mediante la ruta `/admin` y permite gestionar usuarios, canciones y reportes.

---

## Acceso

Solo usuarios con `role = 'admin'` en la tabla `profiles` pueden acceder. La protección se maneja en `AdminGuard.tsx`.

Para asignar rol admin a un usuario, ejecutar en Supabase SQL:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = '<user-uuid>';
```

---

## Secciones

### Dashboard (`/`)
Resumen con tarjetas de estadísticas:
- Usuarios totales
- Usuarios premium
- Canciones verificadas
- Reportes abiertos
- Canciones pendientes de moderación
- Feedback sin leer

Datos obtenidos de `fetchAdminStats()` en `adminQueries.ts`.

### Pendientes (Clock icon)
Canciones con `is_public=true` e `is_verified=false`, ordenadas por fecha descendente.

**Acciones disponibles**:
- **Aprobar**: Cambia `is_verified` a `true`. La canción se vuelve visible para todos.
- **Rechazar**: Pide un motivo, luego cambia `is_public` a `false` y guarda el motivo como `rejection_reason`.
- **Editar**: Modal para modificar título, artista, letra e idioma antes de aprobar.
- **Aprobación masiva**: Seleccionar varias canciones con checkbox y aprobar todas juntas.

La página hace polling cada 30 segundos para detectar nuevas canciones pendientes.

### Biblioteca Global (Globe icon)
Tabla paginada de todas las canciones en Supabase.

**Filtros**: búsqueda por texto, idioma, estado de verificación.

**Acciones**:
- Alternar verificación (verify/unverify)
- Editar canción
- Eliminar canción (con confirmación)

### Usuarios (Users icon)
Lista paginada de usuarios con filtros por búsqueda, plan y rol.

**Acciones**:
- Cambiar plan entre free/premium
- Cambiar rol entre user/admin

### Reportes (AlertTriangle icon)
Reportes de usuarios sobre canciones inapropiadas, ordenados por fecha.

Muestra el título, artista, letra e idioma de la canción reportada.

**Acciones**: Resolver reporte (lo elimina de la lista).

### Feedback (MessageSquare icon)
Comentarios y sugerencias enviados por usuarios desde la app.

Filtros por estado (read/unread) y categoría.

---

## Registro de Auditoría

Todas las acciones del admin se registran en la tabla `admin_logs` mediante `logAdminAction()`:
- `approve_song` / `reject_song`
- `edit_song` / `delete_song`
- `verify_song` / `unverify_song`
- `resolve_report`

---

## Consideraciones Técnicas

### RLS (Row Level Security)
Las políticas RLS en `songs` deben permitir al admin SELECT, UPDATE y DELETE sobre cualquier canción. La migración `20260519000000_songs_admin_rls_policies.sql` agrega estas políticas. Si ves el error *"No se pudo aprobar. Posible falta de permisos RLS"*, ejecuta esa migración.

### Sincronización
Cuando el admin aprueba o modifica una canción, los cambios se propagan a todos los usuarios conectados mediante `useSongsRealtime` (suscripción a `postgres_changes` en la tabla `songs`).

### Estructura de Archivos
```
src/admin/
├── AdminShell.tsx              # Layout + routing interno
├── AdminGuard.tsx              # Protección por rol
├── AdminSidebar.tsx            # Navegación lateral
├── AdminErrorBoundary.tsx      # Manejo de errores
├── components/
│   ├── DataTable.tsx           # Tabla paginable reutilizable
│   └── StatCard.tsx            # Tarjeta de estadística
├── pages/
│   ├── DashboardPage.tsx
│   ├── PendingSongsPage.tsx
│   ├── GlobalLibraryPage.tsx
│   ├── UsersPage.tsx
│   ├── PlansPage.tsx           # Gestión manual de planes premium
│   ├── ReportsPage.tsx
│   ├── FeedbackPage.tsx
│   ├── BackgroundsPage.tsx     # Fondos globales: alta manual de videos por URL pública (Pexels o R2)
│   ├── SuggestionsPage.tsx     # Sugerencias de usuarios
│   └── ActivityLogsPage.tsx    # Historial de audit logs
└── services/
    ├── adminQueries.ts         # Queries a Supabase
    └── adminLogs.ts            # Registro de acciones
```
