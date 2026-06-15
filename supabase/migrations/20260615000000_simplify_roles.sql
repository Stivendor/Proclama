-- Simplify roles: collapse all non-admin roles → user
-- Order matters:
--   1. Drop old constraint (blocks setting role='user')
--   2. Disable triggers (protect_profile_fields reverts role on UPDATE when auth.uid() is NULL)
--   3. Backfill
--   4. Re-enable triggers, set new default, add new constraint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END$$;

ALTER TABLE public.profiles DISABLE TRIGGER before_profile_update;
ALTER TABLE public.profiles DISABLE TRIGGER enforce_profile_field_protection;

UPDATE public.profiles
  SET role = 'user'
  WHERE role IS NULL OR role NOT IN ('admin', 'user');

ALTER TABLE public.profiles ENABLE TRIGGER before_profile_update;
ALTER TABLE public.profiles ENABLE TRIGGER enforce_profile_field_protection;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY['admin'::text, 'user'::text]));
