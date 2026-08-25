CREATE POLICY "Prototype program covers can be read"
ON storage.objects FOR SELECT
USING (bucket_id = 'program-covers');