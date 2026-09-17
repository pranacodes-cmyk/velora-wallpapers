import bgSunsetCrossAsset from "@/assets/parallax/scene-calvary-sunrise-truehd.jpg.asset.json";
import bgGoodShepherdAsset from "@/assets/parallax/scene-good-shepherd-hd.jpg.asset.json";
import bgSacredHeartAsset from "@/assets/parallax/scene-sacred-heart.jpg.asset.json";
import bgMoonlitWaterAsset from "@/assets/parallax/scene-moonlit-water-hd.jpg.asset.json";
import bgOliveTreeAsset from "@/assets/parallax/scene-olive-tree-hd.jpg.asset.json";
import bgChildrenMeadowAsset from "@/assets/parallax/scene-children-meadow-hd.jpg.asset.json";
import bgHeavensGatesAsset from "@/assets/parallax/scene-heavens-gates-hd.jpg.asset.json";
import bgHolyCrossAsset from "@/assets/parallax/scene-cross-bg.jpg.asset.json";
import bgSunsetCrossCardAsset from "@/assets/parallax/scene-calvary-sunrise-truehd-card.webp.asset.json";
import bgGoodShepherdCardAsset from "@/assets/parallax/scene-good-shepherd-hd-card.webp.asset.json";
import bgSacredHeartCardAsset from "@/assets/parallax/scene-sacred-heart-card.webp.asset.json";
import bgMoonlitWaterCardAsset from "@/assets/parallax/scene-moonlit-water-hd-card.webp.asset.json";
import bgOliveTreeCardAsset from "@/assets/parallax/scene-olive-tree-hd-card.webp.asset.json";
import bgChildrenMeadowCardAsset from "@/assets/parallax/scene-children-meadow-hd-card.webp.asset.json";
import bgHeavensGatesCardAsset from "@/assets/parallax/scene-heavens-gates-hd-card.webp.asset.json";
import bgHolyCrossCardAsset from "@/assets/parallax/scene-cross-bg-card.webp.asset.json";
import fgHolyCrossAsset from "@/assets/parallax/scene-cross-fg.png.asset.json";
import transparentFgAsset from "@/assets/parallax/parallax-transparent.png.asset.json";
import fgHolyCrossEsAsset from "@/assets/parallax/scene-cross-fg-es.png.asset.json";
import fgHolyCrossPtAsset from "@/assets/parallax/scene-cross-fg-pt.png.asset.json";
import fgHolyCrossFrAsset from "@/assets/parallax/scene-cross-fg-fr.png.asset.json";
import fgHolyCrossIdAsset from "@/assets/parallax/scene-cross-fg-id.png.asset.json";
import fgHolyCrossFilAsset from "@/assets/parallax/scene-cross-fg-fil.png.asset.json";
import fgHolyCrossHiAsset from "@/assets/parallax/scene-cross-fg-hi.png.asset.json";
import fgHolyCrossCardAsset from "@/assets/parallax/scene-cross-fg-card.webp.asset.json";
import fgHolyCrossEsCardAsset from "@/assets/parallax/scene-cross-fg-es-card.webp.asset.json";
import fgHolyCrossPtCardAsset from "@/assets/parallax/scene-cross-fg-pt-card.webp.asset.json";
import fgHolyCrossFrCardAsset from "@/assets/parallax/scene-cross-fg-fr-card.webp.asset.json";
import fgHolyCrossIdCardAsset from "@/assets/parallax/scene-cross-fg-id-card.webp.asset.json";
import fgHolyCrossFilCardAsset from "@/assets/parallax/scene-cross-fg-fil-card.webp.asset.json";
import fgHolyCrossHiCardAsset from "@/assets/parallax/scene-cross-fg-hi-card.webp.asset.json";
import { getLang } from "@/i18n";



export type ParallaxScene = {
  id: string;
  name: string;
  bg: string;   // asset URL (relative /__l5e/... path — resolved by <img>)
  /** Small optimised webp used for the home rail card / small previews. */
  bgCard: string;
  fg: string;
  variant: "full" | "bust";
  fgHeight: number;
  halo: string;
  wash: string;
  wrap: string;
  grade: string;
  /** When true, background + foreground pan together as one image
   *  (iOS-native lockscreen style). Best for rich full-frame scenes
   *  where the FG is part of a unified composition. */
  wholeMove?: boolean;
};

// Shared helper lives in @/utils/assetUrl — re-exported here for existing imports.
export { toAbsoluteAssetUrl } from "@/utils/assetUrl";
import { toAbsoluteAssetUrl } from "@/utils/assetUrl";

