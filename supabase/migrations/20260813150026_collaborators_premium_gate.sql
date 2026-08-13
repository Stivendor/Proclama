-- Colaboradores de setlist pasa a ser función Pro.
--
-- Hay dos puertas distintas y ambas hacen falta, porque las RPCs de colaborador
-- son security definer y se autentican por token: saltan RLS por completo. Cerrar
-- sólo la tabla dejaría vivos todos los enlaces ya creados.
--
--   1. RLS de public.collaborators  → quién puede CREAR enlaces.
--   2. public._collab_auth()        → si los enlaces existentes FUNCIONAN.
--
-- Lo que a propósito NO se cierra: ver y revocar los enlaces propios. Un dueño
-- que dejó de pagar tiene que poder seguir viendo quién tiene acceso a sus datos
-- y cortarlo. Bloquear eso sería un problema de privacidad, no un gate de venta.

-- ─── 1. Crear enlaces: sólo Pro ───────────────────────────────────────────────
-- La política "for all" anterior se reemplaza por una por comando, para poder
-- exigir premium sólo en insert/update.
drop policy if exists "Owner full access on collaborators" on public.collaborators;

create policy "Owner reads own collaborators"
  on public.collaborators for select
  using (auth.uid() = owner_id);

-- Revocar es un update (revoked_at), y tiene que seguir disponible siempre:
-- por eso el update no exige premium. Crear sí.
create policy "Owner updates own collaborators"
  on public.collaborators for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owner deletes own collaborators"
  on public.collaborators for delete
  using (auth.uid() = owner_id);

create policy "Premium owner creates collaborators"
  on public.collaborators for insert
  with check (auth.uid() = owner_id and public.is_premium(auth.uid()));

-- ─── 2. Usar un enlace: sólo si el dueño es Pro ───────────────────────────────
-- Mismo cuerpo que la versión original, más la comprobación del plan del dueño.
-- El error viaja con errcode propio para que el cliente lo distinga de un token
-- inválido y muestre "esta iglesia ya no tiene el plan activo" en vez de
-- "enlace inválido", que mandaría al colaborador a pedir un enlace nuevo.
create or replace function public._collab_auth(p_token text)
returns table (collab_id uuid, owner_id uuid, collab_name text)
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid;
begin
  return query
    select c.id, c.owner_id, c.name
    from collaborators c
    where c.token = p_token and c.revoked_at is null;
  if not found then
    raise exception 'invalid_token' using errcode = '28000';
  end if;

  -- Mismo filtro que la consulta de arriba: si no, un token con una fila
  -- revocada y otra activa podría resolver al dueño equivocado.
  select c.owner_id into v_owner
  from collaborators c
  where c.token = p_token and c.revoked_at is null;
  if not public.is_premium(v_owner) then
    raise exception 'owner_not_premium' using errcode = '28001';
  end if;

  update collaborators set last_seen_at = now() where token = p_token;
end $$;

revoke all on function public._collab_auth(text) from public, anon, authenticated;
