-- Replace the public passwordless prototype with Google-authenticated accounts.
-- DESTRUCTIVE BY DESIGN: current prototype accounts and all rows that belong to
-- them are deleted through foreign-key cascades. Global coach-authored app_state
-- and program-cover media are intentionally preserved.

DELETE FROM public.app_accounts;

ALTER TABLE public.app_accounts
  ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN is_preview boolean NOT NULL DEFAULT false;

ALTER TABLE public.app_accounts
  ALTER COLUMN auth_user_id SET NOT NULL;

ALTER TABLE public.app_accounts
  DROP CONSTRAINT IF EXISTS app_accounts_username_check;

ALTER TABLE public.app_accounts
  ADD CONSTRAINT app_accounts_username_check CHECK (
    char_length(username) BETWEEN 3 AND 30
    AND username = lower(username)
    AND username ~ '^[a-z0-9]+( [a-z0-9]+)*$'
  ),
  ADD CONSTRAINT app_accounts_preview_role_check CHECK (
    NOT is_preview OR role = 'client'
  );

CREATE UNIQUE INDEX app_accounts_primary_auth_user_unique
  ON public.app_accounts (auth_user_id)
  WHERE is_preview = false;

CREATE UNIQUE INDEX app_accounts_preview_auth_user_unique
  ON public.app_accounts (auth_user_id)
  WHERE is_preview = true;

CREATE INDEX app_accounts_auth_user_idx
  ON public.app_accounts (auth_user_id);

