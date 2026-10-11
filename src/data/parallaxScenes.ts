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
