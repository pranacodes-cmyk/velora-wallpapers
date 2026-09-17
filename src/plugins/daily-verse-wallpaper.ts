import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface PrefetchProgress {
  current: number;
  total: number;
  file: string;
  ok: boolean;
}

export interface PrefetchResult {
  success: boolean;
  downloaded: number;
  total: number;
  totalBytes: number;
  cacheDir?: string;
  single?: boolean;
}

export interface CacheStatus {
  ready: boolean;
  downloaded: number;
  total: number;
  totalBytes: number;
  lastSyncMs: number;
  ageDays: number;
}

export interface DailyVerseWallpaperPluginInterface {
  /**
   * Launches Android's native live wallpaper preview, pre-selected on our
   * Daily Verse service. User taps "Set wallpaper" → it's applied to home
   * + lock screen and auto-refreshes at midnight forever.
   */
  openPicker(): Promise<{ success: boolean; fallback?: boolean }>;

  /** Returns whether our DailyVerse service is the currently active wallpaper. */
  isActive(): Promise<{ active: boolean }>;

  /**
   * Download R2 backgrounds to internal storage so the live wallpaper service
   * renders fully offline. Emits "progress" events while running.
   * `single: true` downloads only today's background — used for free users
   * whose verse never auto-refreshes, so prefetching the full 20-image pack
   * would be wasteful bandwidth.
   */
  prefetchAssets(options?: { force?: boolean; single?: boolean }): Promise<PrefetchResult>;

  /** Inspect what is cached locally so JS can decide whether to refresh. */
  getCacheStatus(): Promise<CacheStatus>;

  /**
   * Mark today's verse as unlocked so the live wallpaper renders today's
   * verse and removes the gold "✦ NEW VERSE TODAY" badge from the lockscreen.
   * Call after a successful free wallpaper apply or when Pro activates.
   */
  markVerseUnlocked(): Promise<{ success: boolean }>;

  /**
   * Tell the live wallpaper service whether the user is Premium. Pro users
   * never see the stale badge — their verse auto-updates every midnight.
   */
  setPremium(options: { premium: boolean }): Promise<{ success: boolean }>;

  /**
   * Push a mood-pack verse list to the native live wallpaper so the lockscreen
   * cycles the user's selected 30 verses. Pass verses: [] to clear and return
   * to the default 365-day rotation.
   */
  setMoodPackVerses(options: {
    mood: string;
    verses: Array<{ text: string; reference: string }>;
  }): Promise<{ success: boolean }>;

  addListener(
    eventName: "progress",
    listener: (info: PrefetchProgress) => void
  ): Promise<PluginListenerHandle>;
}

const DailyVerseWallpaper = registerPlugin<DailyVerseWallpaperPluginInterface>(
  "DailyVerseWallpaperPlugin"
);

export default DailyVerseWallpaper;
