import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { DEFAULT_LANG, LANG_STORAGE_KEY, LangCode, resolveLang } from "./config";
import en from "./locales/en";

export type Dict = Record<string, string>;

/** English is bundled (fallback + majority locale). Everything else is a lazy chunk. */
const loaders: Record<Exclude<LangCode, "en">, () => Promise<{ default: Dict }>> = {
  es: () => import("./locales/es"),
  pt: () => import("./locales/pt"),
  fil: () => import("./locales/fil"),
  hi: () => import("./locales/hi"),
  id: () => import("./locales/id"),
  fr: () => import("./locales/fr"),
  de: () => import("./locales/de"),
};

/**
 * Per-screen locale modules: src/i18n/screens/<screen>/<lang>.ts
 * Each file default-exports a Dict. English screen packs are bundled eagerly
 * (they are the fallback), other languages load lazily with the language.
 */
const enScreens = import.meta.glob<{ default: Dict }>("./screens/*/en.ts", { eager: true });
const langScreens = import.meta.glob<{ default: Dict }>("./screens/*/*.ts");

function enScreenDict(): Dict {
  let out: Dict = {};
  for (const mod of Object.values(enScreens)) out = { ...out, ...mod.default };
  return out;
}

async function langScreenDict(lang: LangCode): Promise<Dict> {
  const entries = Object.entries(langScreens).filter(([p]) => p.endsWith(`/${lang}.ts`));
  const mods = await Promise.all(
    entries.map(([, load]) => load().catch(() => ({ default: {} as Dict })))
  );
  let out: Dict = {};
  for (const mod of mods) out = { ...out, ...mod.default };
  return out;
}


/**
 * Content packs (verses, reflections, prayers, journeys, quiz…):
 * src/i18n/content/<domain>/<lang>.ts — no English packs, the source data in
 * src/data is the English original. These are big, so they load lazily AFTER
 * the UI dictionary and then notify listeners for a soft re-render.
 */
const contentPacks = import.meta.glob<{ default: Dict }>("./content/*/*.ts");

async function loadContentDict(lang: LangCode): Promise<Dict> {
  if (lang === "en") return {};
  // Matches "<domain>/<lang>.ts" and split packs "<domain>/<lang>-p2.ts".
  const entries = Object.entries(contentPacks).filter(([p]) => {
    const file = p.split("/").pop() ?? "";
    return file === `${lang}.ts` || file.startsWith(`${lang}-`);
  });
  const mods = await Promise.all(
    entries.map(([, load]) => load().catch(() => ({ default: {} as Dict })))
  );
  let out: Dict = {};
  for (const mod of mods) out = { ...out, ...mod.default };
  return out;
}

/** Full English dictionary: base file + every English screen pack. */
const EN_FULL: Dict = { ...en, ...enScreenDict() };

let activeLang: LangCode = DEFAULT_LANG;
let activeDict: Dict = EN_FULL;
let contentDict: Dict = {};
const listeners = new Set<() => void>();

/**
 * Translate localized *content* (Bible text, reflections, prayers…).
 * Returns undefined when there is no translation — callers keep the English
 * original in that case.
 */
export function tc(key: string): string | undefined {
  const v = contentDict[key];
  return v && v.length > 0 ? v : undefined;
}

let contentToken = 0;
function primeContent(lang: LangCode) {
  const token = ++contentToken;
  if (lang === "en") { contentDict = {}; listeners.forEach((fn) => fn()); return; }
  loadContentDict(lang)
    .then((d) => {
      if (token !== contentToken) return;
      contentDict = d;
      listeners.forEach((fn) => fn());
    })
    .catch(() => {/* keep English content */});
}


function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] === undefined || vars[k] === null ? "" : String(vars[k])
  );
}

/**
 * Translate. Falls back to English, then to the key's own default text.
 * Usage: t("today.greeting", { name }) or t("some.key", "Fallback copy")
 */
export function t(
  key: string,
  varsOrFallback?: Record<string, string | number> | string,
  maybeVars?: Record<string, string | number>
): string {
  const fallbackText = typeof varsOrFallback === "string" ? varsOrFallback : undefined;
  const vars = typeof varsOrFallback === "string" ? maybeVars : varsOrFallback;
  const raw = activeDict[key] ?? EN_FULL[key] ?? fallbackText ?? key;
  return interpolate(raw, vars);
}

export function getLang(): LangCode {
  return activeLang;
}

/**
 * Detect stored preference, else device language.
 * On Android the WebView's navigator.languages already mirrors the system
 * locale list, so no extra native plugin is needed.
 */
export async function detectLang(): Promise<LangCode> {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored) return resolveLang(stored);
  } catch {/* ignore */}
  if (typeof navigator !== "undefined") {
    const tags = [...(navigator.languages ?? []), navigator.language];
    for (const tag of tags) {
      const hit = resolveLang(tag);
      if (hit !== DEFAULT_LANG) return hit;
    }
  }
  return DEFAULT_LANG;
}


async function load(lang: LangCode): Promise<Dict> {
  if (lang === "en") return EN_FULL;
  try {
    const [mod, screens] = await Promise.all([loaders[lang](), langScreenDict(lang)]);
    // Merge over English so a missing key never shows a raw key.
    return { ...EN_FULL, ...mod.default, ...screens };
  } catch {
    return EN_FULL;
  }
}

/** Tags PostHog with the active language (lazy import: analytics is a chunk). */
function reportLang(lang: LangCode) {
  import("@/services/analytics")
    .then((m) => m.setLangContext(lang))
    .catch(() => {});
}

/** Call once before first render. Keeps English users at zero extra cost. */
export async function initI18n(): Promise<LangCode> {
  const lang = await detectLang();
  activeDict = await load(lang);
  activeLang = lang;
  primeContent(lang);
  try {
    document.documentElement.lang = lang;
  } catch {/* ignore */}
  reportLang(lang);
  listeners.forEach((fn) => fn());
  return lang;
}

export async function setLang(lang: LangCode) {
  activeDict = await load(lang);
  activeLang = lang;
  primeContent(lang);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  } catch {/* ignore */}
  reportLang(lang);
  listeners.forEach((fn) => fn());
}

const I18nContext = createContext(0);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const fn = () => setVersion((v) => v + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return <I18nContext.Provider value={version}>{children}</I18nContext.Provider>;
}

/** Re-renders the component whenever the language changes. */
export function useT() {
  const version = useContext(I18nContext);
  const lang = activeLang;
  const change = useCallback((l: LangCode) => setLang(l), []);
  return useMemo(
    () => ({ t, lang, setLang: change, version }),
    [lang, version, change]
  );
}
