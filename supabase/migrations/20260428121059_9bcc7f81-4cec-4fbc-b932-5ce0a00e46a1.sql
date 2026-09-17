ALTER TABLE public.wallpapers
  ADD COLUMN IF NOT EXISTS upscale_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS upscale_attempted_at timestamptz;

CREATE INDEX IF NOT EXISTS wallpapers_upscale_status_idx
  ON public.wallpapers (upscale_status);