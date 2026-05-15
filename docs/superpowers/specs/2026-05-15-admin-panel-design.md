# Proclama Admin Panel — Design Spec

**Date:** 2026-05-15  
**Status:** Approved  
**Author:** Brainstorming session con Stiven

---

## Goal

Rediseñar y expandir el panel de administración de Proclama, separándolo completamente del shell de la app de proyección para eliminar lentitud e ineficiencia. El resultado es un panel admin moderno, escalable, accesible para múltiples administradores, con 8 módulos funcionales.

---

## Problema actual

Las vistas admin (`ReportsView`, `AdminUsersView`) se renderizan dentro de `MainApp`, que carga:
- `ControlPanel` (panel derecho de proyección)
- `ProjectionPreview`
- `SongEditorModal`
- `useKeyboardShortcuts`
- Dexie / IndexedDB reactivo

Todo ese overhead es completamente innecesario en el contexto admin y es la causa directa de la lentitud.

---

## Arquitectura: Opción A — Mismo repo, shell separado

### Cómo funciona

En `src/App.tsx`, se añade un chequeo de pathname (igual al patrón `IS_PROJECTION` existente):

```ts
const IS_ADMIN = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
```

Cuando `IS_ADMIN === true`, se renderiza `<AdminShell />` en lugar de `<MainApp />`. Cero componentes de proyección se montan. Cero Dexie. Cero shortcuts.

### Navegación entre shells

- **App → Admin:** Botón en Sidebar (visible solo a `role === 'admin'`): `window.location.href = '/admin'`
- **Admin → App:** Botón "Volver a Proclama" en AdminShell: `window.location.href = '/'`

### Navegación interna del admin

Sigue el mismo patrón que la app principal: un estado `adminView` en Zustand (o estado local en AdminShell) con el nombre de la vista activa. Sin react-router-dom adicional.

### Vite config

El servidor de Vite ya sirve `index.html` para cualquier ruta no encontrada (`historyApiFallback`). No se necesita configuración adicional.

---

## Estructura de archivos

```
src/
  admin/
    AdminShell.tsx          ← Shell del admin (sidebar + contenido)
    AdminSidebar.tsx        ← Navegación lateral del admin
    AdminGuard.tsx          ← Chequeo de autenticación y rol admin
    pages/
      DashboardPage.tsx
      UsersPage.tsx
      PlansPage.tsx
      PendingSongsPage.tsx
      ReportsPage.tsx
      SuggestionsPage.tsx
      GlobalLibraryPage.tsx
      ActivityLogsPage.tsx
    components/
      StatCard.tsx           ← KPI card reutilizable
      DataTable.tsx          ← Tabla con paginación server-side reutilizable
      UserDetailPanel.tsx    ← Panel lateral deslizable con detalle de usuario
      SongPreviewPanel.tsx   ← Preview de letra expandible inline
      BadgeCount.tsx         ← Badge de conteo para sidebar items
    hooks/
      useAdminView.ts        ← Estado de navegación del admin
      usePaginatedQuery.ts   ← Hook genérico para queries paginadas a Supabase
    services/
      adminQueries.ts        ← Todas las queries Supabase del admin
      adminLogs.ts           ← Funciones para escribir en admin_logs
  App.tsx                   ← Añadir IS_ADMIN check aquí
  components/
    Sidebar.tsx             ← Añadir botón "Panel Admin" para admins
```

**Archivos compartidos (sin modificar):**
- `src/services/supabase.ts` — cliente Supabase compartido
- `src/types/` — tipos compartidos
- `src/stores/index.ts` — store de auth compartido (para leer `userRole`)

---

## Módulos del Admin Panel

### 1. Dashboard

**Ruta interna:** `adminView = 'dashboard'` (vista por defecto al entrar a `/admin`)

**KPI Cards (6):**
- Total usuarios registrados
- Usuarios premium activos
- Canciones verificadas en la biblioteca
- Reportes abiertos (badge rojo si > 0)
- Canciones pendientes de aprobación (badge amarillo si > 0)
- Sugerencias sin leer (badge azul si > 0)

**Gráficas:**
- Registros de usuarios por día (últimos 30 días) — line chart con `recharts`
- Distribución free vs premium — donut chart

**Feed de actividad reciente:**
- Últimas 10 acciones del log (aprobaciones, rechazos, upgrades, reportes resueltos)

**Performance:** Queries paralelas con `Promise.all`. Datos frescos de Supabase, sin Dexie.

---

### 2. Usuarios

**Ruta interna:** `adminView = 'users'`

**Tabla con columnas:** Email, Fecha registro, Plan, Rol, Dispositivos, Acciones

**Funcionalidades:**
- Búsqueda por email (debounced, 300ms)
- Filtros: plan (free/premium/todos), rol (admin/user/todos), rango de fechas
- Ordenamiento por fecha de registro
- **Paginación server-side** — 50 usuarios por página (actualmente carga TODOS)
- Click en fila → `UserDetailPanel` deslizable desde la derecha

