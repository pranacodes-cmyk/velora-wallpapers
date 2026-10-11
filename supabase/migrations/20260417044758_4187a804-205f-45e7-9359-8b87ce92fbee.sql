-- ============================================================
-- Remap live_wallpapers.category and wallpapers.category_id
-- using filename + title keyword rules.
-- Order matters: most specific first → fallback last.
-- ============================================================

-- Helper: resolve a target slug from a filename + title string.
-- Returns NULL when nothing matches (caller decides fallback).
CREATE OR REPLACE FUNCTION pg_temp.classify_slug(haystack text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  h text := lower(coalesce(haystack, ''));
BEGIN
  -- Most specific liturgical themes first
  IF h ~ '(easter|resurrect|risen|empty[-_ ]?tomb)' THEN RETURN 'easter'; END IF;
  IF h ~ '(ascension|ascend|heavenward)' THEN RETURN 'easter'; END IF;
  IF h ~ '(crucif|good[-_ ]?friday|crown[-_ ]?of[-_ ]?thorns|thorn|gethsemane|calvary[-_ ]?storm)' THEN RETURN 'good-friday'; END IF;

  -- Specific iconography
  IF h ~ '(archangel|angel|guardian[-_ ]?angel|seraph|cherub)' THEN RETURN 'angels'; END IF;
  IF h ~ '(holy[-_ ]?spirit|pentecost|trinity|holy[-_ ]?dove|spirit[-_ ]?dove)' THEN RETURN 'holy-spirit'; END IF;
  IF h ~ '\bdove\b' THEN RETURN 'holy-spirit'; END IF;

  -- Bible / scripture
  IF h ~ '(psalm|harp[-_ ]?psalm)' THEN RETURN 'psalms'; END IF;
  IF h ~ '(bible|scripture|scroll|verse|john[-_ ][0-9]|isaiah|joshua|matthew|luke|mark|romans|jeremiah|proverbs|genesis|revelation|gospel)' THEN RETURN 'bible-verses'; END IF;

  -- Buildings
  IF h ~ '(cathedral|chapel|church|sanctuary|monastery|basilica)' THEN RETURN 'church'; END IF;

  -- Cross (after good-friday so crucifixion goes there first)
  IF h ~ '(\bcross\b|calvary|crucifix|three[-_ ]?crosses)' THEN RETURN 'cross'; END IF;

  -- Prayer
  IF h ~ '(prayer|praying|pray\b|rosary|kneel|kneeling|hands[-_ ]?folded|silent[-_ ]?prayer)' THEN RETURN 'prayer'; END IF;

  -- Worship
  IF h ~ '(worship|praise|hymn|lion[-_ ]?of[-_ ]?judah|judah|king[-_ ]?of[-_ ]?kings|throne)' THEN RETURN 'worship'; END IF;

  -- Nature / creation
  IF h ~ '(garden|nature|field|wheat|forest|lake|river|ocean|mountain|sunset|sunrise|dawn|dusk|creation|beach|valley|cliff|water[-_ ]?walk|walk[-_ ]?water)' THEN RETURN 'nature-creation'; END IF;

  -- Quotes
  IF h ~ '(god[-_ ]?says|godsays|god[-_ ]?is|god[-_ ]?quote)' THEN RETURN 'god-quotes'; END IF;
  IF h ~ '(christian[-_ ]?quote|christian[-_ ]?words|faith[-_ ]?quote|bible[-_ ]?words|words[-_ ]?of)' THEN RETURN 'christian-quotes'; END IF;

  -- Aesthetic catch-all signals (only if very obviously stylistic)
  IF h ~ '(aesthetic|vision[-_ ]?board|minimal|neon|sacred[-_ ]?light|dark[-_ ]?theme)' THEN RETURN 'aesthetic-christian'; END IF;

  RETURN NULL;
END;
$$;

-- ============================================================
-- 1) Remap LIVE wallpapers
-- haystack = video_url filename + title
-- ============================================================
WITH src AS (
  SELECT
    id,
    coalesce(regexp_replace(video_url, '^.*/', ''), '') || ' ' || coalesce(title, '') AS hay
  FROM public.live_wallpapers
)
UPDATE public.live_wallpapers lw
SET category = coalesce(pg_temp.classify_slug(src.hay), 'jesus-christ')
FROM src
WHERE lw.id = src.id;

-- ============================================================
-- 2) Remap STATIC wallpapers (uses category_id FK)
-- haystack = image_url filename + title
-- ============================================================
WITH src AS (
  SELECT
    w.id,
    coalesce(regexp_replace(w.image_url, '^.*/', ''), '') || ' ' || coalesce(w.title, '') AS hay
  FROM public.wallpapers w
),
classified AS (
  SELECT
    src.id,
    coalesce(pg_temp.classify_slug(src.hay), 'aesthetic-christian') AS slug
  FROM src
)
UPDATE public.wallpapers w
SET category_id = c.id
FROM classified cl
JOIN public.categories c ON c.slug = cl.slug
WHERE w.id = cl.id;
