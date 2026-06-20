-- Enforcement server-side de recursos de pago. is_premium() es la fuente de verdad;
-- el cliente solo oculta botones. Un free que pegue directo al endpoint recibe 403.

-- ── attendance_records: lectura propia para todos; escritura (sync) solo premium ──
drop policy if exists "Users can manage own attendance" on public.attendance_records;
drop policy if exists "Users manage own attendance"     on public.attendance_records;

create policy "attendance_select_own"
  on public.attendance_records for select to authenticated
  using (auth.uid() = user_id);

create policy "attendance_insert_premium"
  on public.attendance_records for insert to authenticated
  with check (auth.uid() = user_id and public.is_premium(auth.uid()));

create policy "attendance_update_premium"
  on public.attendance_records for update to authenticated
  using (auth.uid() = user_id and public.is_premium(auth.uid()))
  with check (auth.uid() = user_id and public.is_premium(auth.uid()));

create policy "attendance_delete_premium"
  on public.attendance_records for delete to authenticated
  using (auth.uid() = user_id and public.is_premium(auth.uid()));

-- ── songs: lectura pública/propia y políticas admin intactas; escritura solo premium ──
drop policy if exists "Users can insert own songs"      on public.songs;
drop policy if exists "songs_insert_authenticated_user" on public.songs;
drop policy if exists "Users can update own songs"      on public.songs;
drop policy if exists "songs_update_authenticated_user" on public.songs;
drop policy if exists "Users can delete own songs"      on public.songs;
drop policy if exists "songs_delete_authenticated_user" on public.songs;

create policy "songs_insert_premium"
  on public.songs for insert to authenticated
  with check (auth.uid() = user_id and public.is_premium(auth.uid()));

create policy "songs_update_premium"
  on public.songs for update to authenticated
  using (auth.uid() = user_id and public.is_premium(auth.uid()))
  with check (auth.uid() = user_id and public.is_premium(auth.uid()));

create policy "songs_delete_premium"
  on public.songs for delete to authenticated
  using (auth.uid() = user_id and public.is_premium(auth.uid()));

-- ── storage bucket 'backgrounds': contenido global curado, solo admin escribe ──
-- (La sync masiva la hace la edge function con service_role, que ignora RLS.)
drop policy if exists "Authenticated Upload" on storage.objects;
drop policy if exists "Authenticated Delete" on storage.objects;

create policy "Backgrounds admin upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'backgrounds'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Backgrounds admin delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'backgrounds'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
