-- Progress-picture metadata and private object-storage foundation.
-- IMPORTANT: this project intentionally remains a passwordless public prototype.
-- These policies do not provide real user privacy because there is no authenticated identity.

CREATE TABLE public.progress_picture_batches (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  capture_date date NOT NULL,
  timezone text NOT NULL CHECK (char_length(btrim(timezone)) BETWEEN 1 AND 80),
  preview_picture_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, capture_date)
);

CREATE TABLE public.progress_pictures (
  id uuid PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.progress_picture_batches(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE CHECK (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 10000),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 10000),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 3145728),
  mime_type text NOT NULL DEFAULT 'image/webp' CHECK (mime_type = 'image/webp'),
  display_order smallint NOT NULL CHECK (display_order BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, display_order)
);

ALTER TABLE public.progress_picture_batches
  ADD CONSTRAINT progress_picture_batches_preview_picture_fkey
  FOREIGN KEY (preview_picture_id)
  REFERENCES public.progress_pictures(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX progress_picture_batches_client_date_idx
  ON public.progress_picture_batches (client_id, capture_date DESC);
CREATE INDEX progress_pictures_batch_order_idx
  ON public.progress_pictures (batch_id, display_order);

CREATE OR REPLACE FUNCTION public.ensure_progress_picture_batch_client()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_accounts
    WHERE id = NEW.client_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'Progress pictures can only belong to Client accounts';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_progress_picture_preview_belongs_to_batch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.preview_picture_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.progress_pictures
    WHERE id = NEW.preview_picture_id AND batch_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Preview picture must belong to its batch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER progress_picture_batches_require_client
BEFORE INSERT OR UPDATE OF client_id ON public.progress_picture_batches
FOR EACH ROW EXECUTE FUNCTION public.ensure_progress_picture_batch_client();

CREATE TRIGGER progress_picture_batches_validate_preview
BEFORE INSERT OR UPDATE OF preview_picture_id ON public.progress_picture_batches
FOR EACH ROW EXECUTE FUNCTION public.ensure_progress_picture_preview_belongs_to_batch();

CREATE TRIGGER progress_picture_batches_set_updated_at
BEFORE UPDATE ON public.progress_picture_batches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
SET search_path = public
AS $$
DECLARE
  picture jsonb;
  picture_count integer;
  picture_id uuid;
  picture_path text;
BEGIN
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
      id,
      batch_id,
      storage_path,
      width,
      height,
      byte_size,
      mime_type,
      display_order
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

CREATE OR REPLACE FUNCTION public.set_progress_picture_preview(
  p_client_id uuid,
  p_batch_id uuid,
  p_picture_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
SET search_path = public
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
    SELECT 1 FROM public.app_accounts
    WHERE id = client_id AND role = 'client'
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.create_progress_picture_batch(uuid, uuid, date, text, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_progress_picture_preview(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_progress_picture_storage_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_progress_picture_batch(uuid, uuid, date, text, jsonb, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_progress_picture_preview(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_progress_picture_storage_path(text) TO anon, authenticated;

GRANT SELECT ON public.progress_picture_batches TO anon, authenticated;
GRANT SELECT ON public.progress_pictures TO anon, authenticated;
GRANT ALL ON public.progress_picture_batches TO service_role;
GRANT ALL ON public.progress_pictures TO service_role;

ALTER TABLE public.progress_picture_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_pictures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prototype progress-picture batches are publicly readable"
ON public.progress_picture_batches FOR SELECT
USING (true);

CREATE POLICY "Prototype progress pictures are publicly readable"
ON public.progress_pictures FOR SELECT
USING (true);

CREATE POLICY "Prototype progress pictures can be read"
ON storage.objects FOR SELECT
USING (bucket_id = 'progress-pictures');

CREATE POLICY "Prototype progress pictures can be uploaded"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'progress-pictures'
  AND public.is_progress_picture_storage_path(name)
);

CREATE POLICY "Prototype failed progress-picture uploads can be removed"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'progress-pictures'
  AND public.is_progress_picture_storage_path(name)
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.progress_picture_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.progress_pictures;