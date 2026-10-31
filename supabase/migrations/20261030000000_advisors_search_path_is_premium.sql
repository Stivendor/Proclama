-- Supabase advisors (2026-10-30):
-- 1. function_search_path_mutable: fijar search_path en las dos funciones que no lo tenían.
-- 2. is_premium(uid) era ejecutable por anon vía /rest/v1/rpc/is_premium y revelaba si
--    cualquier UUID es premium. anon lo hereda de PUBLIC, por eso se revoca de ambos.
--    Las policies que lo usan son de `authenticated`, salvo el INSERT de collaborators
--    (rol public): para anon pasa de "rechazado por RLS" a "permission denied", sigue denegado.

alter function public.handle_storage_background_deleted() set search_path = public;
alter function public.update_updated_at_column() set search_path = public;

revoke execute on function public.is_premium(uuid) from public, anon;
grant execute on function public.is_premium(uuid) to authenticated, service_role;
