import { registerPlugin } from "@capacitor/core";

export interface WallpaperSetterPlugin {
  /**
   * Set a wallpaper from a URL.
   * @param options.url - The image URL to download and set
   * @param options.target - "home" | "lock" | "both"
   */
  setWallpaper(options: { url: string; target: "home" | "lock" | "both" }): Promise<{ success: boolean }>;
}

const WallpaperSetter = registerPlugin<WallpaperSetterPlugin>("WallpaperSetter");

export default WallpaperSetter;
