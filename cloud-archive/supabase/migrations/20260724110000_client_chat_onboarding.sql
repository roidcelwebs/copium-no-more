-- Persisted, option-only Client onboarding inside the existing Coach chat.
-- Every Client account, including the Coach-owned preview Client, completes this once.

-- The fresh-Cloud migration tool omitted chat_reads from Realtime in one generated
-- migration copy. Repair that safely whether or not the canonical migration added it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_reads'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reads';
  END IF;
END;
$$;

ALTER TABLE public.app_accounts
  ADD COLUMN onboarding_step smallint NOT NULL DEFAULT 0,
  ADD COLUMN onboarding_completed_at timestamptz;

ALTER TABLE public.app_accounts
  ADD CONSTRAINT app_accounts_onboarding_step_check CHECK (
    onboarding_step BETWEEN 0 AND 5
  ),
  ADD CONSTRAINT app_accounts_onboarding_completion_check CHECK (
    onboarding_completed_at IS NULL OR onboarding_step = 5
  );

CREATE OR REPLACE FUNCTION public.initialize_client_onboarding(p_client_id uuid)
RETURNS TABLE (
  thread_id uuid,
  onboarding_step smallint,
  onboarding_completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  client_name text;
  current_step smallint;
  completed_at timestamptz;
  target_thread_id uuid;
  coach_account_id uuid;
  message_time timestamptz;
BEGIN
  IF NOT public.owns_app_account(p_client_id) THEN
    RAISE EXCEPTION 'You cannot initialize onboarding for this Client account';
  END IF;

  SELECT account.name, account.onboarding_step, account.onboarding_completed_at
  INTO client_name, current_step, completed_at
  FROM public.app_accounts account
  WHERE account.id = p_client_id
    AND account.role = 'client'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client account was not found';
  END IF;

  target_thread_id := public.get_or_create_chat_thread(p_client_id);

  IF current_step = 0 AND completed_at IS NULL THEN
    SELECT conversation.coach_id
    INTO coach_account_id
    FROM public.chat_threads conversation
    WHERE conversation.id = target_thread_id;

    IF coach_account_id IS NULL THEN
      RAISE EXCEPTION 'Coach account was not found';
    END IF;

    message_time := clock_timestamp();
    INSERT INTO public.chat_messages (
      id, thread_id, sender_account_id, body, created_at
    ) VALUES
      (
        gen_random_uuid(),
        target_thread_id,
        coach_account_id,
        format('Welcome to No More Copium, %s.', client_name),
        message_time
      ),
      (
        gen_random_uuid(),
        target_thread_id,
        coach_account_id,
        'How many times a week do you usually train?',
        message_time + interval '1 millisecond'
      );

    UPDATE public.app_accounts
    SET onboarding_step = 1
    WHERE id = p_client_id;
    current_step := 1;
  END IF;

  RETURN QUERY SELECT target_thread_id, current_step, completed_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_client_onboarding(
  p_client_id uuid,
  p_answer text
)
RETURNS TABLE (
  thread_id uuid,
  onboarding_step smallint,
  onboarding_completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_step smallint;
  completed_at timestamptz;
  normalized_answer text;
  next_message text;
  next_step smallint;
  target_thread_id uuid;
  coach_account_id uuid;
  message_time timestamptz;
BEGIN
  IF NOT public.owns_app_account(p_client_id) THEN
    RAISE EXCEPTION 'You cannot answer onboarding for this Client account';
  END IF;

  SELECT account.onboarding_step, account.onboarding_completed_at
  INTO current_step, completed_at
  FROM public.app_accounts account
  WHERE account.id = p_client_id
    AND account.role = 'client'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client account was not found';
  END IF;
  IF completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Onboarding is already complete';
  END IF;
  IF current_step NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'This onboarding answer is not currently expected';
  END IF;

  normalized_answer := btrim(COALESCE(p_answer, ''));
  CASE current_step
    WHEN 1 THEN
      IF normalized_answer NOT IN (
        '0–2 times a week',
        '3–4 times a week',
        '5–6 times a week'
      ) THEN
        RAISE EXCEPTION 'Choose one of the available training-frequency options';
      END IF;
      next_message := 'Do you work out at the gym or at home with no equipment?';
    WHEN 2 THEN
      IF normalized_answer NOT IN ('Gym', 'Home') THEN
        RAISE EXCEPTION 'Choose Gym or Home';
      END IF;
      next_message := 'How long is your usual workout?';
    WHEN 3 THEN
      IF normalized_answer NOT IN (
        'Below 30 minutes',
        'Around one hour',
        '1.5–2 hours'
      ) THEN
        RAISE EXCEPTION 'Choose one of the available workout-duration options';
      END IF;
      next_message := 'How is your exercise technique/form?';
    WHEN 4 THEN
      IF normalized_answer NOT IN (
        'Beginner / not the best',
        'Experienced / correct form and technique'
      ) THEN
        RAISE EXCEPTION 'Choose one of the available technique options';
      END IF;
      next_message := E'placeholder\nplaceholder';
  END CASE;

  target_thread_id := public.get_or_create_chat_thread(p_client_id);
  SELECT conversation.coach_id
  INTO coach_account_id
  FROM public.chat_threads conversation
  WHERE conversation.id = target_thread_id;
  IF coach_account_id IS NULL THEN
    RAISE EXCEPTION 'Coach account was not found';
  END IF;

  message_time := clock_timestamp();
  INSERT INTO public.chat_messages (
    id, thread_id, sender_account_id, body, created_at
  ) VALUES
    (
      gen_random_uuid(),
      target_thread_id,
      p_client_id,
      normalized_answer,
      message_time
    ),
    (
      gen_random_uuid(),
      target_thread_id,
      coach_account_id,
      next_message,
      message_time + interval '1 millisecond'
    );

  next_step := current_step + 1;
  UPDATE public.app_accounts
  SET onboarding_step = next_step
  WHERE id = p_client_id;

  RETURN QUERY SELECT target_thread_id, next_step, completed_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_client_onboarding(p_client_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  completed_at timestamptz;
BEGIN
  IF NOT public.owns_app_account(p_client_id) THEN
    RAISE EXCEPTION 'You cannot complete onboarding for this Client account';
  END IF;

  UPDATE public.app_accounts
  SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
  WHERE id = p_client_id
    AND role = 'client'
    AND onboarding_step = 5
  RETURNING onboarding_completed_at INTO completed_at;

  IF completed_at IS NULL THEN
    RAISE EXCEPTION 'Answer every onboarding question before entering the app';
  END IF;
  RETURN completed_at;
END;
$$;

-- Free-form Client chat remains unavailable until the option-only onboarding is complete.
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_message_id uuid,
  p_sender_account_id uuid,
  p_client_id uuid,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_thread_id uuid;
BEGIN
  IF NOT public.owns_app_account(p_sender_account_id) THEN
    RAISE EXCEPTION 'You cannot send messages as this account';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.app_accounts sender
    WHERE sender.id = p_sender_account_id
      AND sender.role = 'client'
      AND sender.onboarding_completed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Complete onboarding before sending free-form messages';
  END IF;
  IF p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Message must be between 1 and 2000 characters';
  END IF;

  target_thread_id := public.get_or_create_chat_thread(p_client_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_threads
    WHERE id = target_thread_id
      AND p_sender_account_id IN (client_id, coach_id)
  ) THEN
    RAISE EXCEPTION 'Message sender is not a participant in this chat';
  END IF;

  INSERT INTO public.chat_messages (id, thread_id, sender_account_id, body)
  VALUES (p_message_id, target_thread_id, p_sender_account_id, btrim(p_body))
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_messages existing_message
    WHERE existing_message.id = p_message_id
      AND existing_message.thread_id = target_thread_id
      AND existing_message.sender_account_id = p_sender_account_id
      AND existing_message.body = btrim(p_body)
  ) THEN
    RAISE EXCEPTION 'Message ID conflicts with another message';
  END IF;

  RETURN p_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_client_onboarding(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_client_onboarding(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_client_onboarding(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_chat_message(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_client_onboarding(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_client_onboarding(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_client_onboarding(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, uuid, uuid, text) TO authenticated;