export const PARALLAX_SCENES: ParallaxScene[] = [
  {
    id: "holy-cross",
    name: "Holy Cross",
    bg: toAbsoluteAssetUrl(bgHolyCrossAsset.url),
    bgCard: toAbsoluteAssetUrl(bgHolyCrossCardAsset.url),
    fg: toAbsoluteAssetUrl(fgHolyCrossAsset.url),
    variant: "full",
    fgHeight: 88,
    halo:
      "radial-gradient(ellipse 55% 50% at 50% 45%, hsla(350, 100%, 55%, 0.75), hsla(0, 90%, 35%, 0.35) 45%, transparent 72%)",
    wash: "linear-gradient(180deg, hsla(350, 80%, 45%, 0.15), hsla(0, 60%, 8%, 0.35))",
    wrap: "radial-gradient(ellipse 70% 55% at 50% 40%, hsla(345, 100%, 65%, 0.5), transparent 65%)",
    grade:
      "radial-gradient(ellipse 130% 100% at 50% 45%, transparent 30%, hsla(0, 70%, 4%, 0.65) 100%)",
  },
  {
    id: "good-shepherd-dawn",
    name: "Good Shepherd",
    bg: toAbsoluteAssetUrl(bgGoodShepherdAsset.url),
    bgCard: toAbsoluteAssetUrl(bgGoodShepherdCardAsset.url),
    fg: toAbsoluteAssetUrl(transparentFgAsset.url),
    variant: "full",
    fgHeight: 0,
    wholeMove: true,
    halo:
      "radial-gradient(ellipse 55% 45% at 22% 42%, hsla(42, 100%, 68%, 0.32), hsla(35, 85%, 50%, 0.14) 48%, transparent 76%)",
    wash: "linear-gradient(180deg, hsla(45, 70%, 60%, 0.08), hsla(30, 45%, 12%, 0.22))",
    wrap: "radial-gradient(ellipse 68% 52% at 40% 45%, hsla(45, 100%, 72%, 0.24), transparent 70%)",
    grade:
      "radial-gradient(ellipse 130% 100% at 50% 55%, transparent 42%, hsla(25, 55%, 6%, 0.42) 100%)",
  },
  {
    id: "olive-tree-rest",
    name: "Olive Tree Rest",
    bg: toAbsoluteAssetUrl(bgOliveTreeAsset.url),
    bgCard: toAbsoluteAssetUrl(bgOliveTreeCardAsset.url),
    fg: toAbsoluteAssetUrl(transparentFgAsset.url),
    variant: "full",
    fgHeight: 0,
    wholeMove: true,
    halo:
      "radial-gradient(ellipse 55% 45% at 72% 52%, hsla(38, 100%, 68%, 0.30), hsla(30, 80%, 48%, 0.14) 50%, transparent 78%)",
    wash: "linear-gradient(180deg, hsla(42, 70%, 60%, 0.08), hsla(28, 45%, 12%, 0.24))",
    wrap: "radial-gradient(ellipse 66% 50% at 62% 50%, hsla(42, 100%, 72%, 0.20), transparent 72%)",
    grade:
      "radial-gradient(ellipse 130% 100% at 50% 55%, transparent 42%, hsla(25, 50%, 6%, 0.42) 100%)",
  },

  {
    id: "sacred-heart",
    name: "Sacred Heart",
    bg: toAbsoluteAssetUrl(bgSacredHeartAsset.url),
    bgCard: toAbsoluteAssetUrl(bgSacredHeartCardAsset.url),
    fg: toAbsoluteAssetUrl(transparentFgAsset.url),
    variant: "full",
    fgHeight: 0,
    wholeMove: true,
    halo:
      "radial-gradient(ellipse 50% 42% at 50% 45%, hsla(35, 100%, 62%, 0.38), hsla(10, 80%, 35%, 0.18) 48%, transparent 76%)",
    wash: "linear-gradient(180deg, hsla(30, 70%, 40%, 0.10), hsla(0, 45%, 5%, 0.34))",
    wrap: "radial-gradient(ellipse 62% 48% at 50% 46%, hsla(38, 100%, 66%, 0.26), transparent 70%)",
    grade:
      "radial-gradient(ellipse 130% 100% at 50% 52%, transparent 30%, hsla(0, 55%, 3%, 0.6) 100%)",
  },
  {
    id: "moonlit-water",
    name: "Moonlit Waters",
    bg: toAbsoluteAssetUrl(bgMoonlitWaterAsset.url),
    bgCard: toAbsoluteAssetUrl(bgMoonlitWaterCardAsset.url),
    fg: toAbsoluteAssetUrl(transparentFgAsset.url),
    variant: "full",
    fgHeight: 0,
    wholeMove: true,
    halo:
      "radial-gradient(ellipse 48% 40% at 50% 46%, hsla(45, 90%, 78%, 0.28), hsla(220, 60%, 40%, 0.16) 50%, transparent 78%)",
    wash: "linear-gradient(180deg, hsla(220, 60%, 30%, 0.12), hsla(225, 65%, 6%, 0.34))",
    wrap: "radial-gradient(ellipse 64% 48% at 50% 48%, hsla(45, 95%, 80%, 0.18), transparent 72%)",
    grade:
      "radial-gradient(ellipse 130% 100% at 50% 50%, transparent 36%, hsla(225, 60%, 4%, 0.55) 100%)",
  },
  {
    id: "calvary-sunrise",
    name: "Calvary Sunrise",
    bg: toAbsoluteAssetUrl(bgSunsetCrossAsset.url),
    bgCard: toAbsoluteAssetUrl(bgSunsetCrossCardAsset.url),
    // Whole-composition scene — background & foreground pan together.
    // fg is an invisible placeholder (fgHeight 0) so no cutout is needed.
    fg: toAbsoluteAssetUrl(transparentFgAsset.url),
    variant: "full",
    fgHeight: 0,
    wholeMove: true,
    // No color grading — the source photo is already final. Overlays neutralised.
    halo: "none",
    wash: "none",
    wrap: "none",
    grade: "none",
  },
  {
    id: "children-meadow",
    name: "Let Them Come",
    bg: toAbsoluteAssetUrl(bgChildrenMeadowAsset.url),
    bgCard: toAbsoluteAssetUrl(bgChildrenMeadowCardAsset.url),
    fg: toAbsoluteAssetUrl(transparentFgAsset.url),
    variant: "full",
    fgHeight: 0,
    wholeMove: true,
    halo:
      "radial-gradient(ellipse 52% 42% at 50% 52%, hsla(48, 100%, 78%, 0.26), hsla(90, 45%, 55%, 0.12) 50%, transparent 78%)",
    wash: "linear-gradient(180deg, hsla(200, 60%, 70%, 0.06), hsla(100, 35%, 18%, 0.22))",
    wrap: "radial-gradient(ellipse 66% 50% at 50% 52%, hsla(48, 100%, 82%, 0.18), transparent 72%)",
    grade:
      "radial-gradient(ellipse 130% 100% at 50% 55%, transparent 44%, hsla(100, 35%, 8%, 0.38) 100%)",
  },
  {
    id: "heavens-gates",
    name: "Gates of Glory",
    bg: toAbsoluteAssetUrl(bgHeavensGatesAsset.url),
    bgCard: toAbsoluteAssetUrl(bgHeavensGatesCardAsset.url),
    fg: toAbsoluteAssetUrl(transparentFgAsset.url),
    variant: "full",
    fgHeight: 0,
    wholeMove: true,
    halo:
      "radial-gradient(ellipse 52% 44% at 50% 42%, hsla(46, 100%, 76%, 0.34), hsla(40, 90%, 60%, 0.16) 50%, transparent 78%)",
    wash: "linear-gradient(180deg, hsla(46, 80%, 72%, 0.10), hsla(40, 45%, 22%, 0.20))",
    wrap: "radial-gradient(ellipse 66% 50% at 50% 44%, hsla(46, 100%, 80%, 0.24), transparent 72%)",
    grade:
      "radial-gradient(ellipse 130% 100% at 50% 55%, transparent 46%, hsla(40, 45%, 14%, 0.34) 100%)",
  },
];



