import { registerPlugin } from "@capacitor/core";

export type LiveWallpaperScaleMode =
  | "auto"
  | "center_crop"
  | "fit_center"
  | "fit_width"
  | "fit_height";

export interface WallpaperProgressEvent {
  phase: "downloading" | "applying" | "verifying";
  progress: number; // 0-100
}

export interface WallpaperLogEvent {
  stage: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface LiveWallpaperPluginInterface {
  /**
   * Download a video from URL, cache locally, then launch the Android
   * live wallpaper picker. If already cached, opens picker instantly.
   *
   * @param options.videoUrl - Full R2 cloud URL to the MP4 file
   * @param options.videoId  - Unique ID for caching (e.g. "doom-sorcery-power")
   */
  setLiveWallpaper(options: {
    videoUrl: string;
    videoId: string;
    forceRefresh?: boolean;
    /** Expected video width — used for manual crop when MediaPlayer reports wrong dimensions */
    videoWidth?: number;
    /** Expected video height — used for manual crop when MediaPlayer reports wrong dimensions */
    videoHeight?: number;
  }): Promise<{
    success: boolean;
    applied: boolean;
    videoId: string;
    serviceActive?: boolean;
    serviceActiveByManager?: boolean;
    serviceActiveByEngine?: boolean;
    activeVideoId?: string;
    scaleMode?: LiveWallpaperScaleMode;
    effectiveScaleMode?: LiveWallpaperScaleMode | null;
    lastEvent?: string | null;
    lastError?: string | null;
  }>;

  /**
   * Check if a live wallpaper is currently active and which video.
   */
  isActive(): Promise<{ active: boolean; videoId: string | null }>;

  /**
   * Check if a specific video is already cached locally.
   */
  isCached(options: {
    videoId: string;
  }): Promise<{ cached: boolean; sizeMB: number }>;

  /**
   * Update runtime native render strategy (no native code edits required).
   */
  setRenderConfig(options: {
    useSetDisplay?: boolean;
    enableFixedSizeFallback?: boolean;
    enableFixedSizeInPreview?: boolean;
    enableSizeFromLayout?: boolean;
    previewInitDelayMs?: number;
    scaleMode?: LiveWallpaperScaleMode;
  }): Promise<{
    useSetDisplay: boolean;
    enableFixedSizeFallback: boolean;
    enableFixedSizeInPreview: boolean;
    enableSizeFromLayout: boolean;
    previewInitDelayMs: number;
    scaleMode: LiveWallpaperScaleMode;
  }>;

  getRenderConfig(): Promise<{
    useSetDisplay: boolean;
    enableFixedSizeFallback: boolean;
    enableFixedSizeInPreview: boolean;
    enableSizeFromLayout: boolean;
    previewInitDelayMs: number;
    scaleMode: LiveWallpaperScaleMode;
  }>;

  setScaleMode(options: {
    mode: LiveWallpaperScaleMode;
  }): Promise<{ scaleMode: LiveWallpaperScaleMode }>;

  getScaleMode(): Promise<{ scaleMode: LiveWallpaperScaleMode }>;

  /**
   * Read native debug state (surface/video/scaling/dimensions) from Android side.
   */
  getDebugState(): Promise<{
    activeVideoId: string | null;
    activeVideoPath: string | null;
    pendingVideoId: string | null;
    pendingVideoPath: string | null;
    desiredMinWidth: number;
    desiredMinHeight: number;
    realScreenWidth: number;
    realScreenHeight: number;
    engineRealScreenWidth?: number;
    engineRealScreenHeight?: number;
    surfaceWidth: number;
    surfaceHeight: number;
    videoWidth: number;
    videoHeight: number;
    isPreview: boolean;
    scalingMode: string | null;
    requestedScaleMode?: LiveWallpaperScaleMode;
    effectiveScaleMode?: LiveWallpaperScaleMode | null;
    scaleMode?: LiveWallpaperScaleMode;
    aspectNote?: string | null;
    debugHistory?: string;
    selectedPath: string | null;
    lastEvent: string | null;
    activeComponent: string | null;
    serviceActive?: boolean;
    serviceActiveByManager?: boolean;
    serviceActiveByEngine?: boolean;
    lastError: string | null;
    useSetDisplay: boolean;
    enableFixedSizeFallback: boolean;
    enableFixedSizeInPreview: boolean;
    enableSizeFromLayout: boolean;
    previewInitDelayMs: number;
  }>;

  /**
   * Clear all cached live wallpaper videos to free storage.
   */
  clearCache(): Promise<{ freedMB: number }>;

  /**
   * Listen for download/apply progress events.
   */
  addListener(
    eventName: "wallpaperProgress",
    callback: (event: WallpaperProgressEvent) => void
  ): Promise<{ remove: () => void }>;

  /**
   * Listen for detailed native pipeline logs.
   */
  addListener(
    eventName: "wallpaperLog",
    callback: (event: WallpaperLogEvent) => void
  ): Promise<{ remove: () => void }>;
}

const LiveWallpaperPlugin =
  registerPlugin<LiveWallpaperPluginInterface>("LiveWallpaperPlugin");

export default LiveWallpaperPlugin;
