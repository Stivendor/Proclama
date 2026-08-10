-- Editar una canción ya aprobada la devuelve a la cola de revisión.
--
-- Hasta ahora `is_verified` era pegajoso: una vez aprobada, el autor podía
-- sustituir la letra por texto arbitrario y la canción seguía pública y
-- verificada en el catálogo que ven las congregaciones. El guard anterior
-- cerró la auto-aprobación de entrada, pero no esta puerta de atrás.
--
-- Decisión de producto del dueño, no un agujero heredado: se pidió
-- explícitamente que un cambio de contenido vuelva a pasar por revisión.
--
-- Solo dispara con lo que se proyecta o identifica la canción: letra, título y
-- artista. Cambiar tonalidad, etiquetas o idioma es organización interna del
-- autor y no justifica revisarla otra vez.
--
-- Los administradores quedan fuera, como en el resto del guard: editar durante
-- la aprobación es justo lo que hace `saveChanges` en PendingSongsPage.

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

  -- is_verified es inmutable para el autor: conserva lo que ya había, venga lo
  -- que venga del cliente.
  new.is_verified := old.is_verified;

  -- Y si toca el contenido de una canción ya aprobada, vuelve a la cola.
  if old.is_verified
     and (new.lyrics is distinct from old.lyrics
          or new.title  is distinct from old.title
          or new.artist is distinct from old.artist) then
    new.is_verified := false;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_song_verification() from public, anon, authenticated;
