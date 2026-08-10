-- Endurece el guard de verificación de la migración 20260810155417.
-- Dos defectos encontrados en revisión, ambos del propio guard.

-- ── 1. El rol `postgres` no pasaba el guard, y fallaba en silencio ──────────
-- En una conexión directa (SQL editor de Studio, `supabase db push`, psql,
-- pg_restore) `auth.role()` devuelve NULL, y en plpgsql `NULL or false or
-- false` evalúa a NULL, que no entra al `if`. Resultado: la escritura pasaba
-- pero con is_verified forzado a false, sin error.
--
-- El caso grave es una restauración de backup: pg_restore y COPY disparan los
-- triggers BEFORE INSERT ... FOR EACH ROW, así que un restore sin
-- --disable-triggers dejaría is_verified=false en las 3101 canciones del
-- catálogo y las haría desaparecer de golpe, en silencio.
--
-- Comprobar `current_user` cubre además a service_role sin depender de que
-- auth.role() esté disponible.

-- ── 2. La función no necesitaba SECURITY DEFINER ────────────────────────────
-- Siendo DEFINER y viviendo en `public`, PostgREST la expone en
-- /rest/v1/rpc/enforce_song_verification y aparece en dos lints nuevos de
-- get_advisors. No es explotable — Postgres rechaza invocar una función de
-- trigger fuera de un trigger — pero es ruido evitable: is_admin() e
-- is_superadmin() ya son DEFINER y resuelven ellas solas el acceso a profiles.

create or replace function public.enforce_song_verification()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role'
     or is_admin()
     or is_superadmin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_verified := false;
    return new;
  end if;

  new.is_verified := old.is_verified;
  return new;
end;
$$;

-- Cerrar el endpoint RPC que PostgREST publicaría.
revoke execute on function public.enforce_song_verification() from public, anon, authenticated;

-- ── 3. Al revoke anterior le faltaba TRUNCATE ───────────────────────────────
-- Es el privilegio más destructivo de la tabla y RLS no lo filtra. Hoy no es
-- alcanzable desde PostgREST, pero si el objetivo era defensa en profundidad,
-- la lista se había quedado corta.
revoke truncate on public.songs from anon;
