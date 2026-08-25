-- No More Copium — Cloud runtime for the Google-authenticated app
-- Lovable auto-applies migrations in supabase/migrations/ on deploy.
-- 1) Onboarding state columns on app_accounts
-- 2) Table grants for the payment/paused tables (policies already exist)
-- 3) Workout history UPDATE/DELETE for the client owner
-- 4) Chat write access for thread participants
-- 5) Helper RPCs for payment unlock + payout decisions (SECURITY DEFINER)
--
-- FRESH-DB SAFETY (fixed 2026-08-25 for the remix, where this migration
-- applies to a brand-new database): the RLS helpers used by the policies
-- below are now DEFINED FIRST (they were previously declared after the
-- policies that reference them — those CREATE POLICY statements fail on a
-- fresh database), and the redundant CREATE OR REPLACE of
-- owns_app_account(account_id uuid) was removed (it re-declared a function
-- with a renamed parameter p_account_id from 20260722173000, which Postgres
-- rejects). Semantics are unchanged.
--

-- Helpers used above.
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


CREATE OR REPLACE FUNCTION public.is_chat_participant(thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = thread_id
      AND (t.client_id = public.current_account_id() OR t.coach_id = public.current_account_id())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_chat(thread_id uuid, sender_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sender_account_id = public.current_account_id()
     AND EXISTS (
       SELECT 1 FROM public.chat_threads t
       WHERE t.id = thread_id
         AND (t.client_id = public.current_account_id() OR t.coach_id = public.current_account_id())
     );
$$;


-- ---------------------------------------------------------------
-- 1. Onboarding state on accounts
-- ---------------------------------------------------------------
ALTER TABLE public.app_accounts
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0
    CHECK (onboarding_step BETWEEN 0 AND 7),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

GRANT UPDATE (onboarding_step, onboarding_completed_at, assigned_program_id)
  ON public.app_accounts TO authenticated;

-- Clients may update their own onboarding fields (column grants limit the damage).
DROP POLICY IF EXISTS "Clients can update their own onboarding" ON public.app_accounts;
CREATE POLICY "Clients can update their own onboarding"
  ON public.app_accounts FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid() AND is_preview = false)
  WITH CHECK (auth_user_id = auth.uid() AND is_preview = false);

-- ---------------------------------------------------------------
-- 2. Grants for payment + paused tables (policies exist in 20260806120000)
-- ---------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payouts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.payment_started TO authenticated;
GRANT SELECT, UPDATE ON public.payment_settings TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.paused_workouts TO authenticated;

-- Clients may read their own payment records (coach creates them).
DROP POLICY IF EXISTS payments_client_read ON public.payments;
CREATE POLICY payments_client_read ON public.payments
  FOR SELECT TO authenticated
  USING (client_id = public.current_account_id());

-- ---------------------------------------------------------------
-- 3. Workout history: client owns their rows fully
-- ---------------------------------------------------------------
GRANT UPDATE, DELETE ON public.workout_sessions TO authenticated;

DROP POLICY IF EXISTS "Clients can update their own workout history" ON public.workout_sessions;
CREATE POLICY "Clients can update their own workout history"
  ON public.workout_sessions FOR UPDATE
  TO authenticated
  USING (public.owns_app_account(client_id))
  WITH CHECK (public.owns_app_account(client_id));

DROP POLICY IF EXISTS "Clients can delete their own workout history" ON public.workout_sessions;
CREATE POLICY "Clients can delete their own workout history"
  ON public.workout_sessions FOR DELETE
  TO authenticated
  USING (public.owns_app_account(client_id));

-- ---------------------------------------------------------------
-- 4. Chat writes for participants
-- ---------------------------------------------------------------
GRANT INSERT ON public.chat_threads TO authenticated;
GRANT INSERT ON public.chat_messages TO authenticated;
GRANT INSERT, UPDATE ON public.chat_reads TO authenticated;

-- A client creates their own thread with the coach.
DROP POLICY IF EXISTS "Clients can create their own chat thread" ON public.chat_threads;
CREATE POLICY "Clients can create their own chat thread"
  ON public.chat_threads FOR INSERT
  TO authenticated
  WITH CHECK (public.owns_app_account(client_id));

-- Participants can post messages in their thread.
DROP POLICY IF EXISTS "Chat participants can insert messages" ON public.chat_messages;
CREATE POLICY "Chat participants can insert messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (public.can_write_chat(thread_id, sender_account_id));

-- Participants can record their own read state.
DROP POLICY IF EXISTS "Chat participants can write their read state" ON public.chat_reads;
CREATE POLICY "Chat participants can write their read state"
  ON public.chat_reads FOR INSERT
  TO authenticated
  WITH CHECK (public.is_chat_participant(thread_id) AND account_id = public.current_account_id());

DROP POLICY IF EXISTS "Chat participants can update their read state" ON public.chat_reads;
CREATE POLICY "Chat participants can update their read state"
  ON public.chat_reads FOR UPDATE
  TO authenticated
  USING (public.is_chat_participant(thread_id) AND account_id = public.current_account_id())
  WITH CHECK (public.is_chat_participant(thread_id) AND account_id = public.current_account_id());

-- (RLS helpers are defined at the top of this file.)
-- ---------------------------------------------------------------
-- 5. Payment + payout RPCs (SECURITY DEFINER — service-role authority)
-- ---------------------------------------------------------------

-- Coach records a confirmed payment for a client (by username) and unlocks them.
CREATE OR REPLACE FUNCTION public.record_payment_and_unlock(
  p_client_username text,
  p_amount_usd numeric,
  p_note text,
  p_recorded_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.app_accounts%ROWTYPE;
  v_tag text;
  v_payment_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_accounts WHERE id = p_recorded_by AND role = 'coach' AND is_preview = false) THEN
    RAISE EXCEPTION 'A Coach account is required.';
  END IF;
  SELECT * INTO v_client FROM public.app_accounts
    WHERE lower(username) = lower(p_client_username) AND role = 'client' AND is_preview = false
    LIMIT 1;
  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'No client account found with that username.';
  END IF;

  v_tag := 'new_user';
  IF EXISTS (SELECT 1 FROM public.payments WHERE client_id = v_client.id) THEN
    v_tag := 'membership';
  END IF;

  INSERT INTO public.payments (client_id, client_username, client_name, amount_usd, tag, note, recorded_by)
  VALUES (v_client.id, v_client.username, v_client.name, p_amount_usd, v_tag, NULLIF(btrim(coalesce(p_note, '')), ''), p_recorded_by)
  RETURNING id INTO v_payment_id;

  UPDATE public.app_accounts
  SET onboarding_step = 7, onboarding_completed_at = now()
  WHERE id = v_client.id;

  DELETE FROM public.payment_started WHERE client_id = v_client.id;

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_payment_and_unlock(text, numeric, text, uuid) TO authenticated;

-- Payment manager / coach submit a payout.
CREATE OR REPLACE FUNCTION public.submit_payout(
  p_amount_usd numeric,
  p_screenshot_id text,
  p_note text,
  p_submitted_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout_id uuid;
BEGIN
  IF p_amount_usd <= 0 THEN RAISE EXCEPTION 'Enter a payout amount greater than zero.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_accounts WHERE id = p_submitted_by AND role IN ('coach', 'payment_manager') AND is_preview = false) THEN
    RAISE EXCEPTION 'A Coach or Payment Manager account is required.';
  END IF;
  INSERT INTO public.payouts (amount_usd, screenshot_id, note, submitted_by)
  VALUES (p_amount_usd, NULLIF(btrim(coalesce(p_screenshot_id, '')), ''), NULLIF(btrim(coalesce(p_note, '')), ''), p_submitted_by)
  RETURNING id INTO v_payout_id;
  RETURN v_payout_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_payout(numeric, text, text, uuid) TO authenticated;

-- Coach decides a payout.
CREATE OR REPLACE FUNCTION public.decide_payout(
  p_payout_id uuid,
  p_decision text,
  p_coach_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_accounts WHERE id = p_coach_id AND role = 'coach' AND is_preview = false) THEN
    RAISE EXCEPTION 'A Coach account is required.';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Invalid decision.'; END IF;
  UPDATE public.payouts
  SET status = p_decision,
      decided_at = now(),
      decided_by_coach_id = p_coach_id,
      rejection_reason = CASE WHEN p_decision = 'rejected' THEN NULLIF(btrim(coalesce(p_reason, '')), '') ELSE NULL END
  WHERE id = p_payout_id AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_payout(uuid, text, uuid, text) TO authenticated;

-- Client records that they started a payment (card/paypal).
CREATE OR REPLACE FUNCTION public.record_payment_started(p_client_id uuid, p_method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.app_accounts%ROWTYPE;
BEGIN
  IF p_client_id <> public.current_account_id() THEN
    RAISE EXCEPTION 'You can only start a payment for your own account.';
  END IF;
  SELECT * INTO v_client FROM public.app_accounts WHERE id = p_client_id AND is_preview = false;
  IF v_client.id IS NULL THEN RAISE EXCEPTION 'Client account not found.'; END IF;
  IF p_method NOT IN ('card', 'paypal') THEN RAISE EXCEPTION 'Invalid payment method.'; END IF;
  DELETE FROM public.payment_started WHERE client_id = p_client_id;
  INSERT INTO public.payment_started (client_id, client_username, client_name, method)
  VALUES (v_client.id, v_client.username, v_client.name, p_method);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_payment_started(uuid, text) TO authenticated;

-- Coach upserts payment settings (single row).
CREATE OR REPLACE FUNCTION public.upsert_payment_settings(p_card_url text, p_paypal_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_accounts WHERE auth_user_id = auth.uid() AND role = 'coach' AND is_preview = false) THEN
    RAISE EXCEPTION 'A Coach account is required.';
  END IF;
  INSERT INTO public.payment_settings (id, card_url, paypal_url, updated_at)
  VALUES (1, coalesce(p_card_url, ''), coalesce(p_paypal_url, ''), now())
  ON CONFLICT (id) DO UPDATE
  SET card_url = EXCLUDED.card_url, paypal_url = EXCLUDED.paypal_url, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_payment_settings(text, text) TO authenticated;

-- Unread counts for the chat badge (rows: thread_id, client_id, unread).
CREATE OR REPLACE FUNCTION public.unread_counts(p_account_id uuid)
RETURNS TABLE (thread_id uuid, client_id uuid, unread bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_threads AS (
    SELECT id, client_id FROM public.chat_threads
    WHERE client_id = p_account_id OR coach_id = p_account_id
  ),
  my_reads AS (
    SELECT thread_id, last_read_at FROM public.chat_reads WHERE account_id = p_account_id
  )
  SELECT t.id, t.client_id, COUNT(m.id)::bigint AS unread
  FROM my_threads t
  JOIN public.chat_messages m ON m.thread_id = t.id
  LEFT JOIN my_reads r ON r.thread_id = t.id
  WHERE m.sender_account_id <> p_account_id
    AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
  GROUP BY t.id, t.client_id;
$$;

GRANT EXECUTE ON FUNCTION public.unread_counts(uuid) TO authenticated;

-- Client appends their onboarding script messages (client answer + coach replies).
CREATE OR REPLACE FUNCTION public.append_onboarding_messages(
  p_client uuid,
  p_messages jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread public.chat_threads%ROWTYPE;
  v_message jsonb;
  v_sender uuid;
  v_body text;
  v_created timestamptz;
BEGIN
  IF p_client <> public.current_account_id() THEN
    RAISE EXCEPTION 'Onboarding messages can only be appended to your own thread.';
  END IF;

  SELECT * INTO v_thread FROM public.chat_threads WHERE client_id = p_client LIMIT 1;
  IF v_thread.id IS NULL THEN
    SELECT * INTO v_thread FROM public.chat_threads WHERE client_id = p_client LIMIT 1;
  END IF;
  IF v_thread.id IS NULL THEN
    RAISE EXCEPTION 'No chat thread exists for this client.';
  END IF;

  FOR v_message IN SELECT * FROM jsonb_array_elements(p_messages) LOOP
    v_sender := (v_message->>'sender')::uuid;
    v_body := btrim(coalesce(v_message->>'body', ''));
    v_created := coalesce((v_message->>'created_at')::timestamptz, now());
    IF v_body = '' OR char_length(v_body) > 2000 THEN
      CONTINUE;
    END IF;
    IF v_sender <> p_client AND v_sender <> v_thread.coach_id THEN
      CONTINUE;
    END IF;
    INSERT INTO public.chat_messages (thread_id, sender_account_id, body, created_at)
    VALUES (v_thread.id, v_sender, v_body, v_created);
    UPDATE public.chat_threads
    SET last_message_body = v_body,
        last_message_sender_id = v_sender,
        last_message_at = v_created
    WHERE id = v_thread.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_onboarding_messages(uuid, jsonb) TO authenticated;
