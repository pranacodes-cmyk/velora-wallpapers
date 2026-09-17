-- Retire all pre-existing live-update bundles. Their version numbers sit on a
-- different number line (1.0.x / 1.1.x) than the store build's version name
-- (1.0.NNNN), which could hand a brand-new install older app code.
UPDATE public.ota_bundles SET active = false WHERE active = true;