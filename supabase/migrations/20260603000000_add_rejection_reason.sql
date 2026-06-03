-- Add rejection_reason column to songs table
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS rejection_reason text;
