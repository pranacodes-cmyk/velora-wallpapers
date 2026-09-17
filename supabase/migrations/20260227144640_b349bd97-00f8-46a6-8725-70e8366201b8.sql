-- Allow anyone to update is_premium for testing (forced admin mode)
CREATE POLICY "Allow premium toggle for testing"
  ON public.wallpapers FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow premium toggle for testing"
  ON public.live_wallpapers FOR UPDATE
  USING (true)
  WITH CHECK (true);