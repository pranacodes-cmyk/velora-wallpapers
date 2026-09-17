import LiveWallpaperPlugin, {
  type WallpaperLogEvent,
  type WallpaperProgressEvent,
} from "@/plugins/live-wallpaper";
import { addAppLog } from "@/services/app-logs";

type NativeApplyResult = Awaited<ReturnType<typeof LiveWallpaperPlugin.setLiveWallpaper>>;
type NativeDebugState = Awaited<ReturnType<typeof LiveWallpaperPlugin.getDebugState>>;

export interface ApplyLiveWallpaperResult {
  applied: boolean;
  result?: NativeApplyResult;
  debugState?: NativeDebugState;
  error?: string;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function applyLiveWallpaperWithDiagnostics(options: {
  videoUrl: string;
  videoId: string;
  forceRefresh?: boolean;
  /** Expected video width for manual crop override (default: 1088) */
  videoWidth?: number;
  /** Expected video height for manual crop override (default: 1920) */
  videoHeight?: number;
}): Promise<ApplyLiveWallpaperResult> {
  const subscriptions: Array<{ remove: () => void }> = [];

  try {
    addAppLog("info", "[LiveWallpaper] Apply started", options);

    const progressSub = await LiveWallpaperPlugin.addListener(
      "wallpaperProgress",
      (event: WallpaperProgressEvent) => {
        addAppLog("info", "[LiveWallpaper] Progress", event);
      }
    );
    subscriptions.push(progressSub);

    const pipelineSub = await LiveWallpaperPlugin.addListener(
      "wallpaperLog",
      (event: WallpaperLogEvent) => {
        const level = event.level === "error" ? "error" : event.level === "warn" ? "warn" : "info";
        addAppLog(level, `[LiveWallpaper:${event.stage}] ${event.message}`, event.details);
      }
    );
    subscriptions.push(pipelineSub);

    const result = await LiveWallpaperPlugin.setLiveWallpaper({
      videoUrl: options.videoUrl,
      videoId: options.videoId,
      forceRefresh: options.forceRefresh ?? true,
      videoWidth: options.videoWidth ?? 1088,
      videoHeight: options.videoHeight ?? 1920,
    });

    let applied = !!result.applied;
    if (!applied) {
      try {
        const active = await LiveWallpaperPlugin.isActive();
        applied = !!active.active && active.videoId === options.videoId;
        addAppLog("info", "[LiveWallpaper] Fallback active check", active);
      } catch (fallbackError) {
        addAppLog("warn", "[LiveWallpaper] Fallback active check failed", fallbackError);
      }
    }

    let debugState: NativeDebugState | undefined;
    if (!applied || result.lastError) {
      try {
        debugState = await LiveWallpaperPlugin.getDebugState();
        addAppLog(applied ? "warn" : "error", "[LiveWallpaper] Debug state snapshot", debugState);
      } catch (debugError) {
        addAppLog("warn", "[LiveWallpaper] Failed to fetch debug state", debugError);
      }
    }

    addAppLog(applied ? "info" : "warn", "[LiveWallpaper] Apply finished", {
      ...result,
      applied,
    });

    if (applied) {
      // Analytics: north-star event
      import("@/services/analytics").then((a) => a.track("wallpaper_applied", {
        wallpaper_id: options.videoId,
        type: "live",
      })).catch(() => {});
      // Major peak-happiness moment — they just decorated their phone.
      import("@/services/rating").then((m) => {
        m.recordHappyMoment(2);
        // Wait a few seconds so they can admire their new wallpaper first.
        setTimeout(() => m.maybeRequestRating(), 3500);
      }).catch(() => {});
    }


    return {
      applied,
      result,
      debugState,
    };
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    addAppLog("error", "[LiveWallpaper] Apply failed", { message: errorMessage });

    let debugState: NativeDebugState | undefined;
    try {
      debugState = await LiveWallpaperPlugin.getDebugState();
      addAppLog("error", "[LiveWallpaper] Debug state after failure", debugState);
    } catch (debugError) {
      addAppLog("warn", "[LiveWallpaper] Failed to fetch debug state after failure", debugError);
    }

    return {
      applied: false,
      error: errorMessage,
      debugState,
    };
  } finally {
    subscriptions.forEach((sub) => {
      try {
        sub.remove();
      } catch {
        // no-op
      }
    });
  }
}
