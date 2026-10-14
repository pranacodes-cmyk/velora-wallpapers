ALTER TABLE public.challenge_members ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false;
GRANT ALL ON TABLE public.challenge_members TO service_role;