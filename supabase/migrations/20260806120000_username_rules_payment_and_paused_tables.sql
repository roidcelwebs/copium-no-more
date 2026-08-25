-- No More Copium — Cloud reactivation prep
-- 1) Username rules: A–Z, a–z, 0–9, underscore only (case preserved), 3–30 chars.
-- 2) New tables for the payment system and paused workouts (mirrors the local models).

-- ---------------------------------------------------------------
-- 1. Username rules
-- ---------------------------------------------------------------
ALTER TABLE public.app_accounts
  DROP CONSTRAINT IF EXISTS app_accounts_username_check;

ALTER TABLE public.app_accounts
  ADD CONSTRAINT app_accounts_username_check CHECK (
    char_length(username) BETWEEN 3 AND 30
    AND username ~ '^[A-Za-z0-9_]+$'
  );

-- Case-insensitive uniqueness: "John" and "john" collide.
DROP INDEX IF EXISTS app_accounts_username_lower_unique;
CREATE UNIQUE INDEX app_accounts_username_lower_unique
  ON public.app_accounts (lower(username))
  WHERE is_preview = false;

-- ---------------------------------------------------------------
-- 2. Payment system tables
-- ---------------------------------------------------------------

-- Every confirmed client payment. Unlock is idempotent on this row.
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  client_username text NOT NULL,
  client_name text NOT NULL,
  amount_usd numeric(10,2) NOT NULL DEFAULT 29 CHECK (amount_usd > 0),
  tag text NOT NULL CHECK (tag IN ('new_user', 'membership')),
  note text,
  recorded_by uuid NOT NULL REFERENCES public.app_accounts(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_client_idx ON public.payments (client_id);
CREATE INDEX IF NOT EXISTS payments_recorded_at_idx ON public.payments (recorded_at DESC);

-- Payouts submitted by the US Payment Manager, decided by the coach.
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_usd numeric(10,2) NOT NULL CHECK (amount_usd > 0),
  screenshot_id text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by uuid NOT NULL REFERENCES public.app_accounts(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by_coach_id uuid REFERENCES public.app_accounts(id),
  rejection_reason text
);

CREATE INDEX IF NOT EXISTS payouts_status_idx ON public.payouts (status);
CREATE INDEX IF NOT EXISTS payouts_submitted_at_idx ON public.payouts (submitted_at DESC);

-- "Payment started" claims from the onboarding payment box.
CREATE TABLE IF NOT EXISTS public.payment_started (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  client_username text NOT NULL,
  client_name text NOT NULL,
  method text NOT NULL CHECK (method IN ('card', 'paypal')),
  started_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_started_client_idx ON public.payment_started (client_id);

-- Coach-editable payment links (single row).
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  card_url text NOT NULL DEFAULT '',
  paypal_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Paused workout sessions (resume same day, auto-finalize next day).
CREATE TABLE IF NOT EXISTS public.paused_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  program_id uuid,
  workout_id text NOT NULL,
  workout_name text NOT NULL,
  paused_at timestamptz NOT NULL DEFAULT now(),
  elapsed_seconds integer NOT NULL DEFAULT 0 CHECK (elapsed_seconds >= 0),
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  has_working_progress boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS paused_workouts_client_idx
  ON public.paused_workouts (client_id, workout_id);

-- ---------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------

-- Helpers resolving the current authenticated user's app account.
CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.app_accounts
  WHERE auth_user_id = auth.uid() AND is_preview = false
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_coach()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_accounts
    WHERE auth_user_id = auth.uid() AND role = 'coach' AND is_preview = false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_payment_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_accounts
    WHERE auth_user_id = auth.uid() AND role = 'payment_manager' AND is_preview = false
  );
$$;

-- payments: coach-managed records.
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_coach_all ON public.payments;
CREATE POLICY payments_coach_all ON public.payments
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- payouts: payment manager submits, coach decides.
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payouts_manager_select ON public.payouts;
CREATE POLICY payouts_manager_select ON public.payouts
  FOR SELECT TO authenticated USING (public.is_coach() OR public.is_payment_manager());
DROP POLICY IF EXISTS payouts_manager_insert ON public.payouts;
CREATE POLICY payouts_manager_insert ON public.payouts
  FOR INSERT TO authenticated WITH CHECK (public.is_payment_manager());
DROP POLICY IF EXISTS payouts_coach_update ON public.payouts;
CREATE POLICY payouts_coach_update ON public.payouts
  FOR UPDATE TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- payment_started: any authenticated user may read/write claims (coach reads, clients write).
ALTER TABLE public.payment_started ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_started_authenticated ON public.payment_started;
CREATE POLICY payment_started_authenticated ON public.payment_started
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- payment_settings: everyone reads (client needs to know if a method is configured), coach updates.
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_settings_select ON public.payment_settings;
CREATE POLICY payment_settings_select ON public.payment_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS payment_settings_coach_update ON public.payment_settings;
CREATE POLICY payment_settings_coach_update ON public.payment_settings
  FOR UPDATE TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- paused_workouts: clients own their own rows.
ALTER TABLE public.paused_workouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS paused_workouts_client_all ON public.paused_workouts;
CREATE POLICY paused_workouts_client_all ON public.paused_workouts
  FOR ALL TO authenticated
  USING (client_id = public.current_account_id())
  WITH CHECK (client_id = public.current_account_id());
