CREATE TABLE public.bible_kjv (
  id integer PRIMARY KEY,
  book_index smallint NOT NULL,
  book text NOT NULL,
  chapter smallint NOT NULL,
  verse smallint NOT NULL,
  text text NOT NULL
);
CREATE INDEX bible_kjv_ref_idx ON public.bible_kjv (book_index, chapter, verse);
GRANT SELECT ON public.bible_kjv TO anon, authenticated;
GRANT ALL ON public.bible_kjv TO service_role;
ALTER TABLE public.bible_kjv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bible text is public" ON public.bible_kjv FOR SELECT TO anon, authenticated USING (true);