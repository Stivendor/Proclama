-- ============================================================================
-- FASE 6 — PERIODO DE GRACIA ANTES DEL PAYWALL
-- ============================================================================
-- Cuándo correrlo: UNA sola vez, JUSTO ANTES de poner FOUNDING_PHASE = false
-- en src/hooks/usePlan.ts. Previsto para 2026-07-28.
--
-- Qué hace: le da 90 días de Pro gratis a toda cuenta existente, salvo la lista
-- de excepciones vitalicias. Nadie pierde acceso el día del cambio; a los 90
-- días caen a Gratis solos, sin intervención. Durante esos 90 días se les
-- ofrece el precio fundador (la mitad del de lista, congelado de por vida).
--
-- Caer a Gratis NO los deja sin nada: proyectar canciones y Biblia sigue
-- disponible siempre. Pierden sync, fondos de video, reportes PDF y
-- colaboradores.
--
-- ─── POR QUÉ TOCA 'founding' Y NO SÓLO 'free' ────────────────────────────────
-- plan = 'founding' es premium GRATIS PARA SIEMPRE. Durante la fase fundadores
-- se repartió a mano desde el panel admin, sin intención de regalo vitalicio
-- (el banner siempre dijo "oferta de lanzamiento por tiempo limitado").
--
-- A 2026-07-27 había 15 cuentas en 'founding', incluidas LAS TRES IGLESIAS
-- EXTERNAS REALES — las únicas que podrían pagar. Una versión de este script
-- que sólo tocara 'free' dejaría el paywall sin alcanzar a nadie que importe.
--
-- ─── CÓMO CORRERLO ───────────────────────────────────────────────────────────
-- Con service_role (SQL editor de Supabase o psql como owner). Deshabilita el
-- trigger porque protect_profile_fields revierte cambios de plan cuando
-- auth.uid() es nulo (contexto administrativo).
--
-- Idempotente: sólo toca filas que sigan en 'free' o 'founding'. A quien ya
-- quedó en 'paid' con fecha no se le reinicia ni se le acorta la gracia.
-- ============================================================================

begin;

alter table public.profiles disable trigger enforce_profile_field_protection;

-- ─── 1. Excepciones vitalicias ───────────────────────────────────────────────
-- Cuentas del dueño del producto y su propia iglesia: no son clientes.
-- REVISAR ESTA LISTA ANTES DE CORRER. Lo que esté aquí nunca paga.
create temporary table _lifetime(email text) on commit drop;
insert into _lifetime(email) values
  ('stivendor101@gmail.com'),   -- admin / dueño
  ('stivendor14yt@gmail.com'),  -- segunda cuenta del dueño
  ('decomgranizal@gmail.com');  -- DECOM Granizal, la iglesia del dueño

update public.profiles
set plan = 'founding', premium_expires_at = null
where email in (select email from _lifetime);

-- ─── 2. Gracia de 90 días para todos los demás ───────────────────────────────
-- Incluye 'founding' a propósito (ver cabecera). El corte es now(): entra todo
-- el que ya tenía cuenta mientras FOUNDING_PHASE estuvo en true. No hardcodear
-- la fecha — una fecha vieja deja afuera a los registrados entre esa fecha y el
-- lanzamiento real.
-- La caducidad se ancla a MEDIANOCHE DE COLOMBIA, no a la hora de correr el
-- script: con `now() + interval '90 days'`, correrlo un domingo a las 3 de la
-- tarde apaga el Pro de todo el mundo un domingo a las 3 de la tarde, en pleno
-- servicio. Y hace falsa la frase "hasta el {fecha}" del aviso in-app.
-- El +91 es a propósito: medianoche del día 91 = final completo del día 90.
update public.profiles
set plan = 'paid',
    premium_expires_at = ((now() at time zone 'America/Bogota')::date + 91)
                         ::timestamp at time zone 'America/Bogota'
where plan in ('free', 'founding')
  and created_at < now()
  and email not in (select email from _lifetime);

-- Nota: las cuentas en 'trial' se dejan como están. Su prueba ya corrió con su
-- propia fecha y no corresponde regalarles 90 días encima.
--
-- OJO con las que ya están en 'paid' con premium_expires_at = null: eso es
-- premium vitalicio y este script NO las toca. A 2026-07-27 la única así es
-- proclamapro@gmail.com, que quedó vitalicia por un cambio de plan de prueba
-- del 2026-06-23. Si no debe ser vitalicia, corregirla a mano:
--   update public.profiles set premium_expires_at = now() + interval '90 days'
--   where email = 'proclamapro@gmail.com';
-- Para listar cualquier otra antes de correr:
--   select email from public.profiles
--   where plan = 'paid' and premium_expires_at is null;

alter table public.profiles enable trigger enforce_profile_field_protection;

-- ─── Verificación ANTES de hacer commit ──────────────────────────────────────
-- Esperado: 3 en 'founding' (las excepciones), el resto en 'paid' venciendo
-- dentro de 90 días, y las de 'trial' intactas.
--
--   select plan, count(*), min(premium_expires_at)::date as vence_primero
--   from public.profiles group by plan order by count(*) desc;
--
-- Y confirmar que las 3 iglesias externas quedaron con gracia, no vitalicias:
--
--   select email, plan, premium_expires_at::date
--   from public.profiles
--   where email in ('ipucsantana@gmail.com', 'erit111k@gmail.com',
--                   'mangaarriba2girardota@gmail.com');

commit;
