CREATE POLICY "Anyone can read OTA content files"
ON storage.objects FOR SELECT
USING (bucket_id = 'ota');