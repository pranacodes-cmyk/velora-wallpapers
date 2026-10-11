CREATE TABLE public.ota_bundles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version text NOT NULL,
  platform text NOT NULL DEFAULT 'android' CHECK (platform IN ('android','ios')),
  channel text NOT NULL DEFAULT 'production',
  url text NOT NULL,
  checksum text NOT NULL,
  native_version text,
  min_native_version text,
  rollout integer NOT NULL DEFAULT 100 CHECK (rollout >= 0 AND rollout <= 100),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (platform, channel, version)
);

CREATE INDEX ota_bundles_lookup_idx ON public.ota_bundles (platform, channel, active, created_at DESC);

GRANT ALL ON public.ota_bundles TO service_role;

ALTER TABLE public.ota_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage OTA bundles"
ON public.ota_bundles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ota_bundles TO authenticated;