-- Búsqueda de canciones del colaborador insensible a tildes.
-- 'espiritu' debe encontrar 'Espíritu' (el líder escribe sin tildes en el celular).
-- La extensión unaccent ya está instalada en el schema `extensions`.

create or replace function public.collab_search_songs(
  p_token text, p_query text default '', p_offset int default 0
)
returns table (id bigint, title text, artist text, key text, language text)
language plpgsql security definer set search_path = public, extensions
as $$
declare v_owner uuid; v_q text;
begin
  select a.owner_id into v_owner from _collab_auth(p_token) a;
  v_q := '%' || unaccent(trim(coalesce(p_query, ''))) || '%';
  return query
    select s.id, s.title, s.artist, s.key, s.language
    from songs s
    where ((s.is_public = true and s.is_verified = true) or s.user_id = v_owner)
      and (trim(coalesce(p_query,'')) = ''
           or unaccent(s.title) ilike v_q
           or unaccent(s.artist) ilike v_q)
    order by s.usage_count desc nulls last, s.title asc
    limit 30 offset greatest(p_offset, 0);
end $$;
