// Shared constants + utilities extracted from OnboardingFlow so the late
// slides (Prayer, BibleChat, Focus, Time, Name) can live in a lazy chunk
// without pulling the main controller module.
import { haptic } from "@/utils/haptics";
import PrayerAlarm from "@/plugins/prayer-alarm";
import type { UserTime } from "@/lib/userProfile";

import bgSunrise from "@/assets/onboarding-bg-sunrise.webp";
import bgOcean from "@/assets/onboarding-bg-ocean.webp";
import bgClouds from "@/assets/onboarding-bg-clouds.webp";
import appLogo from "@/assets/app-logo.png";
import divineBgDark from "@/assets/divine-bg-dark.webp";
import devotionalBgAsset from "@/assets/devotional-bg-2.jpg.asset.json";
import { toAbsoluteAssetUrl } from "@/data/parallaxScenes";

export const devotionalBg = toAbsoluteAssetUrl(devotionalBgAsset.url);
export { bgSunrise, bgOcean, bgClouds, appLogo, divineBgDark };

// Low-end Android GPUs (Adreno 3xx / Mali-G52) choke on Framer Motion
// infinite loops + runtime `filter: blur()`. Disable both on Android to
// eliminate HardwareRenderer.nSyncAndDrawFrame ANRs during onboarding.
export const IS_ANDROID =
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("android-device");

export const ONB_REPEAT: number = IS_ANDROID ? 0 : Infinity;
export const ONB_BLUR_14 = IS_ANDROID ? "none" : "blur(14px)";
export const ONB_NAV_LOCK_MS = IS_ANDROID ? 260 : 420;
export const ONB_SLIDE_FADE_SECONDS = IS_ANDROID ? 0.16 : 0.34;
export const ONB_PRESENCE_MODE: "wait" | "sync" = IS_ANDROID ? "wait" : "sync";
export const ONB_SLIDE_EXIT = IS_ANDROID ? undefined : { opacity: 0 };

// Content entrance timing. The old values (0.18s delay + 0.55s duration +
// 0.14s per-card stagger) meant the slide itself swapped instantly but its
// text/cards kept animating for ~0.7-1.0s afterwards — that is the "ruka ruka"
// hesitation users feel when tapping Continue. Shorter, near-immediate reveals
// keep the same fade-up look but make each slide land at once.
export const ONB_IN_DELAY = IS_ANDROID ? 0 : 0.05;
export const ONB_IN_DUR = IS_ANDROID ? 0.24 : 0.32;
export const ONB_STAGGER = IS_ANDROID ? 0.035 : 0.05;

export const headlineStyle = {
  color: "hsl(40 30% 96%)",
  fontFamily: "'SF Pro Display', 'Inter', system-ui, sans-serif",
  letterSpacing: "-0.02em",
  textShadow: "0 2px 24px hsl(0 0% 0% / 0.6)",
} as const;

export const goldSpan = {
  background:
    "linear-gradient(105deg, hsl(42 85% 55%), hsl(38 100% 70%), hsl(42 85% 55%))",
  backgroundSize: "200% 100%",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  animation: IS_ANDROID ? "none" : "onb-gold-sweep 1.6s ease-out 1 both",
} as const;

export function hapticAfterPaint(style: "soft" | "medium") {
  if (typeof window === "undefined") {
    haptic(style);
    return;
  }
  window.requestAnimationFrame(() => window.setTimeout(() => haptic(style), 0));
}

export function getPrayerTimes(pick: UserTime) {
  if (pick === "morning") return [{ hour: 7, minute: 0, label: "Morning Prayer" }];
  if (pick === "evening") return [{ hour: 21, minute: 0, label: "Evening Prayer" }];
  return [
    { hour: 7, minute: 0, label: "Morning Prayer" },
    { hour: 21, minute: 0, label: "Evening Prayer" },
  ];
}

export function schedulePrayerTimesDeferred(times: ReturnType<typeof getPrayerTimes>) {
  try {
    localStorage.setItem(
      "jwbp_prayer_alarms_v1",
      JSON.stringify({ enabled: true, soundEnabled: true, times }),
    );
  } catch { /* ignore */ }

  window.setTimeout(() => {
    PrayerAlarm.scheduleAll({ times, soundEnabled: true }).catch(() => { /* ignore */ });
  }, IS_ANDROID ? 700 : 120);
}

export const PRAYER_SEED_KEY = "jwbp_prayer_alarms_v1";

// Seed the prayer alarm config so the Daily tab is pre-filled.
// We DON'T set enabled=true — permission/native scheduling happens on Daily.
export function seedPrayerTimes(pick: UserTime) {
  try {
    const times =
      pick === "morning"
        ? [{ hour: 7, minute: 0, label: "Morning Prayer" }]
        : pick === "evening"
        ? [{ hour: 21, minute: 0, label: "Evening Prayer" }]
        : [
            { hour: 7, minute: 0, label: "Morning Prayer" },
            { hour: 21, minute: 0, label: "Evening Prayer" },
          ];
    const raw = localStorage.getItem(PRAYER_SEED_KEY);
    const prev = raw ? JSON.parse(raw) : {};
    if (prev?.enabled) return;
    localStorage.setItem(
      PRAYER_SEED_KEY,
      JSON.stringify({ enabled: false, soundEnabled: true, times, _seeded: true }),
    );
  } catch { /* ignore */ }
}
