/**
 * Premium haptic feedback utility.
 * Uses native Capacitor haptics on mobile, with navigator.vibrate fallback.
 * Intensity levels are intentionally subtle.
 */

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

type HapticStyle = "soft" | "light" | "medium" | "heavy" | "error" | "scene";

const webPatterns: Record<HapticStyle, number | number[]> = {
  soft: 6,
  light: 10,
  medium: 14,
  heavy: [10, 20, 14],
  error: [12, 40, 12],
  scene: [8, 28, 8],
};

async function runNative(style: HapticStyle): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    if (style === "error") {
      await Haptics.notification({ type: NotificationType.Warning });
      return true;
    }

    const impact: ImpactStyle =
      style === "soft" || style === "light"
        ? ImpactStyle.Light
        : style === "medium" || style === "scene"
          ? ImpactStyle.Medium
          : ImpactStyle.Heavy;

    await Haptics.impact({ style: impact });
    return true;
  } catch {
    return false;
  }
}

let lastWebVibrateAt = 0;

function runWebFallback(style: HapticStyle) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;

  const now = Date.now();
  if (now - lastWebVibrateAt < 120) return;
  lastWebVibrateAt = now;

  const p = webPatterns[style];
  navigator.vibrate(p);
}

/**
 * Fire haptic feedback.
 */
export function haptic(style: HapticStyle = "light") {
  void runNative(style).then((usedNative) => {
    if (!usedNative) runWebFallback(style);
  });
}

