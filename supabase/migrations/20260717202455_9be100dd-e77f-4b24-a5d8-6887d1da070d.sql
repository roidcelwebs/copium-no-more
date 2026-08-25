CREATE OR REPLACE FUNCTION public.append_progress_pictures_to_batch(
  p_client_id uuid,
  p_batch_id uuid,
  p_pictures jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  picture jsonb;
  picture_count integer;
  existing_count integer;
  picture_id uuid;
  picture_path text;
  picture_order smallint;
BEGIN
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
      picture_order
    );
  END LOOP;

  RETURN p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_progress_pictures_to_batch(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_progress_pictures_to_batch(uuid, uuid, jsonb) TO anon, authenticated;