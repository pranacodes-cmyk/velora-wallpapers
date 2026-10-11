-- Tighten existing admin policy on live_wallpapers to only target authenticated role
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.live_wallpapers'::regclass
      AND polname = 'Admins can manage live wallpapers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.live_wallpapers', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "Admins can manage live wallpapers"
ON public.live_wallpapers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Lock down reels storage bucket: admins-only writes/deletes
CREATE POLICY "Admins can upload reels"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reels' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reels"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'reels' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'reels' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reels"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'reels' AND public.has_role(auth.uid(), 'admin'));