CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  program_id text,
  workout_id text NOT NULL,
  workout_name text NOT NULL CHECK (char_length(btrim(workout_name)) BETWEEN 1 AND 80),
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 0),
  completed_sets integer NOT NULL CHECK (completed_sets >= 0),
  total_sets integer NOT NULL CHECK (total_sets >= 0 AND completed_sets <= total_sets),
  total_reps integer NOT NULL CHECK (total_reps >= 0),
  volume_by_unit jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(volume_by_unit) = 'object'),
  session_data jsonb NOT NULL CHECK (jsonb_typeof(session_data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (started_at <= completed_at)
);

CREATE INDEX workout_sessions_client_completed_idx
  ON public.workout_sessions (client_id, completed_at DESC);

CREATE OR REPLACE FUNCTION public.ensure_workout_session_client()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.app_accounts
    WHERE id = NEW.client_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'Workout sessions can only belong to Client accounts';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER workout_sessions_require_client
BEFORE INSERT ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.ensure_workout_session_client();

GRANT SELECT, INSERT ON public.workout_sessions TO anon, authenticated;
GRANT ALL ON public.workout_sessions TO service_role;

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prototype workout sessions are publicly readable"
ON public.workout_sessions FOR SELECT
USING (true);

CREATE POLICY "Prototype workout sessions are publicly creatable"
ON public.workout_sessions FOR INSERT
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_sessions;