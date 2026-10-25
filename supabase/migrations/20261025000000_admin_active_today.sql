-- Migration: admin_active_today — usuarios con heartbeat de hoy
-- Date: 2026-10-25
-- Description: El dashboard muestra "Activos Hoy": quién usó la app hoy según
-- user_activity (day = current_date). Orden alfabético, sin ranking.
-- Excluye las cuentas propias del dueño en SQL (mismo criterio que
-- admin_daily_active_users). Mantener sincronizado con EXCLUDED_EMAILS en
-- src/admin/services/adminQueries.ts.

create or replace function public.admin_active_today()
returns table (
  user_id uuid,
  email text,
  full_name text
)
language sql
security definer
set search_path = public
as $$
  select p.id,
         p.email,
         p.full_name
  from public.profiles p
  inner join public.user_activity a
    on a.user_id = p.id and a.day = current_date
  where not exists (
      select 1 from public.profiles owner
      where owner.id = p.id
        and owner.email in ('stivendor14yt@gmail.com', 'stivendor101@gmail.com')
    )
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
  order by p.full_name nulls last, p.email;
$$;