/** Localized foreground art (the neon lettering on the Holy Cross is baked
 *  into the artwork, so each language has its own rendered PNG). */
const HOLY_CROSS_FG_BY_LANG: Record<string, string> = {
  es: fgHolyCrossEsAsset.url,
  pt: fgHolyCrossPtAsset.url,
  "pt-BR": fgHolyCrossPtAsset.url,
  fr: fgHolyCrossFrAsset.url,
  id: fgHolyCrossIdAsset.url,
  fil: fgHolyCrossFilAsset.url,
  hi: fgHolyCrossHiAsset.url,
};

const HOLY_CROSS_FG_CARD_BY_LANG: Record<string, string> = {
  es: fgHolyCrossEsCardAsset.url,
  pt: fgHolyCrossPtCardAsset.url,
  "pt-BR": fgHolyCrossPtCardAsset.url,
  fr: fgHolyCrossFrCardAsset.url,
  id: fgHolyCrossIdCardAsset.url,
  fil: fgHolyCrossFilCardAsset.url,
  hi: fgHolyCrossHiCardAsset.url,
};

/** Small optimised foreground used by the home rail card / small previews. */
export function sceneFgCard(scene: ParallaxScene, lang?: string): string {
  if (scene.id !== "holy-cross") return scene.fg;
  const l = lang ?? getLang();
  return toAbsoluteAssetUrl(HOLY_CROSS_FG_CARD_BY_LANG[l] ?? fgHolyCrossCardAsset.url);
}

/** Foreground URL for a scene in the user's current language. */
export function sceneFg(scene: ParallaxScene, lang?: string): string {
  if (scene.id !== "holy-cross") return scene.fg;
  const l = lang ?? getLang();
  const url = HOLY_CROSS_FG_BY_LANG[l];
  return url ? toAbsoluteAssetUrl(url) : scene.fg;
}

export function getSceneById(id: string): ParallaxScene | undefined {
  return PARALLAX_SCENES.find((s) => s.id === id);
}