CREATE OR REPLACE FUNCTION public.prevent_account_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role <> OLD.role THEN
    RAISE EXCEPTION 'Account role cannot be changed';
  END IF;
  IF NEW.username <> OLD.username THEN
    RAISE EXCEPTION 'Username cannot be changed';
  END IF;
  IF NEW.auth_user_id <> OLD.auth_user_id THEN
    RAISE EXCEPTION 'Authenticated identity cannot be changed';
  END IF;
  IF NEW.is_preview <> OLD.is_preview THEN
    RAISE EXCEPTION 'Preview status cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.owns_app_account(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.app_accounts account
    WHERE account.id = p_account_id
      AND account.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_app_coach()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.app_accounts account
    WHERE account.auth_user_id = auth.uid()
      AND account.role = 'coach'
      AND account.is_preview = false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_client_account(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.owns_app_account(p_client_id) OR public.is_app_coach();
$$;

CREATE OR REPLACE FUNCTION public.can_access_chat_thread(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.chat_threads thread
    JOIN public.app_accounts participant
      ON participant.id IN (thread.client_id, thread.coach_id)
    WHERE thread.id = p_thread_id
      AND participant.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_coach_profile()
RETURNS TABLE (
  id uuid,
  name text,
  username text,
  role text,
  is_preview boolean,
  assigned_program_id text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    account.id,
    account.name,
    account.username,
    account.role,
    account.is_preview,
    account.assigned_program_id,
    account.created_at
  FROM public.app_accounts account
  WHERE auth.uid() IS NOT NULL
    AND account.role = 'coach'
    AND account.is_preview = false
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.owns_app_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_app_coach() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_read_client_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_access_chat_thread(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_coach_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owns_app_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_coach() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_client_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_chat_thread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_coach_profile() TO authenticated;

-- Remove every public prototype policy.
DROP POLICY IF EXISTS "Prototype accounts are publicly readable" ON public.app_accounts;
DROP POLICY IF EXISTS "Prototype accounts are publicly creatable" ON public.app_accounts;
DROP POLICY IF EXISTS "Prototype client assignments are publicly editable" ON public.app_accounts;
DROP POLICY IF EXISTS "Prototype app state is publicly readable" ON public.app_state;
DROP POLICY IF EXISTS "Prototype app state is publicly editable" ON public.app_state;
DROP POLICY IF EXISTS "Prototype workout sessions are publicly readable" ON public.workout_sessions;
DROP POLICY IF EXISTS "Prototype workout sessions are publicly creatable" ON public.workout_sessions;
DROP POLICY IF EXISTS "Prototype progress-picture batches are publicly readable" ON public.progress_picture_batches;
DROP POLICY IF EXISTS "Prototype progress pictures are publicly readable" ON public.progress_pictures;
DROP POLICY IF EXISTS "Prototype chat threads are publicly readable" ON public.chat_threads;
DROP POLICY IF EXISTS "Prototype chat messages are publicly readable" ON public.chat_messages;
DROP POLICY IF EXISTS "Prototype chat reads are publicly readable" ON public.chat_reads;
DROP POLICY IF EXISTS "Prototype progress pictures can be read" ON storage.objects;
DROP POLICY IF EXISTS "Prototype progress pictures can be uploaded" ON storage.objects;
DROP POLICY IF EXISTS "Prototype failed progress-picture uploads can be removed" ON storage.objects;
DROP POLICY IF EXISTS "Prototype program covers can be read" ON storage.objects;

REVOKE ALL PRIVILEGES ON public.app_accounts FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public.app_state FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public.workout_sessions FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public.progress_picture_batches FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public.progress_pictures FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public.chat_threads FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public.chat_messages FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public.chat_reads FROM anon, authenticated;

GRANT SELECT ON public.app_accounts TO authenticated;
GRANT UPDATE (assigned_program_id) ON public.app_accounts TO authenticated;
GRANT SELECT ON public.app_state TO authenticated;
GRANT UPDATE (programs, exercises, workouts, weight_units) ON public.app_state TO authenticated;
GRANT SELECT, INSERT ON public.workout_sessions TO authenticated;
GRANT SELECT ON public.progress_picture_batches TO authenticated;
GRANT SELECT ON public.progress_pictures TO authenticated;
GRANT SELECT ON public.chat_threads TO authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT SELECT ON public.chat_reads TO authenticated;

CREATE POLICY "Authenticated users can read their accounts"
ON public.app_accounts FOR SELECT
TO authenticated
USING (
  auth_user_id = auth.uid()
  OR public.is_app_coach()
);

CREATE POLICY "Coach can assign client programs"
ON public.app_accounts FOR UPDATE
TO authenticated
USING (
  public.is_app_coach()
  AND role = 'client'
)
WITH CHECK (
  public.is_app_coach()
  AND role = 'client'
);

CREATE POLICY "Authenticated users can read app state"
ON public.app_state FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Coach can update app state"
ON public.app_state FOR UPDATE
TO authenticated
USING (public.is_app_coach())
WITH CHECK (public.is_app_coach());

CREATE POLICY "Clients and Coach can read permitted workout history"
ON public.workout_sessions FOR SELECT
TO authenticated
USING (public.can_read_client_account(client_id));

CREATE POLICY "Clients can create their own workout history"
ON public.workout_sessions FOR INSERT
TO authenticated
WITH CHECK (public.owns_app_account(client_id));

CREATE POLICY "Clients and Coach can read permitted progress batches"
ON public.progress_picture_batches FOR SELECT
TO authenticated
USING (public.can_read_client_account(client_id));

CREATE POLICY "Clients and Coach can read permitted progress pictures"
ON public.progress_pictures FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.progress_picture_batches batch
    WHERE batch.id = progress_pictures.batch_id
      AND public.can_read_client_account(batch.client_id)
  )
);

CREATE POLICY "Chat participants can read threads"
ON public.chat_threads FOR SELECT
TO authenticated
USING (public.can_access_chat_thread(id));

CREATE POLICY "Chat participants can read messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (public.can_access_chat_thread(thread_id));

CREATE POLICY "Chat participants can read read-state"
ON public.chat_reads FOR SELECT
TO authenticated
USING (public.can_access_chat_thread(thread_id));

-- Rebuild progress-picture mutation functions with authenticated ownership checks.
CREATE OR REPLACE FUNCTION public.create_progress_picture_batch(
  p_batch_id uuid,
  p_client_id uuid,
  p_capture_date date,
  p_timezone text,
  p_pictures jsonb,
  p_preview_picture_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  picture jsonb;
  picture_count integer;
  picture_id uuid;
  picture_path text;
BEGIN
  IF NOT public.owns_app_account(p_client_id) THEN
    RAISE EXCEPTION 'You cannot add progress pictures to this Client account';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_accounts
    WHERE id = p_client_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'Progress pictures can only belong to Client accounts';
  END IF;
  IF p_pictures IS NULL OR jsonb_typeof(p_pictures) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Pictures must be an array';
  END IF;
  picture_count := jsonb_array_length(p_pictures);
  IF picture_count < 1 OR picture_count > 6 THEN
    RAISE EXCEPTION 'A daily batch must contain between 1 and 6 pictures';
  END IF;
  IF p_preview_picture_id IS NULL THEN
    RAISE EXCEPTION 'A preview picture is required';
  END IF;

  INSERT INTO public.progress_picture_batches (
    id, client_id, capture_date, timezone, preview_picture_id
  ) VALUES (
    p_batch_id, p_client_id, p_capture_date, btrim(p_timezone), NULL
  );

  FOR picture IN SELECT value FROM jsonb_array_elements(p_pictures)
  LOOP
    picture_id := (picture->>'id')::uuid;
    picture_path := picture->>'storage_path';
    IF picture_path <> concat(p_client_id::text, '/', p_batch_id::text, '/', picture_id::text, '.webp') THEN
      RAISE EXCEPTION 'Invalid progress-picture storage path';
    END IF;

    INSERT INTO public.progress_pictures (
      id, batch_id, storage_path, width, height, byte_size, mime_type, display_order
    ) VALUES (
      picture_id,
      p_batch_id,
      picture_path,
      (picture->>'width')::integer,
      (picture->>'height')::integer,
      (picture->>'byte_size')::integer,
      'image/webp',
      (picture->>'display_order')::smallint
    );
  END LOOP;

  UPDATE public.progress_picture_batches
  SET preview_picture_id = p_preview_picture_id
  WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Progress-picture batch could not be created';
  END IF;
  RETURN p_batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_progress_pictures_to_batch(
  p_client_id uuid,
  p_batch_id uuid,
  p_pictures jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  picture jsonb;
  picture_count integer;
  existing_count integer;
  picture_id uuid;
  picture_path text;
  picture_order smallint;
BEGIN
  IF NOT public.owns_app_account(p_client_id) THEN
    RAISE EXCEPTION 'You cannot add progress pictures to this Client account';
  END IF;

  PERFORM 1
  FROM public.progress_picture_batches
  WHERE id = p_batch_id AND client_id = p_client_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Progress-picture batch was not found for this Client';
  END IF;
  IF p_pictures IS NULL OR jsonb_typeof(p_pictures) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Pictures must be an array';
  END IF;
  picture_count := jsonb_array_length(p_pictures);
  IF picture_count < 1 OR picture_count > 6 THEN
    RAISE EXCEPTION 'Append requires between 1 and 6 pictures';
  END IF;

  SELECT count(*)::integer INTO existing_count
  FROM public.progress_pictures
  WHERE batch_id = p_batch_id;
  IF existing_count + picture_count > 6 THEN
    RAISE EXCEPTION 'A daily batch cannot contain more than 6 pictures';
  END IF;

  FOR picture IN SELECT value FROM jsonb_array_elements(p_pictures)
  LOOP
    picture_id := (picture->>'id')::uuid;
    picture_path := picture->>'storage_path';
    picture_order := (picture->>'display_order')::smallint;
    IF picture_path <> concat(p_client_id::text, '/', p_batch_id::text, '/', picture_id::text, '.webp') THEN
      RAISE EXCEPTION 'Invalid progress-picture storage path';
    END IF;
    IF picture_order < existing_count OR picture_order >= existing_count + picture_count THEN
      RAISE EXCEPTION 'Invalid progress-picture display order';
    END IF;

    INSERT INTO public.progress_pictures (
      id, batch_id, storage_path, width, height, byte_size, mime_type, display_order
    ) VALUES (
      picture_id,
      p_batch_id,
      picture_path,
      (picture->>'width')::integer,
      (picture->>'height')::integer,
      (picture->>'byte_size')::integer,
      'image/webp',
      picture_order
    );
  END LOOP;
  RETURN p_batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_progress_picture_preview(
  p_client_id uuid,
  p_batch_id uuid,
  p_picture_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.owns_app_account(p_client_id) THEN
    RAISE EXCEPTION 'You cannot modify this Client account';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.progress_picture_batches batch
    JOIN public.progress_pictures picture ON picture.batch_id = batch.id
    WHERE batch.id = p_batch_id
      AND batch.client_id = p_client_id
      AND picture.id = p_picture_id
  ) THEN
    RAISE EXCEPTION 'Picture does not belong to this client batch';
  END IF;

  UPDATE public.progress_picture_batches
  SET preview_picture_id = p_picture_id
  WHERE id = p_batch_id AND client_id = p_client_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_progress_picture_storage_path(object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  client_id uuid;
  batch_id uuid;
  picture_file text;
BEGIN
  IF object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' THEN
    RETURN false;
  END IF;
  client_id := split_part(object_name, '/', 1)::uuid;
  batch_id := split_part(object_name, '/', 2)::uuid;
  picture_file := split_part(object_name, '/', 3);
  IF picture_file = '' OR batch_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.app_accounts account
    WHERE account.id = client_id
      AND account.role = 'client'
      AND public.can_read_client_account(account.id)
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.create_progress_picture_batch(uuid, uuid, date, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.append_progress_pictures_to_batch(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_progress_picture_preview(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_progress_picture_storage_path(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_progress_picture_batch(uuid, uuid, date, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_progress_pictures_to_batch(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_progress_picture_preview(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_progress_picture_storage_path(text) TO authenticated;

-- Rebuild chat RPCs so callers can act only as accounts owned by their Google identity.
CREATE OR REPLACE FUNCTION public.get_or_create_chat_thread(p_client_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  thread_id uuid;
  coach_id uuid;
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

  SELECT id INTO coach_id
  FROM public.app_accounts
  WHERE role = 'coach' AND is_preview = false
  LIMIT 1;
  IF coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach account was not found';
  END IF;

  SELECT id INTO thread_id
  FROM public.chat_threads
  WHERE client_id = p_client_id;
  IF thread_id IS NULL THEN
    INSERT INTO public.chat_threads (client_id, coach_id)
    VALUES (p_client_id, coach_id)
    ON CONFLICT (client_id) DO NOTHING
    RETURNING id INTO thread_id;
    IF thread_id IS NULL THEN
      SELECT id INTO thread_id
      FROM public.chat_threads
      WHERE client_id = p_client_id;
    END IF;
  END IF;

  INSERT INTO public.chat_reads (thread_id, account_id)
  VALUES (thread_id, p_client_id), (thread_id, coach_id)
  ON CONFLICT (thread_id, account_id) DO NOTHING;
  RETURN thread_id;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.mark_chat_read(
  p_account_id uuid,
  p_client_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  thread_id uuid;
BEGIN
  IF NOT public.owns_app_account(p_account_id) THEN
    RAISE EXCEPTION 'You cannot update read state for this account';
  END IF;
  thread_id := public.get_or_create_chat_thread(p_client_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_threads
    WHERE id = thread_id
      AND p_account_id IN (client_id, coach_id)
  ) THEN
    RAISE EXCEPTION 'Read state account is not a participant in this chat';
  END IF;

  INSERT INTO public.chat_reads (thread_id, account_id, last_read_at)
  VALUES (thread_id, p_account_id, now())
  ON CONFLICT (thread_id, account_id)
  DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_chat_unread_counts(p_account_id uuid)
RETURNS TABLE (client_id uuid, unread_messages bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    thread.client_id,
    count(message.id)::bigint AS unread_messages
  FROM public.chat_threads thread
  LEFT JOIN public.chat_reads read_state
    ON read_state.thread_id = thread.id
    AND read_state.account_id = p_account_id
  JOIN public.chat_messages message
    ON message.thread_id = thread.id
    AND message.sender_account_id <> p_account_id
    AND message.created_at > COALESCE(read_state.last_read_at, 'epoch'::timestamptz)
  WHERE public.owns_app_account(p_account_id)
    AND p_account_id IN (thread.client_id, thread.coach_id)
  GROUP BY thread.client_id;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_chat_thread(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_chat_message(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_chat_read(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_chat_unread_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_chat_thread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_unread_counts(uuid) TO authenticated;

CREATE POLICY "Authenticated users can read permitted progress media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'progress-pictures'
  AND public.is_progress_picture_storage_path(name)
);

CREATE POLICY "Authenticated users can read program covers"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'program-covers'
  AND auth.uid() IS NOT NULL
);
