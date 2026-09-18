/**
 * Exports the web app's English source data (365 verses, 365 prayers, the quiz
 * bank, journeys, per-verse reflections and the 20 verse backgrounds) into JSON
 * assets the Flutter app loads at runtime.
 *
 * Translated strings are NOT duplicated here — they already live in
 * `flutter_app/assets/translations/<lang>.json` under the same content keys the
 * web app uses (`v.<ref>`, `r.<ref>`, `rf.<ref>.m/.a`, `q.<id>.*`, `j.<id>.*`),
 * so Flutter resolves exactly the same text the web app does.
 *
 * Run: bun scripts/export-data-flutter.mjs
 */
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "flutter_app/assets/data");

// The data modules import the browser i18n runtime (Vite-only
// `import.meta.glob`). For a data export we only want the English source, so we
// copy them to a temp dir with those imports stripped and identity stubs added.
const SOURCES = [
  "dailyVerses",
  "quizQuestions",
  "quizQuestionsExtra",
  "quizQuestionsMega",
  "journeys",
  "verseReflections",
  "versePacksData",
  "verseMoodPacks",
];

const STUB = [
  "const tc = () => null;",
  "const t = (k) => k;",
  "const getLang = () => 'en';",
  "const localizeVerse = (v) => v;",
  "const localizeReflection = (_r, r) => r;",
  "const localizeQuizQuestion = (q) => q;",
  "const localizeJourney = (j) => j;",
  "const localizeJourneyDay = (_id, d) => d;",
  "",
].join("\n");

const tmp = await mkdtemp(path.join(tmpdir(), "prayly-export-"));
for (const name of SOURCES) {
  let src = await readFile(path.join(ROOT, "src/data", `${name}.ts`), "utf8");
  src = src.replace(/^import[^;]*?from\s+"@\/i18n[^"]*";\s*$/gm, "");
  src = src.replace(/from\s+"@\/data\//g, 'from "./');
  await writeFile(path.join(tmp, `${name}.ts`), STUB + src);
}

await mkdir(OUT, { recursive: true });
const write = async (name, data) => {
  await writeFile(path.join(OUT, name), JSON.stringify(data));
  console.log(`✓ ${name}`);
};
const load = (name) => import(path.join(tmp, `${name}.ts`));

// ---- verses + prayers (indexed by day-of-year, 1..366) ----------------------
const verseMod = await load("dailyVerses");
const verses = [];
const prayers = [];
for (let day = 1; day <= 366; day++) {
  const d = new Date(2025, 0, day); // 2025 is non-leap → day-of-year === day
  const v = verseMod.getDailyVerse(d);
  verses.push({ text: v.text, reference: v.reference });
  prayers.push(verseMod.getDailyPrayer(d));
}
await write("verses.json", verses);
await write("prayers.json", prayers);

// ---- quiz bank --------------------------------------------------------------
await write("quiz_questions.json", (await load("quizQuestions")).quizQuestions);

// ---- journeys ---------------------------------------------------------------
await write("journeys.json", (await load("journeys")).JOURNEYS);

// ---- per-verse reflections --------------------------------------------------
await write(
  "verse_reflections.json",
  (await load("verseReflections")).VERSE_REFLECTIONS,
);

// ---- verse backgrounds (same R2 image-proxy URLs as the web app) ------------
const SUPABASE_URL = "https://jbwhlogvldhsnxtpxwih.supabase.co";
const BG_VERSION = "20260523-r2-bg20";
await write(
  "verse_backgrounds.json",
  Array.from({ length: 20 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    const url = `${SUPABASE_URL}/functions/v1/image-proxy/daily-verse/backgrounds/bg-${n}.jpg?v=${BG_VERSION}`;
    return { id: `bg-${n}`, url, cardUrl: url, label: `Background ${i + 1}` };
  }),
);

// ---- verse packs (situation + mood) ------------------------------------------
{
  const MOOD_ORDER = ["peace", "hope", "strength", "worship", "majesty"];
  const MOOD_META = {
    peace:    { label: "Peace",    emoji: "\ud83d\udd4a\ufe0f", tagline: "Be still" },
    hope:     { label: "Hope",     emoji: "\u2728", tagline: "Light ahead" },
    strength: { label: "Strength", emoji: "\u26f0\ufe0f", tagline: "Stand firm" },
    worship:  { label: "Worship",  emoji: "\ud83d\ude4f", tagline: "Lift Him up" },
    majesty:  { label: "Majesty",  emoji: "\ud83d\udc51", tagline: "King of Kings" },
  };

  const { SITUATION_PACKS } = await load("versePacksData");
  const { getMoodPackVerses } = await load("verseMoodPacks");

  const situationPacks = SITUATION_PACKS.map((p) => ({
    id: p.id,
    label: p.label,
    emoji: p.emoji,
    tagline: p.tagline,
    group: "situation",
    verses: p.verses,
  }));

  const moodPacks = MOOD_ORDER.map((m) => ({
    id: m,
    label: MOOD_META[m].label,
    emoji: MOOD_META[m].emoji,
    tagline: MOOD_META[m].tagline,
    group: "mood",
    verses: getMoodPackVerses(m),
  }));

  await write("verse_packs.json", [...situationPacks, ...moodPacks]);
}

// ---- parallax scenes (3D live wallpaper rail + preview) ---------------------
// The TS module imports `.asset.json` pointers plus the browser i18n runtime;
// rewrite those to absolute paths / stubs so it evaluates outside Vite.
{
  let src = await readFile(path.join(ROOT, "src/data/parallaxScenes.ts"), "utf8");
  src = src.replace(/^import[^;]*?from\s+"@\/i18n[^"]*";\s*$/gm, "");
  src = src.replace(/^export \{ toAbsoluteAssetUrl \}[^;]*;\s*$/gm, "");
  src = src.replace(/^import \{ toAbsoluteAssetUrl \}[^;]*;\s*$/gm, "");
  src = src.replace(/"@\/assets\//g, `"${path.join(ROOT, "src/assets")}/`);
  src =
    [
      "const getLang = () => 'en';",
      'const PUBLIC_ORIGIN = "https://velora-wallpapers.lovable.app";',
      "const toAbsoluteAssetUrl = (p) => (!p ? '' : /^https?:\\/\\//.test(p) ? p : new URL(p, PUBLIC_ORIGIN).href);",
      "",
    ].join("\n") + src;
  await writeFile(path.join(tmp, "parallaxScenes.ts"), src);

  const px = await load("parallaxScenes");
  const LANGS = ["en", "es", "pt", "fil", "hi", "id", "fr", "de"];
  await write(
    "parallax_scenes.json",
    px.PARALLAX_SCENES.map((s) => ({
      ...s,
      wholeMove: s.wholeMove === true,
      fgByLang: Object.fromEntries(LANGS.map((l) => [l, px.sceneFg(s, l)])),
      fgCardByLang: Object.fromEntries(LANGS.map((l) => [l, px.sceneFgCard(s, l)])),
    })),
  );
}
