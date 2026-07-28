-- ============================================================================
-- FASE 6 — PERIODO DE GRACIA ANTES DEL PAYWALL (NO EJECUTAR EN ESTA SESIÓN)
-- ============================================================================
-- Cuándo correrlo: UNA sola vez, JUSTO ANTES de poner FOUNDING_PHASE = false
-- en src/hooks/usePlan.ts (es decir, al activar el modelo de pago).
--
-- Qué hace: le da 90 días de premium a toda cuenta existente, en vez de premium
-- permanente. Nadie pierde acceso de un día para otro, y durante esos 90 días
-- se les ofrece el precio fundador (PRICING.founderAnnualCOP, la mitad del
-- precio de lista, congelado de por vida).
--
-- Por qué NO 'founding': ese plan es premium gratis para siempre. Regalarlo a
-- todas las cuentas existentes elimina la posibilidad de que alguna pague, que
-- es justo lo que se quiere probar. El banner de lanzamiento siempre dijo
-- "oferta de lanzamiento por tiempo limitado", así que cobrar después es
-- coherente con lo prometido.
--
-- 'founding' queda reservado para las cuentas que decidas a mano que van gratis
-- de por vida (la tuya, tu iglesia, algún aliado). Ver el bloque del final.
--
-- Cómo correrlo: con service_role (SQL editor de Supabase o psql como owner).
-- Deshabilita el trigger porque protect_profile_fields revierte cambios de plan
-- cuando auth.uid() es nulo (contexto administrativo).
--
-- Idempotente: re-ejecutarlo sólo toca filas que sigan en 'free'. Las que ya
-- están en 'paid' con fecha no se pisan, así no se le reinicia la gracia a
-- nadie ni se le acorta a quien ya pagó.
-- ============================================================================

begin;

alter table public.profiles disable trigger enforce_profile_field_protection;

-- Opción A (recomendada): 90 días de gracia para TODA cuenta existente.
-- El corte es now(): todo el que ya tenía cuenta mientras FOUNDING_PHASE estuvo
-- en true entra. No hardcodear la fecha — una fecha vieja deja afuera a los que
-- se registraron entre esa fecha y el lanzamiento real.
update public.profiles
set plan = 'paid',
    premium_expires_at = now() + interval '90 days'
where plan = 'free'
  and created_at < now();

-- Opción B (más conservadora): sólo cuentas con actividad real.
-- Con los datos de julio 2026, ~14 de 23 cuentas no tienen ni una canción ni un
-- registro de asistencia. Si prefieres no regalar gracia a cuentas vacías,
-- comenta la Opción A y descomenta esto.
-- update public.profiles p
-- set plan = 'paid',
--     premium_expires_at = now() + interval '90 days'
-- where p.plan = 'free'
--   and (
--     exists (select 1 from public.songs s where s.user_id = p.id)
--     or exists (select 1 from public.attendance_records a where a.user_id = p.id)
--     or exists (select 1 from public.user_activity ua where ua.user_id = p.id)
--   );

-- Gratis de por vida, a dedo. Descomenta y pon los correos que correspondan.
-- update public.profiles
-- set plan = 'founding', premium_expires_at = null
-- where email in ('stivendor101@gmail.com');

alter table public.profiles enable trigger enforce_profile_field_protection;

-- Verificación antes de commit:
--   select plan, count(*), min(premium_expires_at)::date as vence_primero
--   from public.profiles group by plan;

commit;
