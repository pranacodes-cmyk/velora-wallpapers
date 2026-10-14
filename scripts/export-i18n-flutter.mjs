/**
 * Exports the web app's i18n dictionaries into flat JSON files the Flutter app
 * loads at runtime. Guarantees 1:1 string parity between web and Flutter.
 *
 * Run: bun scripts/export-i18n-flutter.mjs
 */
import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const I18N = path.join(ROOT, "src/i18n");
const OUT = path.join(ROOT, "flutter_app/assets/translations");

const LANGS = ["en", "es", "pt", "fil", "hi", "id", "fr", "de"];

/** Ids of the curated engraving verses (src/lib/personalCross.ts). */
const CROSS_VERSE_IDS = [
  "john-3-16", "phil-4-13", "psalm-23-1", "jer-29-11", "prov-3-5",
  "isa-41-10", "rom-8-28", "psalm-46-10", "matt-11-28", "john-14-6",
];

async function load(file) {
  try {
    const mod = await import(file);
    return mod.default ?? {};
  } catch {
    return {};
  }
}

async function dirs(p) {
  try {
    return (await readdir(p, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

async function files(p) {
  try {
    return (await readdir(p)).filter((f) => f.endsWith(".ts"));
  } catch {
    return [];
  }
}

/** Flutter does not currently show the old Chat onboarding slide.
 * Journeys onboarding keys must stay — the Journeys slide is back in the flow.
 */
const FLUTTER_DROP = /^onb\.chat\./;

/**
 * Key families the Flutter app never resolves (verified with a repo-wide scan of
 * `lib/**`): the retired Journeys catalogue — UI (`jn.`), day content (`j.`),
 * guides (`jg.`) and readings (`jr.`). 75 Days of Light (`ch.`/`chd.`) replaced
 * it, and these families were several MB of dead weight.
 *
 * NOTE: the daily prayer bodies (`p.`) and their closing declarations (`pd.`)
 * ARE kept — `ContentData.prayerForDate` localizes the Devotional prayer with
 * the same `enrichPrayer` logic the web app uses, so dropping them would force
 * every language back to English prayers.
 */
const FLUTTER_UNUSED = /^(jn\.|j\.|jg\.|jr\.)/;

function stripFlutterDrops(dict) {
  return Object.fromEntries(
    Object.entries(dict).filter(([k]) => !FLUTTER_DROP.test(k) && !FLUTTER_UNUSED.test(k)),
  );
}

async function dictFor(lang) {
  let out = {};
  out = { ...out, ...(await load(path.join(I18N, `locales/${lang}.ts`))) };
  for (const screen of await dirs(path.join(I18N, "screens"))) {
    out = { ...out, ...(await load(path.join(I18N, `screens/${screen}/${lang}.ts`))) };
  }
  for (const domain of await dirs(path.join(I18N, "content"))) {
    const dir = path.join(I18N, "content", domain);
    for (const f of await files(dir)) {
      if (f === `${lang}.ts` || f.startsWith(`${lang}-`)) {
        out = { ...out, ...(await load(path.join(dir, f))) };
      }
    }
  }
  // Engraved cross lines live in one multi-language module (`content/cross.ts`)
  // keyed by verse id — flatten them as `cross.<id>` so Flutter resolves the
  // exact same short line the web engraving uses.
  try {
    const cross = await import(path.join(I18N, "content/cross.ts"));
    for (const v of CROSS_VERSE_IDS) {
      const line = cross.crossLine?.(lang, v);
      if (line) out[`cross.${v}`] = line;
    }
  } catch {
    /* ignore */
  }
  // flat single-file content module (src/i18n/content.ts) is English source data
  return out;
}

const enDict = await dictFor("en");
await mkdir(OUT, { recursive: true });

for (const lang of LANGS) {
  const dict = lang === "en" ? enDict : { ...enDict, ...(await dictFor(lang)) };
  const kept = stripFlutterDrops(dict);
  const sorted = Object.fromEntries(Object.keys(kept).sort().map((k) => [k, kept[k]]));
  await writeFile(path.join(OUT, `${lang}.json`), JSON.stringify(sorted, null, 0));
  console.log(`${lang}.json — ${Object.keys(sorted).length} keys`);
}