**UserDetailPanel contiene:**
- Email, fecha de registro, plan actual
- Historial de cambios de plan (de `admin_logs`)
- Cantidad de canciones subidas
- Dispositivos registrados (de tabla `devices`)
- Acciones: cambiar plan, cambiar rol, revocar sesión

**Exportar CSV:** Solo el conjunto filtrado actual, no todos los usuarios.

---

### 3. Planes & Pagos

**Ruta interna:** `adminView = 'plans'`

**Secciones:**
- **Timeline de upgrades:** Lista cronológica de quién se volvió premium y cuándo, filtrable por mes
- **Resumen mensual:** Tabla con columnas: Mes, Nuevos premium, Total premium activo, Conversión %
- **Donut chart:** Free vs Premium en tiempo real
- **Override manual:** Formulario para cambiar plan de un usuario por email, con campo obligatorio "Razón / nota" (se guarda en `admin_logs`)

---

### 4. Canciones Pendientes

**Ruta interna:** `adminView = 'pending-songs'`

**Descripción:** Canciones con `isPublic = true` y `isVerified = false`.

**Funcionalidades:**
- Lista con: Título, Artista, Idioma, Fecha de envío, Usuario que subió
- Filtros: idioma, fecha
- **Preview inline expandible:** Click → expande la letra debajo del card (sin modal separado)
- **Acciones por canción:** Aprobar ✓, Rechazar ✗, Editar
- **Selección múltiple + acción bulk:** Aprobar todas las seleccionadas de una vez
- Badge en sidebar con conteo actualizado en tiempo real (Supabase Realtime)

---

### 5. Reportes de Canciones

**Ruta interna:** `adminView = 'reports'`

**Tabla con columnas:** Canción, Artista, Razón del reporte, Detalles, Fecha, Acciones

**Funcionalidades:**
- Filtro por razón de reporte
- Click en canción → `SongPreviewPanel` con letra completa
- Ver historial: cuántos reportes tiene esa canción en total
- **Acciones:** Resolver (sin borrar), Editar canción, Eliminar canción, Ignorar
- Todas las acciones quedan registradas en `admin_logs`

---

### 6. Sugerencias

**Ruta interna:** `adminView = 'suggestions'`

**Tabla existente: `feedback` (se extiende con columnas nuevas)**

La tabla `feedback` ya existe con: `id`, `user_id`, `message`, `created_at`. Se añaden columnas:

```sql
-- Extender tabla feedback existente
alter table public.feedback add column if not exists user_email text;
alter table public.feedback add column if not exists category text default 'general'; -- 'bug', 'feature', 'content', 'general'
alter table public.feedback add column if not exists status text default 'unread';     -- 'unread', 'in_review', 'implemented', 'dismissed'
alter table public.feedback add column if not exists admin_note text;                  -- nota interna, solo visible para admins
alter table public.feedback add column if not exists updated_at timestamptz default now();
```

**UI tipo inbox:**
- Lista con: Email, Categoría, Extracto, Fecha, Estado (badge de color)
- Click → panel de detalle con contenido completo
- Campo de nota interna del admin (solo admins la ven)
- Cambiar estado: "Sin leer" → "En revisión" → "Implementado" / "Descartado"
- Filtros por categoría y estado
- Badge en sidebar con conteo de no leídas

**Cómo llegan las sugerencias:**
- Botón flotante en la app principal (esquina inferior izquierda, sobre el sidebar, pequeño con ícono `MessageSquarePlus`) — visible para usuarios autenticados
- Aparece como un tooltip/FAB discreto que no interfiere con el flujo de proyección
- Al hacer click abre un mini-modal (no pantalla completa): campo de texto + dropdown de categoría (Bug, Sugerencia, Contenido, General)
- El botón NO aparece en la vista de proyección (`IS_PROJECTION = true`)

---

### 7. Biblioteca Global

**Ruta interna:** `adminView = 'global-library'`

**Descripción:** Vista de todas las canciones públicas de la plataforma.

**Funcionalidades:**
- Búsqueda full-text: título, artista
- Filtros: idioma, verificada/no verificada, fecha de creación
- Tabla con: Título, Artista, Idioma, Verificada, Subida por (email), Fecha
- **Edición rápida de metadatos** inline: título, artista, idioma
- **Edición completa:** Botón abre panel con letra editable
- **Eliminar:** Con confirmación, registra en `admin_logs`
- Paginación server-side, 50 canciones por página

---

### 8. Logs de Actividad

**Ruta interna:** `adminView = 'activity-logs'`

**Nueva tabla Supabase: `admin_logs`**

```sql
create table admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text,
  action text not null,  -- 'approve_song', 'reject_song', 'delete_song', 'change_plan', 'resolve_report', etc.
  target_type text,      -- 'song', 'user', 'report', 'suggestion'
  target_id text,        -- id del objeto afectado
  target_label text,     -- descripción legible (ej: nombre de la canción, email del usuario)
  note text,             -- razón opcional / nota del admin
  created_at timestamptz default now()
);
```

