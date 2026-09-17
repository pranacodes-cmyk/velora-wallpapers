import { Capacitor, registerPlugin } from "@capacitor/core";
import { toAbsoluteAssetUrl, sceneFg, type ParallaxScene } from "@/data/parallaxScenes";
import { getGlowColor, getPersonalName, getPersonalVerse } from "@/lib/personalCross";


export interface ParallaxWallpaperPlugin {
  setParallaxWallpaper(opts: {
    sceneId: string;
    bgUrl: string;
    fgUrl: string;
    wholeMove?: boolean;
    forceRefresh?: boolean;
    personalName?: string;
    verseText?: string;
    verseReference?: string;
    /** Glow / god-ray / dust colour as "#RRGGBB". */
    tintColor?: string;
  }): Promise<{ success: boolean; applied: boolean; sceneId: string }>;
  isActive(): Promise<{ active: boolean; sceneId: string | null }>;
  isCached(opts: { sceneId: string }): Promise<{ cached: boolean }>;
  /**
   * If our ParallaxLiveWallpaperService is currently the active system
   * wallpaper, remove it and let Android fall back to the default. Used
   * when the user loses Pro so we don't keep serving a paid wallpaper.
   * No-op if a different (third-party) wallpaper is active — verified
   * server-side via WallpaperManager.getWallpaperInfo().
   */
  clearIfActive(): Promise<{ cleared: boolean; reason?: string }>;
}

const Native = registerPlugin<ParallaxWallpaperPlugin>("ParallaxWallpaperPlugin");

export const isNativeParallaxWallpaperSupported = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

export async function applyParallaxWallpaper(scene: ParallaxScene) {
  if (!isNativeParallaxWallpaperSupported()) {
    throw new Error("Parallax live wallpaper requires the Android app.");
  }
  const name = getPersonalName();
  const verse = getPersonalVerse();
  return Native.setParallaxWallpaper({
    sceneId: scene.id,
    bgUrl: toAbsoluteAssetUrl(scene.bg),
    fgUrl: toAbsoluteAssetUrl(sceneFg(scene)),
    wholeMove: !!scene.wholeMove,
    // Always re-download so an updated cross asset (e.g. pedestal removed)
    // replaces any previously cached copy on the device.
    forceRefresh: true,
    personalName: name || "",
    verseText: verse?.text || "",
    verseReference: verse?.reference || "",
    tintColor: getGlowColor().hex,
  });
}

export default Native;
