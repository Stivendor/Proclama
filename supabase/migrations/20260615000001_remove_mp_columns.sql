-- Remove MercadoPago columns from profiles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS mp_subscription_id,
  DROP COLUMN IF EXISTS subscription_plan;

DROP INDEX IF EXISTS idx_profiles_mp_subscription_id;
