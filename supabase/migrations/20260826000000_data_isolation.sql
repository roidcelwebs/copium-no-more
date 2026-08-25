-- No More Copium — Data isolation (B6: clients read ONLY their own snapshot)
-- Lovable auto-applies migrations in supabase/migrations/ on deploy.
--
-- Background: the coach-authored library lives in ONE app_state row ('global')
-- with programs/exercises/workouts/weight_units. Clients previously could
-- SELECT it (any authenticated user could read every program). The app now
-- gives each client a per-client snapshot (client_program_bundles, written by
-- publish_client_program at approve time, read via get_client_program_bundle()).
--
-- WHAT THIS DOES
--   1) app_state SELECT  → coach-only (clients go through their own bundle).
--   2) program-covers storage bucket → coach-only (covers are device-local for
--      clients: the app renders covers from local blobs, so client UI is
--      unaffected; cover media is only uploaded coach-side).
--
-- No data is moved; unapproved clients simply see their (empty) own snapshot.

-- ---------------------------------------------------------------
-- 1. app_state: coach-only read
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read app state"
  ON public.app_state;
DROP POLICY IF EXISTS "Clients can read their coach library"
  ON public.app_state;

CREATE POLICY "Coach can read app state"
  ON public.app_state FOR SELECT
  TO authenticated
  USING (public.is_app_coach());

-- Keep the existing UPDATE policy untouched (already coach-only).

-- ---------------------------------------------------------------
-- 2. program-covers bucket: coach-only read
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read program covers"
  ON storage.objects;
DROP POLICY IF EXISTS "Prototype program covers can be read"
  ON storage.objects;

CREATE POLICY "Coach can read program covers"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'program-covers'
    AND public.is_app_coach()
  );
