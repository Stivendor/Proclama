create table if not exists public.song_reports (
  id uuid primary key default gen_random_uuid(),
  song_id bigint not null references public.songs(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  reason text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

alter table public.song_reports
  alter column user_id drop not null;

alter table public.song_reports enable row level security;

drop policy if exists "Anyone can create song reports" on public.song_reports;
create policy "Anyone can create song reports"
  on public.song_reports
  for insert
  to anon, authenticated
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "Admins can view song reports" on public.song_reports;
create policy "Admins can view song reports"
  on public.song_reports
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can delete song reports" on public.song_reports;
create policy "Admins can delete song reports"
  on public.song_reports
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
