-- Remove is_authorized: all song approval goes through admin review.
-- Update trigger to stop protecting the removed column.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    NEW.role               := OLD.role;
    NEW.plan               := OLD.plan;
    NEW.premium_expires_at := OLD.premium_expires_at;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_authorized;
