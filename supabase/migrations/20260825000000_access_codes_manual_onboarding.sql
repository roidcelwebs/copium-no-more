-- No More Copium — Access codes (one-time vouchers) + manual onboarding foundation
--
-- Lovable auto-applies migrations in supabase/migrations/ on deploy.
--
-- WHAT THIS ADDS
--   1) access_codes          — coach-issued one-time codes (bcrypt at rest, voucher lifecycle)
--   2) access_code_attempts  — per-IP attempt log used for login rate limiting
--   3) access_code_events    — audit trail (created / redeemed / failed / locked / ...)
--   4) client_program_bundles — per-client snapshot of their program (coach-published)
--   5) app_accounts.approved_at — the client access gate (coach-set ONLY, never client-writable)
--   6) Username rule tightened: lowercase a–z, 0–9, underscore ONLY, 3–30 chars
--   7) Clients no longer self-drive onboarding state (old automated flow retired)
--   8) RPCs: approve_client / publish_client_program / get_client_program_bundle /
--      append_onboarding_greeting
--
-- ACCESS MODEL
--   The four new tables are service-role only: no grants to anon/authenticated,
--   RLS enabled with no policies (default deny). Clients touch them ONLY through
--   the SECURITY DEFINER RPCs / edge functions. No plaintext codes are stored.

-- ------------------------------------------------------------------------
-- 1. Access codes (one-time vouchers)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_codes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash         text NOT NULL UNIQUE,          -- bcrypt(cost 12) of the full 12-char code
  code_prefix       text NOT NULL,                 -- first 4 chars (display only, never auth)
  note              text NOT NULL DEFAULT '',
  created_by        uuid NOT NULL REFERENCES public.app_accounts(id),
  expires_at        timestamptz NOT NULL,          -- 72h default; expires if never redeemed
  failed_attempts   integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  -- voucher lifecycle:
  redeemed_at       timestamptz,                   -- set instantly on a valid submit (code is dead)
  ticket_hash       text,                          -- bcrypt of the 64-hex one-time ticket
  ticket_expires_at timestamptz,                   -- 30 min window to finish account creation
  used_at           timestamptz,                   -- set when the client account row is created
  used_by           uuid REFERENCES public.app_accounts(id),
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_codes_prefix_idx ON public.access_codes (code_prefix);
CREATE INDEX IF NOT EXISTS access_codes_expires_idx ON public.access_codes (expires_at);

-- ------------------------------------------------------------------------
-- 2. Attempt log (per-IP rate limiting + per-code lockout)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_code_attempts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash      text NOT NULL,                     -- sha256(ip): no raw IP kept
  code_id      uuid REFERENCES public.access_codes(id),
  outcome      text NOT NULL,                     -- ok | bad_code | locked | expired | revoked | rate_limited
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_code_attempts_ip_window
  ON public.access_code_attempts (ip_hash, attempted_at);

-- ------------------------------------------------------------------------
-- 3. Audit events (coach-visible history)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_code_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_id     uuid REFERENCES public.access_codes(id),
  code_prefix text,
  event       text NOT NULL,                      -- created | redeemed | account_created | failed | locked | expired | revoked | coach_login_ok | coach_login_fail
  actor       text NOT NULL,                      -- code:<prefix> | coach | ip:<hash8>
  ip_hash     text,
  detail      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_code_events_created_idx
  ON public.access_code_events (created_at DESC);

