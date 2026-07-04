-- RPCs security definer para acceso anónimo del colaborador (token = llave)

-- Helper interno: valida token y devuelve (collaborator_id, owner_id, collab_name)
create or replace function public._collab_auth(p_token text)
returns table (collab_id uuid, owner_id uuid, collab_name text)
language plpgsql security definer set search_path = public
as $$
begin
  return query
    select c.id, c.owner_id, c.name
    from collaborators c
    where c.token = p_token and c.revoked_at is null;
  if not found then
    raise exception 'invalid_token' using errcode = '28000';
  end if;
  update collaborators set last_seen_at = now() where token = p_token;
end $$;

revoke all on function public._collab_auth(text) from public, anon, authenticated;

-- ─── collab_info ─────────────────────────────────────────────────────────────
create or replace function public.collab_info(p_token text)
returns table (collaborator_name text, church_name text)
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_name text;
begin
  select a.owner_id, a.collab_name into v_owner, v_name from _collab_auth(p_token) a;
  return query
    select v_name, coalesce(p.settings->>'churchName', '')
    from profiles p where p.id = v_owner;
end $$;

-- ─── collab_search_songs ─────────────────────────────────────────────────────
-- Busca en songs: públicas verificadas + las del dueño. Paginado (30). Sin letras.
create or replace function public.collab_search_songs(
  p_token text, p_query text default '', p_offset int default 0
)
returns table (id bigint, title text, artist text, key text, language text)
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_q text;
begin
  select a.owner_id into v_owner from _collab_auth(p_token) a;
  v_q := '%' || trim(coalesce(p_query, '')) || '%';
  return query
    select s.id, s.title, s.artist, s.key, s.language
    from songs s
    where ((s.is_public = true and s.is_verified = true) or s.user_id = v_owner)
      and (trim(coalesce(p_query,'')) = '' or s.title ilike v_q or s.artist ilike v_q)
    order by s.usage_count desc nulls last, s.title asc
    limit 30 offset greatest(p_offset, 0);
end $$;

-- ─── collab_get_song ─────────────────────────────────────────────────────────
create or replace function public.collab_get_song(p_token text, p_song_id bigint)
returns table (id bigint, title text, artist text, key text, lyrics text)
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid;
begin
  select a.owner_id into v_owner from _collab_auth(p_token) a;
  return query
    select s.id, s.title, s.artist, s.key, s.lyrics
    from songs s
    where s.id = p_song_id
      and ((s.is_public = true and s.is_verified = true) or s.user_id = v_owner);
end $$;

-- ─── collab_list_setlists ────────────────────────────────────────────────────
create or replace function public.collab_list_setlists(p_token text)
returns table (
  id uuid, name text, date date, song_ids bigint[],
  notes text, updated_by text, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid;
begin
  select a.owner_id into v_owner from _collab_auth(p_token) a;
  return query
    select s.id, s.name, s.date, s.song_ids, s.notes, s.updated_by, s.created_at, s.updated_at
    from setlists s
    where s.user_id = v_owner
    order by s.date desc nulls last, s.created_at desc;
end $$;

-- ─── collab_upsert_setlist ───────────────────────────────────────────────────
create or replace function public.collab_upsert_setlist(
  p_token text,
  p_id uuid,               -- null = crear
  p_name text,
  p_date date,
  p_song_ids bigint[],
  p_notes text
)
returns table (
  id uuid, name text, date date, song_ids bigint[],
  notes text, updated_by text, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_name text; v_id uuid;
begin
  select a.owner_id, a.collab_name into v_owner, v_name from _collab_auth(p_token) a;
  if p_name is null or trim(p_name) = '' then
    raise exception 'name_required';
  end if;
  if p_id is null then
    insert into setlists (user_id, name, date, song_ids, notes, updated_by)
    values (v_owner, p_name, p_date, coalesce(p_song_ids, '{}'), p_notes, v_name)
    returning setlists.id into v_id;
  else
    update setlists
      set name = p_name, date = p_date, song_ids = coalesce(p_song_ids, '{}'),
          notes = p_notes, updated_by = v_name, updated_at = now()
      where setlists.id = p_id and setlists.user_id = v_owner
      returning setlists.id into v_id;
    if v_id is null then
      raise exception 'setlist_not_found';
    end if;
  end if;
  return query
    select s.id, s.name, s.date, s.song_ids, s.notes, s.updated_by, s.created_at, s.updated_at
    from setlists s where s.id = v_id;
end $$;

-- ─── collab_delete_setlist ───────────────────────────────────────────────────
create or replace function public.collab_delete_setlist(p_token text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid;
begin
  select a.owner_id into v_owner from _collab_auth(p_token) a;
  delete from setlists where id = p_id and user_id = v_owner;
  return found;
end $$;

-- Permisos: solo anon/authenticated pueden ejecutar las RPCs públicas
grant execute on function
  public.collab_info(text),
  public.collab_search_songs(text, text, int),
  public.collab_get_song(text, bigint),
  public.collab_list_setlists(text),
  public.collab_upsert_setlist(text, uuid, text, date, bigint[], text),
  public.collab_delete_setlist(text, uuid)
to anon, authenticated;
