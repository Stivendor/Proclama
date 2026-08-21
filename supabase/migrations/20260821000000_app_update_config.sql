create table if not exists public.app_update_config (
  id smallint primary key check (id = 1),
  min_supported_version text not null,
  latest_version text not null,
  force_update boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.app_update_config enable row level security;

create policy "app_update_config_select_public"
  on public.app_update_config
  for select
  to anon, authenticated
  using (true);

insert into public.app_update_config (id, min_supported_version, latest_version, force_update)
values (1, '1.0.0', '1.0.0', false)
on conflict (id) do nothing;
