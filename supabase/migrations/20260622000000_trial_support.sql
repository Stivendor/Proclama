-- Trial self-service de 1 mes. El usuario sólo puede auto-cambiar su plan a
-- 'trial' (30 días, 1 vez) vía start_trial(); el resto sigue blindado.

-- 1. Columna: null = nunca usó la prueba.
alter table public.profiles
  add column if not exists trial_started_at timestamptz;

-- 2. Trigger de protección: añade bypass por GUC local y blinda trial_started_at.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.role() <> 'service_role'
     and current_setting('app.bypass_profile_guard', true) is distinct from 'on'
     and not exists (
       select 1 from public.profiles
       where id = auth.uid() and role = 'admin'
     )
  then
    new.role               := old.role;
    new.plan               := old.plan;
    new.premium_expires_at := old.premium_expires_at;
    new.trial_started_at   := old.trial_started_at;
  end if;
  return new;
end;
$function$;

-- 3. RPC: activa el trial una sola vez para el usuario autenticado.
create or replace function public.start_trial()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
  v_started timestamptz;
  v_expires timestamptz;
begin
  if uid is null then
    raise exception 'No autenticado.';
  end if;

  select trial_started_at into v_started
  from public.profiles where id = uid for update;

  if v_started is not null then
    raise exception 'Ya usaste tu prueba gratuita.';
  end if;

  if public.is_premium(uid) then
    raise exception 'Ya tienes acceso premium.';
  end if;

  v_expires := now() + make_interval(days => 30);

  perform set_config('app.bypass_profile_guard', 'on', true); -- local a la transacción
  update public.profiles
     set plan = 'trial',
         premium_expires_at = v_expires,
         trial_started_at = now()
   where id = uid;

  return v_expires;
end;
$function$;

grant execute on function public.start_trial() to authenticated;
