-- Buscador de letras online v2.
-- Ver docs/superpowers/specs/2026-08-10-buscador-letras-online-design.md

-- ── 1. La visibilidad pública exige verificación ────────────────────────────
-- is_verified ya existía en el tipo Song («Solo las canciones verificadas
-- aparecen públicamente») pero no se consultaba en ninguna lectura, así que la
-- cola de aprobación era cosmética: lo que esperaba revisión ya se estaba
-- viendo. Comprobado inmediatamente antes de aplicar esta migración: 3101
-- públicas, 0 sin verificar. La condición no esconde ninguna canción existente.
drop policy if exists "songs_select_public" on public.songs;
drop policy if exists "Public songs are readable by anyone" on public.songs;

create policy "songs_select_public" on public.songs
  for select
  using (is_public = true and is_verified = true);

-- ── 2. Política de lectura propia duplicada ─────────────────────────────────
-- Idéntica a songs_select_own, que se conserva: using (auth.uid() = user_id).
-- El autor sigue leyendo sus canciones sin importar is_verified: de eso depende
-- que pueda proyectar lo que acaba de importar, sin esperar aprobación.
drop policy if exists "Users can read own songs" on public.songs;

-- ── 3. Cerrar el agujero de search_songs_community ──────────────────────────
-- Era SECURITY DEFINER (se salta RLS) con public_only=false por defecto y
-- concedida a anon, así que cualquiera con la clave anónima podía pedir la
-- tabla entera, canciones privadas de otros usuarios incluidas. Sin
-- consumidores en el cliente ni en Edge Functions.
--
-- Si algún día hace falta búsqueda comunitaria en servidor, se reescribe con
-- SECURITY INVOKER y sin un parámetro capaz de desactivar el filtro.
drop function if exists public.search_songs_community(text, boolean);
drop function if exists public.search_songs_community(text, boolean, text);

-- ── 4. Artistas del catálogo, para ordenar los resultados de internet ───────
-- Sustituye a la lista hardcodeada CHRISTIAN_ARTISTS de la v1: se actualiza
-- sola cada vez que alguien aporta una canción al catálogo.
--
-- SECURITY INVOKER a propósito: el filtro es la propia RLS de arriba, así que
-- solo puede devolver artistas de canciones que el llamante ya podría leer.
create or replace function public.community_artists()
returns table (artist text)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select distinct lower(trim(s.artist))
  from public.songs s
  where s.is_public
    and s.is_verified
    and s.artist is not null
    and trim(s.artist) <> ''
$$;

grant execute on function public.community_artists() to anon, authenticated;
