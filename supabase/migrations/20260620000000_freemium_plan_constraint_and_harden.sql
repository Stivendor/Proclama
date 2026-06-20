-- Freemium: normaliza el enum de plan, lo restringe, y endurece el blindaje de campos sensibles.

-- Los triggers protect_profile_fields revierten cambios de plan cuando auth.uid()
-- es nulo (contexto de migración). Los deshabilitamos para normalizar el dato.
alter table public.profiles disable trigger before_profile_update;
alter table public.profiles disable trigger enforce_profile_field_protection;

-- Normaliza 'premium' -> 'founding' (premium permanente; conserva acceso actual).
update public.profiles set plan = 'founding' where plan = 'premium';

-- Restringe plan a los 4 tiers del modelo freemium.
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check
  check (plan = any (array['free','trial','paid','founding']));

-- Blindaje: SOLO service_role (webhook de pagos) o un admin pueden modificar
-- role/plan/premium_expires_at. Cualquier otro intento se revierte en silencio.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.role() <> 'service_role'
     and not exists (
       select 1 from public.profiles
       where id = auth.uid() and role = 'admin'
     )
  then
    new.role               := old.role;
    new.plan               := old.plan;
    new.premium_expires_at := old.premium_expires_at;
  end if;

  return new;
end;
$function$;

-- Había dos triggers redundantes sobre la misma función; dejamos uno.
drop trigger if exists before_profile_update on public.profiles;
alter table public.profiles enable trigger enforce_profile_field_protection;
