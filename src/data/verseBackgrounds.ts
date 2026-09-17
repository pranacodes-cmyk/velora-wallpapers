// Daily-verse backgrounds — 20 R2-hosted images used by the native live
// wallpaper auto-rotation. Do NOT renumber or remove bg-01..bg-20.
//
// We intentionally do NOT ship a manual background-picker feature: the
// rotation runs automatically each day so the experience stays effortless.

export type VerseMood = "peace" | "hope" | "strength" | "worship" | "majesty";

export interface VerseBackground {
  id: string;
  url: string;
  /** Lightweight preview URL for small card mockups. */
  cardUrl: string;
  label: string;
}

const BG_VERSION = "20260523-r2-bg20";
const R2_PROXY_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy/daily-verse/backgrounds`;
const r2 = (i: number) =>
  `${R2_PROXY_BASE}/bg-${String(i).padStart(2, "0")}.jpg?v=${BG_VERSION}`;

const backgrounds: VerseBackground[] = Array.from({ length: 20 }, (_, idx) => {
  const n = idx + 1;
  return {
    id: `bg-${String(n).padStart(2, "0")}`,
    url: r2(n),
    // Use the existing compressed R2 image for cards too. Unlike preview-only
    // /__l5e paths, this endpoint is directly reachable from Android WebViews.
    cardUrl: r2(n),
    label: `Background ${n}`,
  };
});

export const ALL_VERSE_BACKGROUNDS = backgrounds;

export const MOOD_ORDER: VerseMood[] = ["peace", "hope", "strength", "worship", "majesty"];

export const MOOD_META: Record<VerseMood, { label: string; emoji: string; tagline: string }> = {
  peace:    { label: "Peace",    emoji: "🕊️", tagline: "Be still" },
  hope:     { label: "Hope",     emoji: "✨", tagline: "Light ahead" },
  strength: { label: "Strength", emoji: "⛰️", tagline: "Stand firm" },
  worship:  { label: "Worship",  emoji: "🙏", tagline: "Lift Him up" },
  majesty:  { label: "Majesty",  emoji: "👑", tagline: "King of Kings" },
};

/** Default bg-of-day from the 20 backgrounds (cycles by day-of-year). */
export function getDefaultBackgroundForToday(date?: Date): VerseBackground {
  const d = date || new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return backgrounds[dayOfYear % backgrounds.length];
}
