# Actividad de usuarios en el panel admin

**Fecha:** 2026-07-08
**Objetivo:** Saber qué usuarios (logueados) usan más Proclama: días activos, última actividad y DAU, visible en el panel admin.

## Métrica

"Usar más" = frecuencia de uso: cuántos días distintos abre la app cada usuario. No se registran acciones por tipo (descartado por overkill) ni se depende solo de datos existentes (no distinguen uso diario).

## Tracking: heartbeat diario

Tabla nueva en Supabase:

```sql
create table public.user_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  primary key (user_id, day)
);
```

- El cliente, cuando hay sesión iniciada, hace un upsert de `(user_id, hoy)` una vez al día al abrir la app. Guard con localStorage (clave con la fecha) para no escribir en cada carga. `onConflict` ignora duplicados: máximo una escritura diaria por usuario.
- RLS: cada usuario solo puede insertar su propia fila (`auth.uid() = user_id`). No hay policy de select para usuarios normales.
- Lectura admin vía RPC `security definer` con check de rol admin, mismo patrón que el resto del panel.
- Limitación asumida: usuarios invitados (sin login) no se registran; ese tráfico ya lo cubre Vercel.
- Los datos se acumulan desde el deploy. Mientras tanto, `user_devices.last_seen` rellena "Última actividad" como fallback.
- Retención: sin límite por ahora (una fila por usuario/día es despreciable en tamaño).

## Datos expuestos

1. RPC `admin_user_activity(days int)` → por usuario: `user_id`, `email`, `full_name`, `active_days`, `last_active`. Solo ejecutable por admins. Sirve para el ranking del dashboard y las columnas de UsersPage.
2. Serie DAU: usuarios distintos por día en los últimos 30 días (misma RPC u otra mínima, siguiendo el patrón de `fetchRegistrationChart` en `src/admin/services/adminQueries.ts`).

## UI (integrado en páginas actuales)

- **DashboardPage**: StatCard "Activos hoy", gráfico DAU 30 días (patrón del chart de registros existente) y lista "Top 10 usuarios más activos (30d)".
- **UsersPage**: columnas "Días activos (30d)" y "Última actividad" en la tabla (informativas, sin sort server-side por actividad — el ranking lo da el Top 10 del Dashboard). Los datos de actividad se mergean con los perfiles paginados.

## Componentes nuevos/tocados

- Migración SQL: tabla + RLS + RPC(s).
- Hook o efecto de heartbeat en el arranque de la app (junto a la lógica de sesión en `App.tsx`).
- `src/admin/services/adminQueries.ts`: `fetchUserActivity`, `fetchDauChart`.
- `DashboardPage.tsx` y `UsersPage.tsx`: widgets y columnas.

## Testing

- Unit: el guard del heartbeat no repite escritura el mismo día y sí escribe en un día nuevo.
- Unit: agregación/mergeo de actividad con la lista de usuarios.
- Manual: verificar dashboard y tabla con datos reales tras el deploy.
