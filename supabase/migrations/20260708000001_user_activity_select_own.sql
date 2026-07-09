-- Migration: user_activity select-own policy
-- Date: 2026-07-08
-- Description: El upsert del heartbeat (INSERT ... ON CONFLICT DO NOTHING)
-- necesita una policy de SELECT para evaluar el conflicto contra las filas
-- existentes; sin ella Postgres rechaza el insert con violación de RLS.
-- Cada usuario solo puede ver sus propias filas.

drop policy if exists "Users can view own activity" on public.user_activity;
create policy "Users can view own activity"
  on public.user_activity for select
  to authenticated
  using (auth.uid() = user_id);
