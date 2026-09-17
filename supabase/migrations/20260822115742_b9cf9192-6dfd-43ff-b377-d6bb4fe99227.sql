UPDATE public.ota_bundles
SET version = '1.0.1158',
    min_native_version = '1.0.1149',
    notes = 'Matches store build 1.0.1158 JS (rating prompt queueing, overlay coordination, journey narration gating). Served to older natives 1.0.1149+; no-op for 1.0.1158 devices.'
WHERE id = '52fe21b1-07d1-4324-8604-800a149011ed';

UPDATE public.ota_bundles SET active = false WHERE channel = 'production' AND id <> '52fe21b1-07d1-4324-8604-800a149011ed';