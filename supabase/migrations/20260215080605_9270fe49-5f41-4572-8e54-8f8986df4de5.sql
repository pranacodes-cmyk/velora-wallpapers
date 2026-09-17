
-- Create live_wallpapers table mirroring the wallpapers table structure
CREATE TABLE public.live_wallpapers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  video_url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'nature',
  is_premium BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_wallpapers ENABLE ROW LEVEL SECURITY;

-- Anyone can view live wallpapers
CREATE POLICY "Anyone can view live wallpapers"
ON public.live_wallpapers
FOR SELECT
USING (true);

-- Admins can manage live wallpapers
CREATE POLICY "Admins can manage live wallpapers"
ON public.live_wallpapers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
