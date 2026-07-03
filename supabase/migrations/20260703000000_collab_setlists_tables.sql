-- Repertorio colaborativo: setlists en la nube + colaboradores con token
-- Spec: docs/superpowers/specs/2026-07-03-repertorio-colaborativo-design.md

-- ─── setlists ────────────────────────────────────────────────────────────────
create table if not exists public.setlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  date date,
  song_ids bigint[] not null default '{}',
  notes text,
  updated_by text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists setlists_user_id_idx on public.setlists (user_id);

alter table public.setlists enable row level security;

drop policy if exists "Owner full access on setlists" on public.setlists;
create policy "Owner full access on setlists"
  on public.setlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── collaborators ───────────────────────────────────────────────────────────
create table if not exists public.collaborators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token text unique not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists collaborators_owner_id_idx on public.collaborators (owner_id);
create index if not exists collaborators_token_idx on public.collaborators (token);

alter table public.collaborators enable row level security;

drop policy if exists "Owner full access on collaborators" on public.collaborators;
create policy "Owner full access on collaborators"
  on public.collaborators for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ─── realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'setlists'
  ) then
    alter publication supabase_realtime add table public.setlists;
  end if;
end $$;
