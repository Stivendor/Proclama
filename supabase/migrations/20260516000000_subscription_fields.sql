-- Migration: Add subscription fields to profiles
-- Date: 2026-05-16
-- Description: Supports monthly/annual MP subscriptions and lifetime legacy users

-- Add subscription tracking fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mp_subscription_id    TEXT,
  ADD COLUMN IF NOT EXISTS subscription_plan     TEXT CHECK (subscription_plan IN ('monthly', 'annual', 'lifetime', NULL)),
  ADD COLUMN IF NOT EXISTS premium_expires_at    TIMESTAMPTZ;

-- Index for quick expiry checks (e.g. cron jobs or webhooks)
CREATE INDEX IF NOT EXISTS idx_profiles_premium_expires_at
  ON public.profiles (premium_expires_at)
  WHERE premium_expires_at IS NOT NULL;

-- Index to look up a profile by subscription ID (webhook lookups)
CREATE INDEX IF NOT EXISTS idx_profiles_mp_subscription_id
  ON public.profiles (mp_subscription_id)
  WHERE mp_subscription_id IS NOT NULL;

-- Mark existing premium users as lifetime (registered before June 1st 2026)
-- premium_expires_at = NULL means lifetime — do NOT touch them in webhook logic
UPDATE public.profiles
  SET subscription_plan = 'lifetime'
  WHERE plan = 'premium'
    AND mp_subscription_id IS NULL
    AND premium_expires_at IS NULL;

-- Comment explaining the plan field semantics:
-- plan = 'premium' AND premium_expires_at IS NULL  → lifetime (never expires)
-- plan = 'premium' AND premium_expires_at > NOW()  → active subscription
-- plan = 'premium' AND premium_expires_at <= NOW() → expired, should be downgraded
-- plan = 'free'                                    → no premium access
