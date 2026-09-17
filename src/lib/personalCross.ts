// Personalized 3D Cross — local storage for user's name + chosen verse.
// Kept device-local (no auth needed) so first-time flow is friction-free.
// If the user hasn't explicitly personalized the cross yet, we fall back to
// the name they entered in onboarding (`cw_user_name`) so the engraving
// appears automatically the moment they land in-app.

import { getLang } from "@/i18n";
import { crossLine } from "@/i18n/content/cross";
import { localizeRef } from "@/i18n/content";

const NAME_KEY = "prayly.personalCross.name";
const VERSE_KEY = "prayly.personalCross.verseId";
const ONBOARDING_NAME_KEY = "cw_user_name";
const ONBOARDING_EVENT = "cw-user-profile-changed";
const EVENT = "prayly.personalCross.changed";


export type PersonalVerse = {
  id: string;
  text: string;
  reference: string;
};

/** Curated short, powerful verses that read beautifully engraved on the cross. */
export const PERSONAL_VERSES: PersonalVerse[] = [
  { id: "john-3-16", text: "For God so loved the world.", reference: "John 3:16" },
  { id: "phil-4-13", text: "I can do all things through Christ.", reference: "Philippians 4:13" },
  { id: "psalm-23-1", text: "The Lord is my shepherd.", reference: "Psalm 23:1" },
  { id: "jer-29-11", text: "Plans to prosper you, not to harm you.", reference: "Jeremiah 29:11" },
  { id: "prov-3-5", text: "Trust in the Lord with all your heart.", reference: "Proverbs 3:5" },
  { id: "isa-41-10", text: "Fear not, for I am with you.", reference: "Isaiah 41:10" },
  { id: "rom-8-28", text: "All things work together for good.", reference: "Romans 8:28" },
  { id: "psalm-46-10", text: "Be still, and know that I am God.", reference: "Psalm 46:10" },
  { id: "matt-11-28", text: "Come to me, and I will give you rest.", reference: "Matthew 11:28" },
  { id: "john-14-6", text: "I am the way, the truth, and the life.", reference: "John 14:6" },
];

/** Localized copy of an engraved verse (short line + translated reference). */
export function localizeCrossVerse(v: PersonalVerse): PersonalVerse {
  const lang = getLang();
  return {
    ...v,
    text: crossLine(lang, v.id) ?? v.text,
    reference: localizeRef(v.reference),
  };
}

/** The curated verse list in the user's current language. */
export function getPersonalVerses(): PersonalVerse[] {
  return PERSONAL_VERSES.map(localizeCrossVerse);
}

export function getPersonalName(): string {
  try {
    const explicit = (localStorage.getItem(NAME_KEY) || "").trim();
    if (explicit) return explicit.slice(0, 22);
    // Fallback: auto-adopt the onboarding name so the cross is personalized
    // out of the box without a second "type your name" step.
    const onboarding = (localStorage.getItem(ONBOARDING_NAME_KEY) || "").trim();
    return onboarding.slice(0, 22);
  } catch { return ""; }
}


export function getPersonalVerse(): PersonalVerse {
  try {
    const id = localStorage.getItem(VERSE_KEY);
    const found = PERSONAL_VERSES.find((v) => v.id === id) || PERSONAL_VERSES[0];
    return localizeCrossVerse(found);
  } catch { return localizeCrossVerse(PERSONAL_VERSES[0]); }
}

export function setPersonal(name: string, verseId: string) {
  try {
    const clean = name.trim().slice(0, 22); // hard cap so it engraves cleanly
    localStorage.setItem(NAME_KEY, clean);
    localStorage.setItem(VERSE_KEY, verseId);
    window.dispatchEvent(new Event(EVENT));
  } catch { /* noop */ }
}

export function isPersonalized(): boolean {
  return getPersonalName().length > 0;
}

export const PERSONAL_CROSS_EVENT = EVENT;

// Bridge onboarding-name changes → personal-cross change event so any
// component listening to PERSONAL_CROSS_EVENT re-renders the moment the
// user finishes typing their name in onboarding.
if (typeof window !== "undefined") {
  try {
    window.addEventListener(ONBOARDING_EVENT, () => {
      window.dispatchEvent(new Event(EVENT));
    });
  } catch { /* noop */ }
}


/* ────────────────────────── Glow colour ──────────────────────────
 * Drives the god-rays, halo and dust tint in both the in-app preview
 * and the native GLES live wallpaper (passed through as `tintColor`).
 */

const GLOW_KEY = "prayly.personalCross.glow";

export type GlowChoice = { id: string; name: string; hex: string };

export const GLOW_COLORS: GlowChoice[] = [
  { id: "gold", name: "Royal Gold", hex: "#FFB74D" },
  { id: "dawn", name: "Dawn Amber", hex: "#FF7A29" },
  { id: "crimson", name: "Sacred Crimson", hex: "#FF4D5E" },
  { id: "heaven", name: "Heaven Blue", hex: "#6FA8FF" },
  { id: "olive", name: "Olive Peace", hex: "#8FD98A" },
  { id: "pearl", name: "Pearl White", hex: "#FFF3DC" },
];

export function getGlowColor(): GlowChoice {
  try {
    const id = localStorage.getItem(GLOW_KEY);
    return GLOW_COLORS.find((g) => g.id === id) || GLOW_COLORS[0];
  } catch {
    return GLOW_COLORS[0];
  }
}

export function setGlowColor(id: string) {
  try {
    localStorage.setItem(GLOW_KEY, id);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* noop */
  }
}
