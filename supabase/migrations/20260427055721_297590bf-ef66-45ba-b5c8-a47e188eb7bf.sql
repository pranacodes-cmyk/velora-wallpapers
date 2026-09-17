
CREATE TYPE public.pending_asset_type AS ENUM ('static', 'live');
CREATE TYPE public.pending_asset_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.pending_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_type public.pending_asset_type NOT NULL,
  category_slug text NOT NULL,
  title text NOT NULL,
  image_url text NOT NULL,
  video_url text,
  prompt text,
  model text,
  status public.pending_asset_status NOT NULL DEFAULT 'pending',
  is_premium boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone
);

CREATE INDEX idx_pending_assets_status ON public.pending_assets(status);
CREATE INDEX idx_pending_assets_type ON public.pending_assets(asset_type);
CREATE INDEX idx_pending_assets_category ON public.pending_assets(category_slug);

ALTER TABLE public.pending_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pending assets"
ON public.pending_assets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Public read for /test page testing convenience (matches existing pattern of other tables)
CREATE POLICY "Anyone can view pending assets"
ON public.pending_assets
FOR SELECT
TO public
USING (true);