-- ------------------------------------------------------------------------
-- 4. Per-client program snapshot (coach-published)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_program_bundles (
  client_id    uuid PRIMARY KEY REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  bundle       jsonb NOT NULL,                    -- { program, workouts[], exercises[], weight_units[] }
  published_by uuid NOT NULL REFERENCES public.app_accounts(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- 5. No client-side access to the new tables (service-role only)
-- ------------------------------------------------------------------------
REVOKE ALL ON public.access_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.access_code_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.access_code_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.client_program_bundles FROM PUBLIC, anon, authenticated;

ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_code_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_code_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_program_bundles ENABLE ROW LEVEL SECURITY;

-- The ONLY rules on these tables:
--   * bundles: a client may SELECT their own row (RLS + table grant; own-row only).
--   * everything else: service-role only — no table access at all.
GRANT SELECT ON public.client_program_bundles TO authenticated;

DROP POLICY IF EXISTS "Clients can read their own program bundle" ON public.client_program_bundles;
CREATE POLICY "Clients can read their own program bundle"
  ON public.client_program_bundles FOR SELECT
  TO authenticated
  USING (client_id = public.current_account_id());

-- ------------------------------------------------------------------------
-- 6. Account approval gate
-- ------------------------------------------------------------------------
ALTER TABLE public.app_accounts
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- ------------------------------------------------------------------------
-- 7. Username rule: lowercase a–z, 0–9, underscore ONLY, 3–30 chars
-- ------------------------------------------------------------------------
-- The identity-immutable trigger blocks username changes, so disable it
-- around the one-time lowercase backfill.
ALTER TABLE public.app_accounts DISABLE TRIGGER app_accounts_identity_immutable;
UPDATE public.app_accounts
  SET username = lower(username)
  WHERE username <> lower(username);
ALTER TABLE public.app_accounts ENABLE TRIGGER app_accounts_identity_immutable;

ALTER TABLE public.app_accounts
  DROP CONSTRAINT IF EXISTS app_accounts_username_check;
ALTER TABLE public.app_accounts
  ADD CONSTRAINT app_accounts_username_check CHECK (
    char_length(username) BETWEEN 3 AND 30
    AND username ~ '^[a-z0-9_]+$'
  );

-- ------------------------------------------------------------------------
-- 8. Retire client self-driven onboarding (old automated flow archived)
--    The client may no longer write onboarding_step/onboarding_completed_at.
--    Access = approved_at, set only by approve_client() (coach).
-- ------------------------------------------------------------------------
REVOKE UPDATE (onboarding_step, onboarding_completed_at) ON public.app_accounts FROM authenticated;
DROP POLICY IF EXISTS "Clients can update their own onboarding" ON public.app_accounts;

-- ------------------------------------------------------------------------
-- 9. RPCs (SECURITY DEFINER — the only way the new state changes)
-- ------------------------------------------------------------------------

-- 9.1 Coach approves a client → full access. Requires a program assignment.
CREATE OR REPLACE FUNCTION public.approve_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id uuid;
  v_client   public.app_accounts%ROWTYPE;
BEGIN
  SELECT id INTO v_coach_id
  FROM public.app_accounts
  WHERE auth_user_id = auth.uid() AND role = 'coach' AND is_preview = false
  LIMIT 1;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'A Coach account is required.';
  END IF;

  SELECT * INTO v_client
  FROM public.app_accounts
  WHERE id = p_client_id AND role = 'client' AND is_preview = false;
  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Client account was not found.';
  END IF;

  IF v_client.assigned_program_id IS NULL THEN
    RAISE EXCEPTION 'Assign a training program before approving this client.';
  END IF;

  UPDATE public.app_accounts
  SET approved_at = now()
  WHERE id = p_client_id;

  DELETE FROM public.payment_started WHERE client_id = p_client_id;
END;
$$;

-- 9.2 Coach publishes the client's program snapshot from the global library.
CREATE OR REPLACE FUNCTION public.publish_client_program(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id      uuid;
  v_client        public.app_accounts%ROWTYPE;
  v_programs      jsonb;
  v_workouts_all  jsonb;
  v_exercises_all jsonb;
  v_units         jsonb;
  v_program       jsonb;
  v_workout_ids   text[] := ARRAY[]::text[];
  v_workouts      jsonb := '[]'::jsonb;
  v_exercises     jsonb := '[]'::jsonb;
  v_bundle        jsonb;
BEGIN
  SELECT id INTO v_coach_id
  FROM public.app_accounts
  WHERE auth_user_id = auth.uid() AND role = 'coach' AND is_preview = false
  LIMIT 1;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'A Coach account is required.';
  END IF;

  SELECT * INTO v_client
  FROM public.app_accounts
  WHERE id = p_client_id AND role = 'client' AND is_preview = false;
  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Client account was not found.';
  END IF;
  IF v_client.assigned_program_id IS NULL THEN
    RAISE EXCEPTION 'Assign a training program before publishing.';
  END IF;

  SELECT programs, workouts, exercises, weight_units
  INTO v_programs, v_workouts_all, v_exercises_all, v_units
  FROM public.app_state
  WHERE id = 'global';

  IF v_programs IS NULL OR jsonb_typeof(v_programs) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'The program library is empty.';
  END IF;

  SELECT item.value INTO v_program
  FROM jsonb_array_elements(v_programs) AS item
  WHERE item.value->>'id' = v_client.assigned_program_id
  LIMIT 1;
  IF v_program IS NULL THEN
    RAISE EXCEPTION 'The assigned program was not found in the library.';
  END IF;

  -- Collect every workout id referenced by the program's day assignments.
  SELECT COALESCE(array_agg(DISTINCT assignment.value->>'workoutId'), ARRAY[]::text[])
  INTO v_workout_ids
  FROM jsonb_each(
    CASE WHEN v_program ? 'dayAssignments' THEN v_program->'dayAssignments' ELSE '{}'::jsonb END
  ) AS assignment(key, value)
  WHERE assignment.value->>'type' = 'workout'
    AND assignment.value->>'workoutId' IS NOT NULL;

  SELECT COALESCE(jsonb_agg(item.value), '[]'::jsonb)
  INTO v_workouts
  FROM jsonb_array_elements(v_workouts_all) AS item
  WHERE item.value->>'id' = ANY (v_workout_ids);

  -- Exercises referenced by those workouts only.
  SELECT COALESCE(jsonb_agg(item.value), '[]'::jsonb)
  INTO v_exercises
  FROM jsonb_array_elements(v_exercises_all) AS item
  WHERE item.value->>'id' IN (
    SELECT DISTINCT prescription.value->>'exerciseId'
    FROM jsonb_array_elements(v_workouts) AS workout
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(workout.value->'exercises', '[]'::jsonb)
    ) AS prescription
    WHERE prescription.value->>'exerciseId' IS NOT NULL
  );

  v_bundle := jsonb_build_object(
    'program', v_program,
    'workouts', v_workouts,
    'exercises', v_exercises,
    'weight_units', COALESCE(v_units, '[]'::jsonb)
  );

  INSERT INTO public.client_program_bundles (client_id, bundle, published_by, updated_at)
  VALUES (p_client_id, v_bundle, v_coach_id, now())
  ON CONFLICT (client_id) DO UPDATE
  SET bundle = EXCLUDED.bundle,
      published_by = EXCLUDED.published_by,
      updated_at = now();
END;
$$;

-- 9.3 Client reads their own snapshot (NULL until approved/published).
CREATE OR REPLACE FUNCTION public.get_client_program_bundle()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_approved  boolean;
  v_bundle    jsonb;
BEGIN
  v_client_id := public.current_account_id();
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to load your program.';
  END IF;

  SELECT approved_at IS NOT NULL INTO v_approved
  FROM public.app_accounts
  WHERE id = v_client_id AND role = 'client' AND is_preview = false;

  IF v_approved IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT bundle INTO v_bundle
  FROM public.client_program_bundles
  WHERE client_id = v_client_id;

  RETURN v_bundle;
END;
$$;

-- 9.4 Seed the ONE onboarding greeting (idempotent, server-side text only).
CREATE OR REPLACE FUNCTION public.append_onboarding_greeting(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name text;
  v_thread_id   uuid;
  v_coach_id    uuid;
  v_greeted     boolean;
  v_body        text;
BEGIN
  IF p_client_id <> public.current_account_id() THEN
    RAISE EXCEPTION 'Onboarding can only be opened on your own account.';
  END IF;

  SELECT name INTO v_client_name
  FROM public.app_accounts
  WHERE id = p_client_id AND role = 'client' AND is_preview = false;
  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Client account was not found.';
  END IF;

  v_thread_id := public.get_or_create_chat_thread(p_client_id);
  SELECT coach_id INTO v_coach_id
  FROM public.chat_threads
  WHERE id = v_thread_id;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach account was not found.';
  END IF;

  v_body := 'Welcome to No More Copium, ' || v_client_name
         || '. How many times a week do you usually work out right now, brother?';

  SELECT EXISTS (
    SELECT 1
    FROM public.chat_messages existing
    WHERE existing.thread_id = v_thread_id
      AND existing.sender_account_id = v_coach_id
      AND existing.body LIKE 'Welcome to No More Copium,%'
  ) INTO v_greeted;
  IF v_greeted THEN
    RETURN;
  END IF;

  INSERT INTO public.chat_messages (id, thread_id, sender_account_id, body)
  VALUES (gen_random_uuid(), v_thread_id, v_coach_id, v_body);

  UPDATE public.chat_threads
  SET last_message_body = v_body,
      last_message_sender_id = v_coach_id,
      last_message_at = now()
  WHERE id = v_thread_id;
END;
$$;

-- ------------------------------------------------------------------------
-- 10. Grants (authenticated execution only; anon/public get nothing)
-- ------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.approve_client(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_client_program(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_client_program_bundle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.append_onboarding_greeting(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.approve_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_client_program(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_program_bundle() TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_onboarding_greeting(uuid) TO authenticated;

-- ------------------------------------------------------------------------
-- 11. Chat thread creation hardening (same logic as 20260722173000, shadow-safe)
--     The original declared local variables named `thread_id` / `coach_id`,
--     which collide with chat_reads columns in the INSERT ... ON CONFLICT
--     statement. Postgres versions differ on whether that is an error
--     ("column reference is ambiguous"). Renamed to v_thread_id / v_coach_id.
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_chat_thread(p_client_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_thread_id uuid;
  v_coach_id  uuid;
BEGIN
  IF NOT (public.owns_app_account(p_client_id) OR public.is_app_coach()) THEN
    RAISE EXCEPTION 'You cannot access this Client conversation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_accounts
    WHERE id = p_client_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'Client account was not found';
  END IF;

  SELECT id INTO v_coach_id
  FROM public.app_accounts
  WHERE role = 'coach' AND is_preview = false
  LIMIT 1;
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach account was not found';
  END IF;

  SELECT id INTO v_thread_id
  FROM public.chat_threads
  WHERE client_id = p_client_id;
  IF v_thread_id IS NULL THEN
    INSERT INTO public.chat_threads (client_id, coach_id)
    VALUES (p_client_id, v_coach_id)
    ON CONFLICT (client_id) DO NOTHING
    RETURNING id INTO v_thread_id;
    IF v_thread_id IS NULL THEN
      SELECT id INTO v_thread_id
      FROM public.chat_threads
      WHERE client_id = p_client_id;
    END IF;
  END IF;

  INSERT INTO public.chat_reads (thread_id, account_id)
  VALUES (v_thread_id, p_client_id), (v_thread_id, v_coach_id)
  ON CONFLICT (thread_id, account_id) DO NOTHING;
  RETURN v_thread_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_chat_thread(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_chat_thread(uuid) TO authenticated;
