-- Cierra el lado de escritura de la cola de aprobación.
--
-- La migración 20260810154735 hizo que la visibilidad pública exija
-- `is_verified`, pero nadie impedía escribir esa columna. Las políticas
-- songs_insert_premium y songs_update_premium solo comprueban la propiedad y el
-- plan, no restringen columnas, y `mapSongToPayload` en el cliente envía
-- is_verified. Cualquier usuario premium podía hacer un POST a /rest/v1/songs
-- con {is_public: true, is_verified: true} y publicar en el catálogo que ven
-- las congregaciones, sin pasar por revisión.
--
-- Antes se saltaba la cola leyendo; después de aquella migración, escribiendo.
-- Esto lo cierra donde debe cerrarse, en la base y no en el cliente.
--
-- Alcance deliberadamente mínimo: congela `is_verified` para quien no sea
-- administrador. NO se implementa «editar una canción aprobada la devuelve a la
-- cola», que es una decisión de producto y no un agujero de seguridad.

create or replace function public.enforce_song_verification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Los administradores sí verifican: es exactamente lo que hace approve() en
  -- PendingSongsPage. El backend con service_role también, para migraciones y
  -- tareas de mantenimiento.
  if auth.role() = 'service_role' or is_admin() or is_superadmin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_verified := false;
    return new;
  end if;

  -- En UPDATE, is_verified es inmutable para el autor: conserva el valor que ya
  -- tenía, venga lo que venga del cliente.
  new.is_verified := old.is_verified;
  return new;
end;
$$;

drop trigger if exists songs_enforce_verification on public.songs;

create trigger songs_enforce_verification
  before insert or update on public.songs
  for each row execute function public.enforce_song_verification();

-- Defensa en profundidad: anon no tiene hoy ninguna política de escritura sobre
-- songs, así que estos permisos de tabla no le sirven de nada. Pero si alguien
-- añade en el futuro una política sin cláusula `to authenticated`, se le
-- abrirían a la clave anónima, que es pública por diseño.
revoke insert, update, delete on public.songs from anon;
