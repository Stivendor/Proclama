-- Protect premium_expires_at from self-escalation
-- A premium user could otherwise extend their own expiry date via the API.
-- This adds premium_expires_at to the fields only admins can write.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    NEW.role               := OLD.role;
    NEW.plan               := OLD.plan;
    NEW.is_authorized      := OLD.is_authorized;
    NEW.premium_expires_at := OLD.premium_expires_at;
  END IF;

  RETURN NEW;
END;
$$;
