// Daily-verse backgrounds — 20 R2-hosted images used by the native live
// wallpaper auto-rotation. Do NOT renumber or remove bg-01..bg-20.
//
// We intentionally do NOT ship a manual background-picker feature: the
// rotation runs automatically each day so the experience stays effortless.

import { toAbsoluteAssetUrl } from "@/utils/assetUrl";
import card01 from "@/assets/verse-bg-card/bg-01-card.webp.asset.json";
import card02 from "@/assets/verse-bg-card/bg-02-card.webp.asset.json";
import card03 from "@/assets/verse-bg-card/bg-03-card.webp.asset.json";
import card04 from "@/assets/verse-bg-card/bg-04-card.webp.asset.json";
import card05 from "@/assets/verse-bg-card/bg-05-card.webp.asset.json";
import card06 from "@/assets/verse-bg-card/bg-06-card.webp.asset.json";
import card07 from "@/assets/verse-bg-card/bg-07-card.webp.asset.json";
import card08 from "@/assets/verse-bg-card/bg-08-card.webp.asset.json";
import card09 from "@/assets/verse-bg-card/bg-09-card.webp.asset.json";
import card10 from "@/assets/verse-bg-card/bg-10-card.webp.asset.json";
import card11 from "@/assets/verse-bg-card/bg-11-card.webp.asset.json";
import card12 from "@/assets/verse-bg-card/bg-12-card.webp.asset.json";
import card13 from "@/assets/verse-bg-card/bg-13-card.webp.asset.json";
import card14 from "@/assets/verse-bg-card/bg-14-card.webp.asset.json";
import card15 from "@/assets/verse-bg-card/bg-15-card.webp.asset.json";
import card16 from "@/assets/verse-bg-card/bg-16-card.webp.asset.json";
import card17 from "@/assets/verse-bg-card/bg-17-card.webp.asset.json";
import card18 from "@/assets/verse-bg-card/bg-18-card.webp.asset.json";
import card19 from "@/assets/verse-bg-card/bg-19-card.webp.asset.json";
import card20 from "@/assets/verse-bg-card/bg-20-card.webp.asset.json";

// Small (480w webp) card-size previews for the home mockups — full-size
// bg-XX.jpg is only fetched when the real wallpaper is rendered/set.
const CARD_URLS: string[] = [
  card01.url,
  card02.url,
  card03.url,
  card04.url,
  card05.url,
  card06.url,
  card07.url,
  card08.url,
  card09.url,
  card10.url,
  card11.url,
  card12.url,
  card13.url,
  card14.url,
  card15.url,
  card16.url,
  card17.url,
  card18.url,
  card19.url,
  card20.url,
];

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
    // Native WebViews serve from https://localhost, which cannot resolve the
    // relative /__l5e/ asset path — always use an absolute CDN URL here.
    cardUrl: toAbsoluteAssetUrl(CARD_URLS[idx]),
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
