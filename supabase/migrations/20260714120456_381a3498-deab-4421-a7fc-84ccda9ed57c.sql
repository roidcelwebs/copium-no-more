-- Prototype passwordless account picker and shared coach data.
-- This is intentionally not production authentication: anyone can select any account.

CREATE TABLE public.app_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  username text NOT NULL CHECK (
    username = lower(username)
    AND username ~ '^[a-z0-9_]{3,30}$'
  ),
  role text NOT NULL CHECK (role IN ('coach', 'client')),
  assigned_program_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX app_accounts_username_ci_unique
  ON public.app_accounts (lower(username));

CREATE UNIQUE INDEX app_accounts_single_coach
  ON public.app_accounts (role)
  WHERE role = 'coach';

CREATE TABLE public.app_state (
  id text PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  programs jsonb NOT NULL DEFAULT '[]'::jsonb,
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  workouts jsonb NOT NULL DEFAULT '[]'::jsonb,
  weight_units jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_state (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_accounts_set_updated_at
BEFORE UPDATE ON public.app_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER app_accounts_identity_immutable
BEFORE UPDATE ON public.app_accounts
FOR EACH ROW EXECUTE FUNCTION public.prevent_account_identity_change();

CREATE TRIGGER app_state_set_updated_at
BEFORE UPDATE ON public.app_state
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.app_accounts TO anon, authenticated;
GRANT ALL ON public.app_accounts TO service_role;
GRANT SELECT, UPDATE ON public.app_state TO anon, authenticated;
GRANT ALL ON public.app_state TO service_role;

ALTER TABLE public.app_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

-- Intentional prototype policies. There is no real authentication yet, so these
-- rows are public. Replace these policies when real auth is introduced.
CREATE POLICY "Prototype accounts are publicly readable"
ON public.app_accounts FOR SELECT
USING (true);

CREATE POLICY "Prototype accounts are publicly creatable"
ON public.app_accounts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Prototype client assignments are publicly editable"
ON public.app_accounts FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Prototype app state is publicly readable"
ON public.app_state FOR SELECT
USING (true);

CREATE POLICY "Prototype app state is publicly editable"
ON public.app_state FOR UPDATE
USING (true)
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_state;