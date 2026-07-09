-- Migration: user_activity heartbeat table + admin RPCs
-- Date: 2026-07-08
-- Description: Registra un heartbeat diario por usuario para saber quién usa
-- más la app. Los usuarios solo insertan su propia fila; la lectura es solo
-- para admins vía RPCs security definer.

create table if not exists public.user_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  primary key (user_id, day)
);

create index if not exists user_activity_day_idx on public.user_activity (day);

alter table public.user_activity enable row level security;

drop policy if exists "Users can insert own activity" on public.user_activity;
create policy "Users can insert own activity"
  on public.user_activity for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Sin policy de SELECT: los usuarios no leen esta tabla; los admins leen vía RPC.

-- Por usuario: días activos en la ventana y última actividad.
-- Fallback: mientras user_activity acumula datos, last_active usa también
-- user_devices.last_seen (GREATEST ignora NULLs).
create or replace function public.admin_user_activity(days_back int default 30)
returns table (
  user_id uuid,
  email text,
  full_name text,
  active_days bigint,
  last_active timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id,
         p.email,
         p.full_name,
         count(distinct a.day) as active_days,
         greatest(max(a.day)::timestamptz, max(d.last_seen)) as last_active
  from public.profiles p
  left join public.user_activity a
    on a.user_id = p.id and a.day >= current_date - days_back
  left join public.user_devices d
    on d.user_id = p.id
  where exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  )
  group by p.id, p.email, p.full_name
  order by active_days desc, last_active desc nulls last;
$$;

-- Serie DAU: usuarios distintos por día en la ventana.
create or replace function public.admin_daily_active_users(days_back int default 30)
returns table (day date, count bigint)
language sql
security definer
set search_path = public
as $$
  select a.day, count(distinct a.user_id)
  from public.user_activity a
  where a.day >= current_date - days_back
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
  group by a.day
  order by a.day;
$$;
