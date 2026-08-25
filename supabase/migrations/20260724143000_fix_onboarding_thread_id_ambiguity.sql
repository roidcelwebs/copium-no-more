-- Repair PL/pgSQL output-column shadowing in the onboarding RPCs.
-- The RETURNS TABLE output named thread_id is a PL/pgSQL variable; choose
-- actual table columns whenever an SQL statement uses the same identifier.

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
#variable_conflict use_column
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
#variable_conflict use_column
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

REVOKE ALL ON FUNCTION public.initialize_client_onboarding(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_client_onboarding(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_client_onboarding(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_client_onboarding(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
