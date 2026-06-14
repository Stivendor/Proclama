-- Migration: Protect sensitive profile fields from self-escalation
-- Date: 2026-06-13
--
-- The RLS policy "Users can update own profile" allows row-level access but
-- cannot restrict which columns are modified (PostgreSQL RLS is row-level only).
-- This trigger enforces column-level protection for role, plan, and is_authorized,
-- ensuring only admins can change those fields.

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- If the caller is not an admin, reset protected fields to their old values
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    NEW.role          := OLD.role;
    NEW.plan          := OLD.plan;
    NEW.is_authorized := OLD.is_authorized;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_field_protection ON public.profiles;
CREATE TRIGGER enforce_profile_field_protection
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();
