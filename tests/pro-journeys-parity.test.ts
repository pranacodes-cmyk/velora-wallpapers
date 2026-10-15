import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, expect, it } from "bun:test";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), "utf8");
const LANGS = ["en", "hi", "es", "pt", "fil", "id", "fr", "de"];

/** id → { days, practice, passages } parsed from the web data file. */
function webJourneys() {
  const src = source("src/data/proJourneys.ts");
  const out: Record<string, { days: number; practice: string; passages: string[] }> = {};
  const re = /id: "(\w+)", days: (\d+), emoji: "[^"]+", practice: "(\w+)"[\s\S]*?passages: \[([\s\S]*?)\]/g;
  for (const m of src.matchAll(re)) {
    out[m[1]] = {
      days: Number(m[2]),
      practice: m[3],
      passages: [...m[4].matchAll(/p\(([^)]*)\)/g)].map((x) => x[1].replace(/\s+/g, "")),
    };
  }
  return out;
}

function flutterJourneys() {
  const src = source("flutter_app/lib/core/services/pro_journeys.dart");
  const out: Record<string, { days: number; practice: string; passages: string[] }> = {};
  const re = /id: '(\w+)', days: (\d+), emoji: '[^']+', practice: PracticeKind\.(\w+),[\s\S]*?passages: \[([\s\S]*?)\]/g;
  for (const m of src.matchAll(re)) {
    out[m[1]] = {
      days: Number(m[2]),
      practice: m[3],
      passages: [...m[4].matchAll(/Passage\(([^)]*)\)/g)].map((x) => x[1].replace(/\s+/g, "")),
    };
  }
  return out;
}

