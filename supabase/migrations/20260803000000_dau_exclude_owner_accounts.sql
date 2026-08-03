-- Migration: excluir cuentas propias del dueño de la serie DAU
-- Date: 2026-08-03
-- Description: El dashboard admin ya excluye estas cuentas en el cliente, pero
-- admin_daily_active_users agrega en SQL, así que la exclusión va aquí.
-- Mantener sincronizado con EXCLUDED_EMAILS en src/admin/services/adminQueries.ts.

create or replace function public.admin_daily_active_users(days_back int default 30)
returns table (day date, count bigint)
language sql
security definer
set search_path = public
as $$
  select a.day, count(distinct a.user_id)
  from public.user_activity a
  where a.day >= current_date - days_back
    and not exists (
      select 1 from public.profiles owner
      where owner.id = a.user_id
        and owner.email in ('stivendor14yt@gmail.com', 'stivendor101@gmail.com')
    )
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
  group by a.day
  order by a.day;
$$;
