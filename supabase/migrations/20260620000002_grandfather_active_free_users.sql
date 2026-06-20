-- Regla #2: no romper usuarios existentes. Durante FOUNDING_PHASE el cliente trata
-- a todos como premium; antes de activar el enforcement server-side promovemos a
-- 'founding' (premium permanente) a los usuarios free EXISTENTES con actividad/datos.
-- (El sweep final de grandfathering vive en supabase/manual/, ver Fase 6.)
alter table public.profiles disable trigger enforce_profile_field_protection;

update public.profiles p
set plan = 'founding'
where p.plan = 'free'
  and (
    exists (select 1 from public.songs s where s.user_id = p.id)
    or exists (select 1 from public.attendance_records a where a.user_id = p.id)
    or exists (select 1 from public.user_devices d where d.user_id = p.id)
  );

alter table public.profiles enable trigger enforce_profile_field_protection;