// Source contracts only; native rendering requires an approved device build.
describe("Pro Journeys web/Flutter parity", () => {
  it("defines the same four journeys, lengths, practices and passages", () => {
    const web = webJourneys();
    const app = flutterJourneys();
    expect(Object.keys(web)).toEqual(["identity", "peace", "freedom", "prayer"]);
    expect(Object.keys(app)).toEqual(Object.keys(web));
    for (const id of Object.keys(web)) {
      expect(app[id].days).toBe(web[id].days);
      expect(app[id].practice).toBe(web[id].practice);
      expect(app[id].passages.length).toBe(web[id].days);
      const norm = (s: string) => s.replace(/B\./g, "_B.");
      expect(app[id].passages).toEqual(web[id].passages.map(norm));
    }
  });

  it("shares one storage key and schema across builds", () => {
    expect(source("src/services/proJourneys.ts")).toContain('PRO_JOURNEYS_KEY = "prayly_pro_journeys_v1"');
    const dart = source("flutter_app/lib/core/services/pro_journeys.dart");
    expect(dart).toContain("kProJourneysKey = 'prayly_pro_journeys_v1'");
    for (const field of ["'journeys'", "'finished'", "'freedom'", "'prayers'", "'checkins'", "'sos'", "'answered'"]) {
      expect(dart).toContain(field);
    }
  });

  it("ships every day's copy in all eight exported languages", () => {
    const web = webJourneys();
    for (const lang of LANGS) {
      const dict = JSON.parse(source(`flutter_app/assets/translations/${lang}.json`)) as Record<string, string>;
      const own = Object.fromEntries([...source(`src/i18n/screens/projourneys/${lang}.ts`).matchAll(/"(pj\.[^"]+)":\s*("(?:[^"\\]|\\.)*")/g)].map((m) => [m[1], JSON.parse(m[2])]));
      for (const [id, j] of Object.entries(web)) {
        const practiceKey = j.practice === "declare" ? "dec" : j.practice === "battle" ? "pr" : j.practice === "intercede" ? "pp" : null;
        for (let d = 1; d <= j.days; d++) {
          const fields = ["t", "w", "m", "y", "context", "teaching", "reflect", "guide", "exercise", ...(practiceKey ? [practiceKey] : ["in", "out"])];
          for (const f of fields) {
            const v = dict[`pj.${id}.${d}.${f}`];
            expect(typeof v === "string" && v.trim().length > 0, `${lang} pj.${id}.${d}.${f}`).toBe(true);
            expect(own[`pj.${id}.${d}.${f}`], `${lang} own translation pj.${id}.${d}.${f}`).toBe(v);
          }
        }
      }
    }
  });

  it("only uses translation keys that exist in English", () => {
    const en = JSON.parse(source("flutter_app/assets/translations/en.json")) as Record<string, string>;
    const dir = new URL("flutter_app/lib/screens/projourney/", root);
    const files = readdirSync(dir).filter((f) => f.endsWith(".dart")).map((f) => `flutter_app/lib/screens/projourney/${f}`);
    files.push("flutter_app/lib/core/services/pro_journeys.dart");
    const missing: string[] = [];
    for (const f of files) {
      for (const m of source(f).matchAll(/t\('(pj\.[\w.]+)'/g)) {
        if (!(m[1] in en)) missing.push(`${f}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("reveals study inside sessions and preserves old completion IDs", () => {
    const web = source("src/pages/ProJourneyDay.tsx");
    const dart = source("flutter_app/lib/screens/projourney/pro_journey_day_screen.dart");
    expect(web).toContain('["read", ...STEPS]');
    expect(dart).toContain("['read', 'word', 'practice', 'mission']");
    expect(web).toContain("<ChapterReading");
    expect(dart).toContain("ChapterReading(passage:");
    expect(source("src/pages/ProJourney.tsx")).not.toContain("plan.title");
    expect(source("flutter_app/lib/screens/projourney/pro_journey_screen.dart")).not.toContain("plan.title");
    expect(source("src/services/proJourneyStudy.ts")).toContain('"prayly_pro_journey_study_v2"');
    expect(source("flutter_app/lib/core/services/pro_journey_study.dart")).toContain("'prayly_pro_journey_study_v2'");
  });

  it("contains substantial distinct teaching and valid complete bundled chapters", () => {
    const en = JSON.parse(source("flutter_app/assets/translations/en.json")) as Record<string, string>;
    const bookIds: Record<string, number> = { matt: 39, mark: 40, luke: 41, john: 42, rom: 44, cor1: 45, cor2: 46, gal: 47, eph: 48, phil: 49, col: 50, thes1: 51, tim1: 53, tim2: 54, titus: 55, heb: 57, jas: 58, pet1: 59, pet2: 60, john1: 61, john3: 63 };
    for (const [id, j] of Object.entries(webJourneys())) {
      const unique = new Set<string>();
      j.passages.forEach((ref, i) => {
        const k = `pj.${id}.${i + 1}`;
        const teaching = en[`${k}.teaching`];
        expect(teaching.split(/\s+/).length).toBeGreaterThanOrEqual(175);
        expect(teaching.split("\n\n").length).toBe(3);
        expect(en[`${k}.guide`].split("\n").length).toBe(3);
        unique.add(teaching);
        const [book, chapter] = ref.replace("B.", "").split(",");
        for (const lang of LANGS) {
          const edition = JSON.parse(source(`public/bible/${lang}/index.json`));
          const file = edition.books.findIndex((b: { canonicalId: number }) => b.canonicalId === bookIds[book]);
          expect(file, `${lang} ${ref}`).toBeGreaterThanOrEqual(0);
          expect(Number(chapter)).toBeLessThanOrEqual(edition.books[file].chapters);
          expect(existsSync(new URL(`public/bible/${lang}/${file}.json.gz`, root))).toBe(true);
        }
      });
      expect(unique.size).toBe(j.days);
    }
  });

  it("bundles the four covers and mounts the shelf on the Journey tab", () => {
    for (const id of ["identity", "peace", "freedom", "prayer"]) {
      expect(existsSync(new URL(`flutter_app/assets/images/projourney/${id}.webp`, root))).toBe(true);
      expect(existsSync(new URL(`src/assets/projourney/${id}.webp`, root))).toBe(true);
    }
    expect(source("flutter_app/pubspec.yaml")).toContain("- assets/images/projourney/");
    const hub = source("flutter_app/lib/screens/challenge/challenge_screen.dart");
    expect(hub).toContain("ProJourneysSection(isPremium: isPremium)");
    expect(hub).not.toContain("ProChallenges(");
    expect(source("src/pages/Challenge.tsx")).toContain("<ProJourneysSection isPremium={isPremium} />");
  });

  it("clears Pro Journey progress with Delete my data", () => {
    expect(source("flutter_app/lib/screens/settings/settings_screen.dart")).toContain("ProJourneyStore.reload();");
    expect(source("src/pages/Settings.tsx")).toContain("reloadProJourneys();");
    expect(source("src/pages/Settings.tsx")).toContain("localStorage.clear();");
    expect(source("flutter_app/lib/screens/settings/settings_screen.dart")).toContain("Prefs.clearExcept(const {'cw-theme'})");
  });

  it("matches Hindi canonical books without renumbering saved reader files", () => {
    const index = JSON.parse(source("public/bible/hi/index.json"));
    expect(index).toEqual(JSON.parse(source("flutter_app/assets/bible/hi/index.json")));
    expect(index.books[43].canonicalId).toBe(44);
    expect(index.books[63].canonicalId).toBe(43);
    expect(index.books[59].canonicalId).toBe(61);
    expect(new Set(index.books.map((b: { canonicalId: number }) => b.canonicalId)).size).toBe(66);
    expect(source("scripts/prepare-bible-data.cjs")).toContain("canonicalUsfm.indexOf(bookCode)");
  });
});
