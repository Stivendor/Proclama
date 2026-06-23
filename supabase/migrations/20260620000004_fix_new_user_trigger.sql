-- Arregla handle_new_user: el trigger insertaba role='projectionist' (viola el
-- CHECK role IN ('admin','user')) y la columna is_authorized (ya eliminada).
-- Ambos fallos hacían que el INSERT lanzara, fuera tragado por EXCEPTION WHEN
-- OTHERS, y el usuario nuevo quedara SIN perfil. Ahora role='user' y sin is_authorized.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_settings jsonb;
begin
  user_settings := jsonb_build_object('onboardingComplete', true);

  if new.raw_user_meta_data->>'church_name' is not null then
    user_settings := user_settings || jsonb_build_object('churchName', new.raw_user_meta_data->>'church_name');
  end if;

  if new.raw_user_meta_data->>'country' is not null then
    user_settings := user_settings || jsonb_build_object('country', new.raw_user_meta_data->>'country');
  end if;

  if new.raw_user_meta_data->>'city' is not null then
    user_settings := user_settings || jsonb_build_object('city', new.raw_user_meta_data->>'city');
  end if;

  insert into public.profiles (id, email, role, plan, full_name, settings)
  values (
    new.id,
    new.email,
    'user',
    'free',
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    user_settings
  );
  return new;
exception
  when others then
    raise warning 'handle_new_user error for email %: % (SQLSTATE: %)', new.email, sqlerrm, sqlstate;
    return new;
end;
$$;
