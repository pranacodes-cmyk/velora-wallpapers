-- 75 Days of Light: private device identities, family/friend circles and cheers.
-- All access goes through the challenge-circle backend function (service role);
-- the app never reads these tables directly.

CREATE TABLE public.challenge_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_hash text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Friend',
  avatar text NOT NULL DEFAULT '🕊️',
  lang text NOT NULL DEFAULT 'en',
  mode text NOT NULL DEFAULT 'grace',
  started_on date,
  completed_days integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  last_lit_on date,
  today_on date,
  today_done smallint NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_members_name_len CHECK (char_length(display_name) BETWEEN 1 AND 24),
  CONSTRAINT challenge_members_mode CHECK (mode IN ('grace', 'covenant')),
  CONSTRAINT challenge_members_days CHECK (completed_days BETWEEN 0 AND 75),
  CONSTRAINT challenge_members_today CHECK (today_done BETWEEN 0 AND 4)
);

GRANT ALL ON public.challenge_members TO service_role;
ALTER TABLE public.challenge_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.challenge_circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🪔',
  created_by uuid NOT NULL REFERENCES public.challenge_members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_circles_name_len CHECK (char_length(name) BETWEEN 1 AND 32),
  CONSTRAINT challenge_circles_code_len CHECK (char_length(code) = 6)
);

GRANT ALL ON public.challenge_circles TO service_role;
ALTER TABLE public.challenge_circles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.challenge_circle_members (
  circle_id uuid NOT NULL REFERENCES public.challenge_circles(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.challenge_members(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, member_id)
);

GRANT ALL ON public.challenge_circle_members TO service_role;
ALTER TABLE public.challenge_circle_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX challenge_circle_members_member_idx ON public.challenge_circle_members(member_id);

CREATE TABLE public.challenge_cheers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.challenge_circles(id) ON DELETE CASCADE,
  from_member uuid NOT NULL REFERENCES public.challenge_members(id) ON DELETE CASCADE,
  to_member uuid NOT NULL REFERENCES public.challenge_members(id) ON DELETE CASCADE,
  kind text NOT NULL,
  sent_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  CONSTRAINT challenge_cheers_kind CHECK (kind IN ('cheer', 'pray', 'nudge')),
  CONSTRAINT challenge_cheers_not_self CHECK (from_member <> to_member),
  CONSTRAINT challenge_cheers_once_daily UNIQUE (from_member, to_member, kind, sent_on)
);

GRANT ALL ON public.challenge_cheers TO service_role;
ALTER TABLE public.challenge_cheers ENABLE ROW LEVEL SECURITY;
CREATE INDEX challenge_cheers_to_idx ON public.challenge_cheers(to_member, seen_at);