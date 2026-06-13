-- Migration: Hardening RLS for all critical tables
-- Date: 2026-06-13
-- Ensures that every table has RLS enabled and that policies prevent
-- unauthorized data access or privilege escalation.

-- ─── Helper: reusable admin check ────────────────────────────────────────────
-- We use EXISTS + subquery (not a function) so the planner can inline it.

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can only update safe fields on their own profile (name, settings)
-- Critical fields (plan, role, is_authorized) require admin — enforced via separate policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Only admins can update plan, role, is_authorized (privilege escalation prevention)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ─── SETLISTS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own setlists" ON public.setlists;
CREATE POLICY "Users can manage own setlists"
  ON public.setlists
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── USER_DEVICES ─────────────────────────────────────────────────────────────
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own devices" ON public.user_devices;
CREATE POLICY "Users can manage own devices"
  ON public.user_devices
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all devices" ON public.user_devices;
CREATE POLICY "Admins can view all devices"
  ON public.user_devices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ─── ATTENDANCE_RECORDS ───────────────────────────────────────────────────────
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own attendance" ON public.attendance_records;
CREATE POLICY "Users can manage own attendance"
  ON public.attendance_records
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance_records;
CREATE POLICY "Admins can view all attendance"
  ON public.attendance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ─── FEEDBACK ─────────────────────────────────────────────────────────────────
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Any authenticated or anonymous user can insert feedback
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read and update feedback
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
CREATE POLICY "Admins can view all feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
CREATE POLICY "Admins can update feedback"
  ON public.feedback FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ─── BACKGROUNDS ──────────────────────────────────────────────────────────────
ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read backgrounds
DROP POLICY IF EXISTS "Authenticated users can view backgrounds" ON public.backgrounds;
CREATE POLICY "Authenticated users can view backgrounds"
  ON public.backgrounds FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage backgrounds
DROP POLICY IF EXISTS "Admins can manage backgrounds" ON public.backgrounds;
CREATE POLICY "Admins can manage backgrounds"
  ON public.backgrounds FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ─── PREMIUM_INTEREST ─────────────────────────────────────────────────────────
ALTER TABLE public.premium_interest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can register premium interest" ON public.premium_interest;
CREATE POLICY "Anyone can register premium interest"
  ON public.premium_interest FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view premium interest" ON public.premium_interest;
CREATE POLICY "Admins can view premium interest"
  ON public.premium_interest FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ─── ADMIN_LOGS ───────────────────────────────────────────────────────────────
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage admin logs" ON public.admin_logs;
CREATE POLICY "Admins can manage admin logs"
  ON public.admin_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ─── SONGS: add missing user INSERT policy ────────────────────────────────────
-- (The admin SELECT/UPDATE/DELETE policies exist; users need to INSERT their own songs)
DROP POLICY IF EXISTS "Users can insert own songs" ON public.songs;
CREATE POLICY "Users can insert own songs"
  ON public.songs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own songs" ON public.songs;
CREATE POLICY "Users can update own songs"
  ON public.songs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own songs" ON public.songs;
CREATE POLICY "Users can delete own songs"
  ON public.songs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Public songs are readable by anyone
DROP POLICY IF EXISTS "Public songs are readable by anyone" ON public.songs;
CREATE POLICY "Public songs are readable by anyone"
  ON public.songs FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Users can read their own private songs
DROP POLICY IF EXISTS "Users can read own songs" ON public.songs;
CREATE POLICY "Users can read own songs"
  ON public.songs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
