-- ============================================================================
-- FASE 6 — GRANDFATHERING FINAL (NO EJECUTAR EN ESTA SESIÓN)
-- ============================================================================
-- Cuándo correrlo: UNA sola vez, JUSTO ANTES de poner FOUNDING_PHASE = false
-- en src/hooks/usePlan.ts (es decir, al activar el modelo de pago).
--
-- Qué hace: marca como plan = 'founding' (premium permanente) a TODOS los
-- usuarios que se registraron durante la etapa de fundadores, para no quitarles
-- el acceso que tuvieron mientras FOUNDING_PHASE estuvo en true (regla #2).
--
-- Cómo correrlo: con service_role (SQL editor de Supabase o psql como owner).
-- Deshabilita el trigger porque protect_profile_fields revierte cambios de plan
-- cuando auth.uid() es nulo (contexto administrativo).
--
-- Idempotente: re-ejecutarlo no causa daño (solo toca filas que sigan en 'free').
-- ============================================================================

begin;

alter table public.profiles disable trigger enforce_profile_field_protection;

-- Opción A (recomendada): grandfather a TODO usuario existente a esta fecha.
-- Define el corte con la fecha real del lanzamiento del paywall antes de correr.
update public.profiles
set plan = 'founding'
where plan = 'free'
  and created_at < '2026-06-20T00:00:00Z';  -- <-- AJUSTAR a la fecha de corte real

-- Opción B (más conservadora): solo usuarios con actividad real.
-- Comenta la Opción A y descomenta esto si prefieres no grandfatherear cuentas vacías.
-- update public.profiles p
-- set plan = 'founding'
-- where p.plan = 'free'
--   and (
--     exists (select 1 from public.songs s where s.user_id = p.id)
--     or exists (select 1 from public.attendance_records a where a.user_id = p.id)
--     or exists (select 1 from public.user_devices d where d.user_id = p.id)
--   );

alter table public.profiles enable trigger enforce_profile_field_protection;

-- Verificación antes de commit:
--   select plan, count(*) from public.profiles group by plan;

commit;
