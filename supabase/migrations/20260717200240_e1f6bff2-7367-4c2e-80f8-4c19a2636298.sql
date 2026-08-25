-- Realtime Coach/Client text chat for the intentionally passwordless prototype.
-- These public read policies are not private authentication: anyone can impersonate an account.

CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  last_message_body text,
  last_message_sender_id uuid REFERENCES public.app_accounts(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (client_id <> coach_id),
  CHECK (last_message_body IS NULL OR char_length(last_message_body) BETWEEN 1 AND 2000)
);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_account_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_reads (
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT 'epoch'::timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, account_id)
);

CREATE INDEX chat_messages_thread_created_idx
  ON public.chat_messages (thread_id, created_at ASC);
CREATE INDEX chat_messages_sender_created_idx
  ON public.chat_messages (sender_account_id, created_at DESC);
CREATE INDEX chat_threads_last_message_idx
  ON public.chat_threads (last_message_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.ensure_chat_thread_roles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_accounts
    WHERE id = NEW.client_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'Chat client must be a Client account';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_accounts
    WHERE id = NEW.coach_id AND role = 'coach'
  ) THEN
    RAISE EXCEPTION 'Chat coach must be the Coach account';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_chat_message_sender()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_threads
    WHERE id = NEW.thread_id
      AND NEW.sender_account_id IN (client_id, coach_id)
  ) THEN
    RAISE EXCEPTION 'Message sender is not a participant in this chat';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_chat_read_participant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_threads
    WHERE id = NEW.thread_id
      AND NEW.account_id IN (client_id, coach_id)
  ) THEN
    RAISE EXCEPTION 'Read state account is not a participant in this chat';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_chat_thread_from_message()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_threads
  SET
    last_message_body = NEW.body,
    last_message_sender_id = NEW.sender_account_id,
    last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER chat_threads_require_roles
BEFORE INSERT OR UPDATE OF client_id, coach_id ON public.chat_threads
FOR EACH ROW EXECUTE FUNCTION public.ensure_chat_thread_roles();

CREATE TRIGGER chat_threads_set_updated_at
BEFORE UPDATE ON public.chat_threads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER chat_messages_require_participant
BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.ensure_chat_message_sender();

CREATE TRIGGER chat_messages_update_thread
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.update_chat_thread_from_message();

CREATE TRIGGER chat_reads_require_participant
BEFORE INSERT OR UPDATE OF account_id, thread_id ON public.chat_reads
FOR EACH ROW EXECUTE FUNCTION public.ensure_chat_read_participant();

CREATE TRIGGER chat_reads_set_updated_at
BEFORE UPDATE ON public.chat_reads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.get_or_create_chat_thread(p_client_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_id uuid;
  coach_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_accounts
    WHERE id = p_client_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'Client account was not found';
  END IF;

  SELECT id INTO coach_id
  FROM public.app_accounts
  WHERE role = 'coach'
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
SET search_path = public
AS $$
DECLARE
  target_thread_id uuid;
BEGIN
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
SET search_path = public
AS $$
DECLARE
  thread_id uuid;
BEGIN
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
SET search_path = public
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
  WHERE p_account_id IN (thread.client_id, thread.coach_id)
  GROUP BY thread.client_id;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_chat_thread(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_chat_message(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_chat_read(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_chat_unread_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_chat_thread(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_read(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_unread_counts(uuid) TO anon, authenticated;

GRANT SELECT ON public.chat_threads TO anon, authenticated;
GRANT SELECT ON public.chat_messages TO anon, authenticated;
GRANT SELECT ON public.chat_reads TO anon, authenticated;
GRANT ALL ON public.chat_threads TO service_role;
GRANT ALL ON public.chat_messages TO service_role;
GRANT ALL ON public.chat_reads TO service_role;

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prototype chat threads are publicly readable"
ON public.chat_threads FOR SELECT USING (true);

CREATE POLICY "Prototype chat messages are publicly readable"
ON public.chat_messages FOR SELECT USING (true);

CREATE POLICY "Prototype chat reads are publicly readable"
ON public.chat_reads FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reads;