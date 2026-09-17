// Supported app languages. Chosen from Christian-population + Play Store reality
// + our real traffic mix (Philippines-heavy, then US/UK/CA/AU, LATAM, Brazil, India, Indonesia).
export const LANGUAGES = [
  { code: "en", label: "English", native: "English", flag: "🇺🇸" },
  { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Portuguese", native: "Português (BR)", flag: "🇧🇷" },
  { code: "fil", label: "Filipino", native: "Filipino", flag: "🇵🇭" },
  { code: "hi", label: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { code: "id", label: "Indonesian", native: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "fr", label: "French", native: "Français", flag: "🇫🇷" },
  { code: "de", label: "German", native: "Deutsch", flag: "🇩🇪" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANG: LangCode = "en";
export const LANG_STORAGE_KEY = "app-lang";

/** Map any BCP-47 / device tag onto a supported language. */
export function resolveLang(tag?: string | null): LangCode {
  if (!tag) return DEFAULT_LANG;
  const lower = tag.toLowerCase();
  const base = lower.split(/[-_]/)[0];
  // Philippines device tags: fil, tl, tgl
  if (base === "tl" || base === "tgl" || base === "fil") return "fil";
  if (base === "pt") return "pt";
  const hit = LANGUAGES.find((l) => l.code === base);
  return hit ? (hit.code as LangCode) : DEFAULT_LANG;
}
