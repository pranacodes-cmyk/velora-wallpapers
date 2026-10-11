import { isAndroidPerfMode } from "@/lib/androidPerf";

/**
 * Returns iOS-perfect glassmorphism styles on desktop/iOS, and a solid
 * opaque fallback on Android — where `backdrop-filter: blur()` is the
 * single biggest GPU killer on Adreno 3xx / Mali-G52 devices (can drop
 * from 60 fps to ~8 fps under a single 20px blur).
 *
 * Usage:
 *   style={glass({ blur: 20, bg: "hsl(var(--glass))" })}
 */
export function glass(opts: {
  /** Blur radius in px. Default 20. */
  blur?: number;
  /** Base background when blur is available (usually a translucent token). */
  bg?: string;
  /** Fallback background when blur is stripped — should be more opaque. */
  fallbackBg?: string;
  /** Extra saturation (e.g. "saturate(1.5)") — dropped on Android. */
  saturate?: string;
} = {}): React.CSSProperties {
  const { blur = 20, bg, fallbackBg, saturate } = opts;
  if (isAndroidPerfMode()) {
    // Solid-ish substitute — cheap for GPU, still reads as a "surface".
    return { background: fallbackBg ?? bg ?? "hsl(var(--card))" };
  }
  const filter = saturate ? `blur(${blur}px) ${saturate}` : `blur(${blur}px)`;
  return {
    background: bg,
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
  };
}