**UI:**
- Tabla con: Admin, Acción, Objetivo, Nota, Fecha
- Filtros: admin, tipo de acción, rango de fechas
- Solo lectura — no se puede editar ni eliminar
- Exportar CSV del rango filtrado

---

## AdminShell — Layout

```
┌─────────────────────────────────────────────────────────┐
│  🔰 Proclama Admin       [admin@email.com]  [← App]    │  ← Header
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  Dashboard   │                                          │
│  Usuarios    │         Contenido de la vista            │
│  Planes  •3  │         activa                           │
│  Pendientes 7│                                          │
│  Reportes  2 │                                          │
│  Sugerencias │                                          │
│  Biblioteca  │                                          │
│  Logs        │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

- Sidebar fijo a la izquierda, colapsable en mobile
- Header con email del admin logueado y botón "← Volver a Proclama"
- Badges de conteo en tiempo real para: Pendientes, Reportes, Sugerencias no leídas
- Design system: reutiliza las CSS variables del proyecto (`--bg-base`, `--gold`, `--border`, etc.)

---

## AdminGuard

Componente que envuelve `AdminShell`:

1. Lee sesión de Supabase (`supabase.auth.getSession()`)
2. Consulta `profiles` para verificar `role === 'admin'`
3. Si no autenticado → redirige a `/` (app principal con login)
4. Si autenticado pero no admin → muestra pantalla "Acceso denegado" con botón volver
5. Si admin → renderiza children

---

## Cambios en base de datos

### Tablas nuevas

```sql
-- Logs de auditoría admin
create table admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text,
  action text not null,
  target_type text,
  target_id text,
  target_label text,
  note text,
  created_at timestamptz default now()
);

alter table admin_logs enable row level security;
create policy "admin_only_logs" on admin_logs
  using (auth.uid() in (select id from profiles where role = 'admin'));
```

### Tablas extendidas

```sql
-- Extender feedback existente para soporte de admin
alter table public.feedback add column if not exists user_email text;
alter table public.feedback add column if not exists category text default 'general';
alter table public.feedback add column if not exists status text default 'unread';
alter table public.feedback add column if not exists admin_note text;
alter table public.feedback add column if not exists updated_at timestamptz default now();

-- RLS para feedback (admin lectura/update, usuarios insert)
alter table public.feedback enable row level security;
create policy "admin_read_feedback" on public.feedback for select
  using (auth.uid() in (select id from profiles where role = 'admin'));
create policy "admin_update_feedback" on public.feedback for update
  using (auth.uid() in (select id from profiles where role = 'admin'));
create policy "user_insert_feedback" on public.feedback for insert
  with check (auth.uid() = user_id);
```

### Tablas sin modificar

El resto del schema existente no se toca.

---

## Performance

| Problema actual | Solución |
|----------------|----------|
| Carga toda la app de proyección al entrar al admin | Shell separado — cero imports de ControlPanel/ProjectionPreview/Dexie |
| `AdminUsersView` carga TODOS los usuarios en memoria | Paginación server-side con `.range(from, to)` en Supabase |
| `ReportsView` usa timeout manual de 10s | Query directa sin timeout artificial; Supabase Realtime para badges |
| Sin lazy loading de módulos | Cada página del admin: `React.lazy()` + `Suspense` |
| Inline styles mezclados con CSS classes | CSS en `index.css` bajo namespace `.admin-*` |

---

## Diseño visual

- Reutiliza el design system existente (variables CSS del proyecto)
- Admin sidebar: dark, acento dorado (`--gold`) igual que la app principal
- Tablas: estilo consistente con `AdminUsersView` actual, pero componentizado en `DataTable`
- KPI cards: estilo consistente con `stat-card` actual
- Tipografía: misma fuente del proyecto

---

## Lo que NO entra en este spec (fuera de scope)

- Sistema de notificaciones push a usuarios
- Panel de configuración global de la app (feature flags, etc.)
- Gestión de pagos con Stripe (solo tracking manual de planes por ahora)
- i18n del panel admin

---

## Orden de implementación sugerido

1. `AdminGuard` + `AdminShell` + `AdminSidebar` (scaffolding base)
2. Migración de `ReportsView` → `ReportsPage` en el nuevo shell
3. Migración de `AdminUsersView` → `UsersPage` con paginación server-side
4. `DashboardPage` con KPIs y gráficas
5. `PendingSongsPage` con acciones bulk
6. Migraciones Supabase: crear `suggestions` y `admin_logs`
7. `SuggestionsPage` + formulario en SettingsView
8. `PlansPage`
9. `GlobalLibraryPage`
10. `ActivityLogsPage`
11. Botón "Panel Admin" en Sidebar de la app principal
12. Formulario de sugerencias en SettingsView
