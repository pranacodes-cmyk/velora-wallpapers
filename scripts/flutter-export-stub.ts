/**
 * Bun preload for `scripts/export-data-flutter.mjs`.
 *
 * The data modules in `src/data/*` import the browser i18n runtime, which uses
 * Vite-only `import.meta.glob`. For a pure data export we only need the English
 * source of truth, so the i18n runtime and content helpers are replaced with
 * identity helpers that always fall back to the English original.
 */
import { plugin } from "bun";

const stub = `
export const tc = () => null;
export const t = (k) => k;
export const getLang = () => "en";
export const useT = () => ({ t: (k) => k, lang: "en", version: 0 });
export const localizeVerse = (v) => v;
export const localizeVerseText = (v) => v.text;
export const localizeRef = (r) => r;
export const localizeReflection = (_r, r) => r;
export const localizeQuizQuestion = (q) => q;
export const localizeJourney = (j) => j;
export const localizeJourneyDay = (_id, d) => d;
export default {};
`;

plugin({
  name: "flutter-export-i18n-stub",
  setup(build) {
    build.onLoad(
      { filter: /src[/\\]i18n[/\\](index\.tsx|content\.ts)$/ },
      () => ({ contents: stub, loader: "js" }),
    );
  },
});
