-- Migration: Add RLS policies for songs table to allow admin access
-- Date: 2026-05-19
-- Description: Admins need to see and manage all songs, including unverified ones.
-- Without these policies, admins can't see pending songs (is_public=true, is_verified=false)
-- owned by other users, and can't approve/reject them.

-- Enable RLS on songs (idempotent — safe if already enabled)
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Allow admins to SELECT any song (needed for dashboard, pending review, global library)
DROP POLICY IF EXISTS "Admins can view all songs" ON public.songs;
CREATE POLICY "Admins can view all songs"
  ON public.songs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Allow admins to UPDATE any song (needed for approve/reject/edit)
DROP POLICY IF EXISTS "Admins can update any song" ON public.songs;
CREATE POLICY "Admins can update any song"
  ON public.songs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Allow admins to DELETE any song (needed for moderation)
DROP POLICY IF EXISTS "Admins can delete any song" ON public.songs;
CREATE POLICY "Admins can delete any song"
  ON public.songs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
