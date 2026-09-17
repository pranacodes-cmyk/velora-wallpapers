import { lazy, Suspense, useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Smartphone, Sun, Moon, Flame, Crown, ChevronRight, BookOpen,
  Star, Play, Headphones, Settings as SettingsIcon, Heart, Lock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProxyImage } from "@/hooks/useProxyImage";
import { WallpaperDetail } from "@/components/WallpaperDetail";
import { getDailyPrayer } from "@/data/dailyVerses";
import { useDailyVerse } from "@/hooks/useDailyVerse";
// NOTE: `@/data/journeys` (≈93 KB of journey text, which pulls in the localized
// journey content too) is deliberately NOT imported statically here. It is only
// needed by the journey card far below the fold, so it is loaded dynamically
// after first paint — keeping it out of the startup bundle.
type JourneysModule = typeof import("@/data/journeys");
import type { QuizQuestion } from "@/data/quizQuestions";
import { useStreak } from "@/hooks/useStreak";
import { usePremium } from "@/hooks/usePremium";
import { useJourneyProgress } from "@/hooks/useJourneyProgress";
import { PremiumCrossLogo } from "@/components/PremiumCrossLogo";
import { StreakBadge } from "@/components/StreakBadge";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { haptic } from "@/utils/haptics";
import { track } from "@/services/analytics";
import { useRenderCost } from "@/services/perf-attribution";
import { getUserFocus, getUserName, FOCUS_META, focusToJourneyId, USER_PROFILE_EVENT, type UserFocus } from "@/lib/userProfile";
import verseHeroBg from "@/assets/verse-bg-thumb/daily-verse-tree-card.webp";
import { useVerseWallpaper, getBgCardForDay } from "@/hooks/useVerseWallpaper";
import giftRibbonCross from "@/assets/gift-ribbon-cross.webp";
import prayerBg1Asset from "@/assets/devotional-bg-1.jpg.asset.json";
import prayerBg2Asset from "@/assets/devotional-bg-2.jpg.asset.json";
import prayerBg3Asset from "@/assets/devotional-bg-3.jpg.asset.json";
import prayerBg4Asset from "@/assets/devotional-bg-4.jpg.asset.json";
import { toAbsoluteAssetUrl } from "@/data/parallaxScenes";
// Force absolute CDN origin — /__l5e/ paths 404 inside Capacitor's https://localhost WebView.
const PRAYER_BGS = [
  toAbsoluteAssetUrl(prayerBg1Asset.url),
  toAbsoluteAssetUrl(prayerBg2Asset.url),
  toAbsoluteAssetUrl(prayerBg3Asset.url),
  toAbsoluteAssetUrl(prayerBg4Asset.url),
];
import { PrayerBellsHero } from "@/components/prayer/PrayerBellsHero";
import { PrayerBellsPill } from "@/components/prayer/PrayerBellsPill";
import { PrayerAlarmToggles } from "@/components/prayer/PrayerAlarmToggles";
import { ProPrayerToggle } from "@/components/prayer/ProPrayerToggle";
import { usePrayerAlarms, DEFAULT_TIMES } from "@/hooks/usePrayerAlarms";
import { toast } from "sonner";
import { isAndroidPerfMode } from "@/lib/androidPerf";
import { useT, t as t_, getLang } from "@/i18n";
import { localizeQuizQuestion } from "@/i18n/content";
import { markContentReady } from "@/services/perf";

// ─── Lazy-loaded chunks ────────────────────────────────────────────────────
// Modals: only load when first opened. Below-fold cards: mount on scroll-in via
// IntersectionObserver. Both drop initial JS parse + first-paint cost of Today.
const PremiumSheet = lazy(() =>
  import("@/components/PremiumSheet").then((m) => ({ default: m.PremiumSheet })),
);
const SearchOverlay = lazy(() =>
  import("@/components/SearchOverlay").then((m) => ({ default: m.SearchOverlay })),
);
const ExitConfirmDialog = lazy(() =>
  import("@/components/ExitConfirmDialog").then((m) => ({ default: m.ExitConfirmDialog })),
);
const PrayerSetupSheet = lazy(() =>
  import("@/components/prayer/PrayerSetupSheet").then((m) => ({ default: m.PrayerSetupSheet })),
);
const ParallaxRail = lazy(() =>
  import("@/components/ParallaxRail").then((m) => ({ default: m.ParallaxRail })),
);
const BibleCompanionCard = lazy(() =>
  import("@/components/companion/BibleCompanionCard").then((m) => ({ default: m.BibleCompanionCard })),
);


/* DEBUG: reset today's progress when ?reset=today is in the URL (dev-only) */
function useResetToday() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!window.location.search.includes("reset=today")) return;
    localStorage.removeItem("cw_prayers_unlocked");
    localStorage.removeItem("cw_prayer_slot_opened");
    localStorage.removeItem("cw_prayer_slot_unlocked");
    localStorage.removeItem("cw_reflection_done");
    localStorage.removeItem("cw_quiz_daily");
    localStorage.removeItem("cw_perfect_streak");
    sessionStorage.removeItem("cw_funnel_handoff");
    sessionStorage.removeItem("cw_funnel_exit_count");
    sessionStorage.removeItem("cw_prayer_viewed_at");
    window.dispatchEvent(new CustomEvent("cw_today_tasks_changed"));
    window.dispatchEvent(new CustomEvent("cw_funnel_changed"));
    // strip param so a refresh won't clear again
    const url = new URL(window.location.href);
    url.searchParams.delete("reset");
    window.history.replaceState({}, "", url.toString());
  }, []);
}

/* Open the Verse + Reflection sheet when arriving from the morning Verse push
 * (route is `/?openReflection=1`). Sets the same session flag and dispatches
 * the same event the post-prayer handoff already uses, so the sheet pops on
 * the home screen regardless of TodayChecklist mount order. */
function useOpenReflectionFromQuery() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("openReflection") !== "1") return;
      sessionStorage.setItem("cw_open_reflection_now", "1");
      // Strip the param so a refresh won't re-open.
      url.searchParams.delete("openReflection");
      url.searchParams.delete("from");
      window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
      // Dispatch after a beat so the checklist listener is mounted.
      setTimeout(() => {
        try { window.dispatchEvent(new Event("cw_funnel_open_reflection")); } catch {}
      }, 120);
    } catch { /* noop */ }
  }, []);
}
import TodayChecklist from "@/components/today/TodayChecklist";
// ParallaxRail lazy-imported above


// ============================================================================
// Helpers
// ============================================================================
function monthLabel(i: number) { return t_(`today.month.${i}`); }
function dayLabel(i: number) { return t_(`today.day.${i}`); }

function useGreeting() {
  const { t } = useT();
  return useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return { text: t("today.greeting.morning"), Icon: Sun, isNight: false };
    if (h < 17) return { text: t("today.greeting.afternoon"), Icon: Sun, isNight: false };
    return { text: t("today.greeting.evening"), Icon: Moon, isNight: true };
  }, [t]);
}

/** Live "Xh Ym" until next midnight. Ticks once per minute. */
function useMidnightCountdown(): string {
  const [label, setLabel] = useState(() => formatUntilMidnight());
  useEffect(() => {
    const t = setInterval(() => setLabel(formatUntilMidnight()), 60_000);
    return () => clearInterval(t);
  }, []);
  return label;
}
function formatUntilMidnight(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const totalMin = Math.max(1, Math.floor((next.getTime() - now.getTime()) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1) return t_("today.countdown.hm", { h, m });
  return t_("today.countdown.m", { m });
}

// Countdown for the next 3-hour boundary (Bible Question refresh window).
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
function getThreeHourSeed(): number {
  return Math.floor(Date.now() / THREE_HOURS_MS);
}
function formatUntilNextThreeHour(): string {
  const nextBoundary = (getThreeHourSeed() + 1) * THREE_HOURS_MS;
  const totalMin = Math.max(1, Math.floor((nextBoundary - Date.now()) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1) return t_("today.countdown.hm", { h, m });
  return t_("today.countdown.m", { m });
}
function useThreeHourCountdown(): string {
  const [label, setLabel] = useState(() => formatUntilNextThreeHour());
  useEffect(() => {
    const t = setInterval(() => setLabel(formatUntilNextThreeHour()), 60_000);
    return () => clearInterval(t);
  }, []);
  return label;
}

// ----------------------------------------------------------------------------
// Next-prayer countdown — ticks every second (HH:MM:SS).
// Morning prayer is always available; evening unlocks at 18:00.
// After 18:00 the next "drop" is tomorrow 00:00 (next morning prayer).
// ----------------------------------------------------------------------------
const EVENING_UNLOCK_HOUR = 18;
function getNextPrayerTarget(now: Date): { at: Date; label: string } {
  const h = now.getHours();
  if (h < EVENING_UNLOCK_HOUR) {
    const target = new Date(now);
    target.setHours(EVENING_UNLOCK_HOUR, 0, 0, 0);
    return { at: target, label: t_("today.label.eveningPrayer") };
  }
  const target = new Date(now);
  target.setHours(24, 0, 0, 0);
  return { at: target, label: t_("today.label.nextPrayer") };
}
function useNextPrayerCountdown() {
  const [state, setState] = useState(() => computeNextPrayer());
  useEffect(() => {
    // Android / low-end: tick every 30s. Countdown label rounds to minutes
    // anyway, so 1s ticks were pure wasted re-renders (they triggered a full
    // TodayPrayerCard render every single second — battery + CPU killer).
    const isLowEnd =
      typeof document !== "undefined" &&
      (document.documentElement.classList.contains("low-end-device") ||
        document.documentElement.classList.contains("android-device"));
    const period = isLowEnd ? 30_000 : 1000;
    const id = setInterval(() => setState(computeNextPrayer()), period);
    return () => clearInterval(id);
  }, []);
  return state;
}

function computeNextPrayer() {
  const now = new Date();
  const { at, label } = getNextPrayerTarget(now);
  const diff = Math.max(0, at.getTime() - now.getTime());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { h, m, s, label, totalMs: diff };
}



// ============================================================================
// SECTION HEADER
// ============================================================================
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span
        aria-hidden
        className="w-[3px] h-[14px] rounded-full"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--primary)), hsl(var(--primary) / 0.55))",
          boxShadow: "0 0 8px hsl(var(--primary) / 0.45)",
        }}
      />
      <p
        className="text-[11px] font-extrabold tracking-[0.16em] uppercase text-foreground/80"
      >
        {children}
      </p>
    </div>
  );
}


// ============================================================================
// LITE MOCKUP — placeholder for off-screen carousel slides.
// The full PhoneMockup costs a conic-gradient frame, several radial gradients,
// a full-screen image decode, a MutationObserver and a verse lookup. Mounting
// eleven of them on cold start was the single most expensive thing the home
// screen did (profiled: ~2s of main-thread work on a mid Android). Slides that
// are not near the centre are dimmed to 0.32 opacity and scaled down anyway,
// so a flat frame is visually indistinguishable — and free.
// ============================================================================
function LiteMockup() {
  return (
    <div className="relative w-full h-full">
      <div
        className="relative w-full h-full rounded-[26px] p-[3px]"
        style={{ background: "linear-gradient(160deg, hsl(42 30% 30%), hsl(0 0% 6%) 55%, hsl(42 25% 24%))" }}
      >
        <div
          className="w-full h-full rounded-[23px]"
          style={{ background: "linear-gradient(180deg, hsl(220 45% 9%), hsl(220 55% 5%))" }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// PHONE MOCKUP — refined gold-titanium frame, used in the swipe carousel
// ============================================================================

function PhoneMockup({
  date,
  isToday,
  isLocked,
  previewSrc,
  loading,
}: {
  date: Date;
  isToday: boolean;
  isLocked: boolean;
  previewSrc?: string | null;
  loading?: boolean;
}) {
  // Card mockups use the light 480w preview, never the full-size wallpaper file.
  const bg = useMemo(() => getBgCardForDay(date), [date]);
  const { verse } = useDailyVerse(date);

  // Frosted-teaser tuning: keep the veil soft on low-end WebViews.
  const blurPx =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("low-end-device") ||
      document.documentElement.classList.contains("android-device"))
      ? 5
      : 7;
  // Show only the book (e.g. "Psalms" from "Psalms 91:1") — enough to intrigue,
  // not enough to satisfy.
  const teaserRef = useMemo(() => {
    const m = verse.reference.match(/^(\d?\s?[^\d]+?)\s*\d/);
    return (m?.[1] || verse.reference).trim();
  }, [verse.reference]);

  // Devanagari matras break apart with wide letter-spacing — keep tracking near
  // zero for Hindi, airy caps for Latin scripts.
  const lang = getLang();
  const refTracking = lang === "hi" ? "0.03em" : "0.18em";
  const lockedRefTracking = lang === "hi" ? "0.03em" : "0.2em";

  // Fit the verse by shrinking type instead of cutting mid-sentence: non-English
  // renderings run ~30% longer, so a fixed 90-char slice truncated them badly.
  const versePreview = useMemo(() => {
    const text = verse.text.trim();
    const limit = 160;
    if (text.length <= limit) return text;
    const cut = text.slice(0, limit);
    const sp = cut.lastIndexOf(" ");
    return (sp > limit * 0.6 ? cut.slice(0, sp) : cut).trim() + "…";
  }, [verse.text]);
  const verseFontSize =
    versePreview.length > 130 ? 7.2 : versePreview.length > 100 ? 8.2 : 9.5;
  // For today, prefer the fully-rendered canvas wallpaper. For other days,
  // show just the bg and overlay the verse with DOM text (cheap, sharp).
  const src = isToday ? (previewSrc || bg) : bg;
  const timeLabel = isToday
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: false })
    : "8:00";

  // Light theme → cool platinum/silver frame so it doesn't scream gold on white.
  // Dark theme → keeps the titanium-gold frame.
  const [isLight, setIsLight] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("light")
  );
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setIsLight(el.classList.contains("light"));
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const frameBg = isLight
    ? "conic-gradient(from 130deg at 50% 50%, hsl(220 12% 78%) 0deg, hsl(220 10% 52%) 60deg, hsl(220 14% 38%) 150deg, hsl(220 12% 48%) 230deg, hsl(220 14% 72%) 320deg, hsl(220 12% 82%) 360deg)"
    : "conic-gradient(from 130deg at 50% 50%, hsl(42 35% 38%) 0deg, hsl(0 0% 8%) 60deg, hsl(0 0% 4%) 150deg, hsl(0 0% 6%) 230deg, hsl(42 28% 28%) 320deg, hsl(42 35% 38%) 360deg)";
  const frameShadow = isLight
    ? "0 18px 36px -18px hsl(220 30% 25% / 0.45), 0 0 0 0.5px hsl(220 15% 55% / 0.35), inset 0 1px 0 hsl(0 0% 100% / 0.6), inset 0 -1px 0 hsl(220 20% 25% / 0.35)"
    : "0 24px 48px -20px hsl(0 0% 0% / 0.95), 0 0 0 0.5px hsl(42 50% 55% / 0.18), inset 0 1px 0 hsl(42 60% 70% / 0.25), inset 0 -1px 0 hsl(0 0% 0% / 0.7)";
  const innerRimShadow = isLight
    ? "inset 0 0 0 1px hsl(0 0% 0%), inset 0 0 0 2px hsl(220 12% 60% / 0.45)"
    : "inset 0 0 0 1px hsl(0 0% 0%), inset 0 0 0 2px hsl(42 30% 22% / 0.4)";

  // Day-of-year for the "Day X / 365" badge
  const dayOfYear = useMemo(() => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / 86400000);
  }, [date]);
  const daysInYear =
    ((date.getFullYear() % 4 === 0 && date.getFullYear() % 100 !== 0) ||
      date.getFullYear() % 400 === 0)
      ? 366
      : 365;

  return (
    <div className="relative w-full h-full">
      {/* Ground contact shadow */}
      <div
        className="absolute left-1/2 -bottom-2 w-[78%] h-4 -translate-x-1/2 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(0 0% 0% / 0.65) 0%, transparent 70%)",
        }}
      />

      {/* Titanium frame — gold in dark, platinum in light */}
      <div
        className="relative w-full h-full rounded-[26px] p-[3px]"
        style={{
          background: frameBg,
          boxShadow: frameShadow,
        }}
      >
        {/* Inner black rim */}
        <div
          className="relative w-full h-full rounded-[23px] overflow-hidden bg-black"
          style={{
            boxShadow: innerRimShadow,
          }}
        >
          {src && (
            <img
              key={src}
              src={src}
              alt=""
              loading={isToday ? "eager" : "lazy"}
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
              style={
                isLocked
                  ? {
                      // Static (never animated) filter — composited once, cheap
                      // even on low-end WebViews. Scale hides blurred edges.
                      filter: `blur(${blurPx}px) saturate(0.92)`,
                      transform: "scale(1.08)",
                    }
                  : undefined
              }
            />
          )}
          {loading && isToday && !previewSrc && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="golden-pulse-dots"><span /><span /><span /></div>
            </div>
          )}

          {/* Subtle readability gradient — matches the real wallpaper */}
          {!isToday && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: isLocked
                  ? "linear-gradient(180deg, hsl(228 40% 6% / 0.32) 0%, hsl(228 40% 5% / 0.6) 45%, hsl(228 40% 4% / 0.68) 100%)"
                  : "linear-gradient(180deg, hsl(0 0% 0% / 0.25) 0%, hsl(0 0% 0% / 0.55) 38%, hsl(0 0% 0% / 0.6) 60%, hsl(0 0% 0% / 0.4) 100%)",
              }}
            />
          )}

          {/* Locked days get a faint gold sheen so the veil reads premium, not broken */}
          {isLocked && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 80% 55% at 50% 52%, hsl(42 95% 62% / 0.14) 0%, transparent 70%)",
              }}
            />
          )}

          {/* iOS status bar — pushed to the outer corners so it always clears
              the dynamic island, even on narrow phones. Padding scales with
              the frame width (% based) so the layout never collides. */}
          <div className="absolute top-0 left-0 right-0 h-[22px] flex items-center justify-between z-20 pointer-events-none" style={{ paddingLeft: "9%", paddingRight: "9%" }}>
            <span className="text-white text-[8px] font-semibold tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] leading-none">
              {timeLabel}
            </span>
            <div className="flex items-center gap-[3px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
              <svg width="9" height="6" viewBox="0 0 11 7" fill="none">
                <rect x="0" y="5" width="1.5" height="2" rx="0.3" fill="white" />
                <rect x="2.5" y="3.5" width="1.5" height="3.5" rx="0.3" fill="white" />
                <rect x="5" y="2" width="1.5" height="5" rx="0.3" fill="white" />
                <rect x="7.5" y="0" width="1.5" height="7" rx="0.3" fill="white" />
              </svg>
              <div className="relative flex items-center">
                <div className="w-[12px] h-[5.5px] rounded-[1.5px] border border-white/90 flex items-center p-[0.5px]">
                  <div className="h-full w-[80%] rounded-[0.5px] bg-white" />
                </div>
                <div className="w-[1px] h-[3px] bg-white/90 rounded-r-sm ml-[0.5px]" />
              </div>
            </div>
          </div>

          {/* Dynamic island — slimmer & truer to iPhone proportions so it
              never overlaps the status bar icons on small screens. */}
          <div
            className="absolute top-[6px] left-1/2 -translate-x-1/2 w-[24%] h-[10px] rounded-full z-30"
            style={{ background: "hsl(0 0% 0%)" }}
          />


          {/* Lock-screen clock + date */}
          <div className="absolute top-[26px] left-0 right-0 z-20 text-center pointer-events-none">
            <p className="text-white/95 text-[7.5px] font-medium tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
              {dayLabel(date.getDay())}, {monthLabel(date.getMonth())} {date.getDate()}
            </p>
            <p
              className="text-white font-light tabular-nums leading-none mt-[2px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
              style={{ fontSize: "30px", letterSpacing: "-1px" }}
            >
              {timeLabel}
            </p>
          </div>

          {/* Verse overlay for non-today (today uses the canvas-rendered image) */}
          {!isToday && !isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-3 pointer-events-none z-10">
              <p
                className="text-white text-center italic font-semibold leading-[1.35] drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                style={{
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                  fontSize: `${verseFontSize}px`,
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 7,
                  overflow: "hidden",
                  overflowWrap: "break-word",
                }}
              >
                &ldquo;{versePreview}&rdquo;
              </p>
              <p
                className="mt-1.5 text-center font-bold uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]"
                style={{ color: "hsl(42 92% 70%)", fontSize: "6.5px", letterSpacing: refTracking }}
              >
                — {verse.reference}
              </p>
            </div>
          )}

          {/* Locked day — frosted teaser. Book name stays readable (aspirational),
              the verse itself becomes soft light-bars so nothing looks broken. */}
          {!isToday && isLocked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pointer-events-none z-10">
              {/* Soft "veiled scripture" lines */}
              <div className="w-full flex flex-col items-center gap-[4px]">
                {[92, 100, 78, 58].map((w, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${w}%`,
                      height: "4.5px",
                      borderRadius: "999px",
                      background:
                        "linear-gradient(90deg, hsl(0 0% 100% / 0.16), hsl(0 0% 100% / 0.42), hsl(0 0% 100% / 0.16))",
                      boxShadow: "0 1px 3px hsl(0 0% 0% / 0.45)",
                    }}
                  />
                ))}
              </div>

              {/* The reveal — book name only, in gold */}
              <p
                className="mt-2.5 text-center font-bold uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                style={{ color: "hsl(42 95% 74%)", fontSize: "6.5px", letterSpacing: lockedRefTracking }}
              >
                {teaserRef}
              </p>

              {/* Tiny gold key chip */}
              <div
                className="mt-2 inline-flex items-center gap-[3px] rounded-full"
                style={{
                  padding: "2px 6px",
                  background: "hsl(42 90% 58% / 0.18)",
                  border: "0.5px solid hsl(42 95% 68% / 0.55)",
                  boxShadow: "0 2px 8px -2px hsl(0 0% 0% / 0.6)",
                }}
              >
                <Lock className="w-[6px] h-[6px]" strokeWidth={3} style={{ color: "hsl(42 100% 78%)" }} />
                <span
                  className="font-extrabold uppercase tracking-[0.14em]"
                  style={{ fontSize: "5.5px", color: "hsl(42 100% 80%)" }}
                >
                  Pro
                </span>
              </div>
            </div>
          )}

          {/* Home indicator */}
          <div className="absolute bottom-[5px] left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="w-[60px] h-[3px] rounded-full bg-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
          </div>
        </div>
      </div>

      {/* Day X / 365 chip — sits cleanly above the frame, minimal */}
      <div
        className="absolute -top-6 left-1/2 -translate-x-1/2 z-40 text-[9px] font-semibold tracking-[0.16em] tabular-nums uppercase whitespace-nowrap pointer-events-none"
        style={{
          color: "hsl(var(--primary) / 0.85)",
        }}
      >
        {t_("today.dayBadge", { day: dayOfYear, total: daysInYear })}
      </div>

      {/* Lock badge removed — Pro CTA below already communicates locked state */}
    </div>
  );
}

// ============================================================================
// Countdown helper — ticks toward midnight for future days
// ============================================================================
function captionForOffset(offset: number, now: number): string {
  if (offset === 0) return t_("today.caption.today");
  if (offset < 0) return offset === -1 ? t_("today.caption.yesterday") : t_("today.caption.daysAgo", { n: -offset });
  const target = new Date(now);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + offset);
  const ms = target.getTime() - now;
  if (ms <= 0) return t_("today.caption.unlocking");
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days >= 1) return t_("today.caption.unlocksDHM", { d: days, h: hours, m: mins });
  if (hours >= 1) return t_("today.caption.unlocksHMS", { h: hours, m: mins, s: secs });
  if (mins >= 1) return t_("today.caption.unlocksMS", { m: mins, s: secs });
  return t_("today.caption.unlocksS", { s: secs });
}


// ============================================================================
// VERSE HERO — the centerpiece of the page
// ============================================================================
const DAY_OFFSETS = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7] as const;
const TODAY_IDX = DAY_OFFSETS.indexOf(0);

function VerseHero({ onPremium }: { onPremium: () => void }) {
  useRenderCost("today.verse_hero");
  const { t } = useT();
  const navigate = useNavigate();
  const { dataUrl, loading, bgSrc } = useVerseWallpaper();
  const { isPremium } = usePremium();
  const previewSrc = dataUrl || bgSrc;
  const contentReadySent = useRef(false);
  useEffect(() => {
    if (loading || contentReadySent.current) return;
    contentReadySent.current = true;
    const frame = requestAnimationFrame(() => markContentReady("today", { wallpaper_preview_ready: !!dataUrl }));
    return () => cancelAnimationFrame(frame);
  }, [loading, dataUrl]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(TODAY_IDX);
  const [now, setNow] = useState(() => Date.now());

  // Android / low-end: hero-carousel re-render every second is an ANR hotspot.
  // The countdown label only cares about minutes, so 60s ticks are plenty.
  useEffect(() => {
    const constrained =
      document.documentElement.classList.contains("low-end-device") ||
      document.documentElement.classList.contains("android-device");
    const t = setInterval(() => setNow(Date.now()), constrained ? 60_000 : 1000);
    return () => clearInterval(t);
  }, []);



  const days = useMemo(
    () =>
      DAY_OFFSETS.map((off) => {
        const d = new Date();
        d.setDate(d.getDate() + off);
        return { offset: off, date: d };
      }),
    []
  );

  // ---------------------------------------------------------------------------
  // Carousel geometry is measured ONCE (and on resize) instead of on every
  // scroll frame. The previous version read offsetLeft/clientWidth of all 11
  // slides inside onScroll, which forces a synchronous layout on every frame of
  // the swipe — CPU profiling showed this as the single largest main-thread
  // block on the home screen (>1s on a 6x-throttled device).
  // ---------------------------------------------------------------------------
  const geomRef = useRef<{ centers: number[]; viewport: number } | null>(null);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return null;
    const centers: number[] = [];
    for (let i = 0; i < el.children.length; i++) {
      const c = el.children[i] as HTMLElement;
      centers.push(c.offsetLeft + c.clientWidth / 2);
    }
    const geom = { centers, viewport: el.clientWidth };
    geomRef.current = geom;
    return geom;
  }, []);

  const scrollToIdx = useCallback(
    (i: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current;
      if (!el) return;
      const geom = geomRef.current || measure();
      const center = geom?.centers[i];
      if (center == null) return;
      const left = center - (geom!.viewport / 2);
      if (behavior === "auto") el.scrollLeft = left;
      else el.scrollTo({ left, behavior });
    },
    [measure]
  );

  // Measure + center on today in a single layout pass on mount.
  useLayoutEffect(() => {
    measure();
    scrollToIdx(TODAY_IDX, "auto");
    const onResize = () => { measure(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure, scrollToIdx]);

  // Scroll handling: rAF-throttled, zero DOM reads (pure math on cached
  // geometry). `activeIdx` drives the cheap opacity/scale styling; the heavier
  // "which slides get a real mockup" decision is deferred to `settledIdx` so we
  // never mount an image + blur mid-swipe.
  const lastHapticIdx = useRef(activeIdx);
  const rafRef = useRef(0);
  const settleTimer = useRef<number | null>(null);
  const [settledIdx, setSettledIdx] = useState(TODAY_IDX);

  const onScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = scrollRef.current;
      const geom = geomRef.current;
      if (!el || !geom) return;
      const center = el.scrollLeft + geom.viewport / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < geom.centers.length; i++) {
        const d = Math.abs(geom.centers[i] - center);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      setActiveIdx((prev) => (prev === bestIdx ? prev : bestIdx));
      if (bestIdx !== lastHapticIdx.current) {
        lastHapticIdx.current = bestIdx;
        haptic("soft");
      }
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => {
        setSettledIdx((prev) => (prev === bestIdx ? prev : bestIdx));
      }, 140);
    });
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);


  const activeDay = days[activeIdx];
  const isActiveToday = activeDay?.offset === 0;
  const isActiveLocked = !isPremium && !isActiveToday;

  // Measure the frosted-preview upsell: one impression per session per offset.
  const seenLockedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!isActiveLocked || !activeDay) return;
    if (seenLockedRef.current.has(activeDay.offset)) return;
    seenLockedRef.current.add(activeDay.offset);
    track("today_locked_verse_preview_seen", { day_offset: activeDay.offset });
  }, [isActiveLocked, activeDay?.offset]);

  const handleCtaTap = () => {
    haptic("medium");
    track("today_set_verse_cta_tapped", { is_premium: !!isPremium, locked: isActiveLocked, day_offset: activeDay?.offset ?? 0 });
    if (isActiveLocked) { onPremium(); return; }
    navigate("/daily-verse");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mx-3 mt-1 mb-4 relative overflow-hidden rounded-[24px]"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, hsl(var(--primary) / 0.10) 0%, hsl(var(--card)) 45%, hsl(var(--background)) 100%)",
        border: "1px solid hsl(var(--primary) / 0.24)",
        boxShadow:
          "0 22px 48px -22px hsl(0 0% 0% / 0.75), inset 0 1px 0 hsl(var(--primary) / 0.12)",
      }}
    >
      {/* Apple-style ambient aurora behind the phone */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[28%] -translate-x-1/2 w-[92%] h-[54%] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, hsl(42 95% 62% / 0.30) 0%, hsl(38 90% 55% / 0.18) 35%, transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-[26%] -translate-x-1/2 w-[70%] h-[50%] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(var(--primary) / 0.26) 0%, transparent 60%)",
        }}
      />

      <div className="relative px-4 pt-3 pb-3.5">
        {/* Magic Line — THE hero promise (compact) */}
        <div className="text-center mb-1.5">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full mb-1"
            style={{
              background: "hsl(var(--primary) / 0.14)",
              border: "1px solid hsl(var(--primary) / 0.32)",
            }}
          >
            <Star className="w-3 h-3 text-primary" strokeWidth={2.6} />
            <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-primary">
              {t("today.hero.badge")}
            </span>
          </div>
          <p className="text-[13.5px] font-extrabold text-foreground leading-snug px-2">
            {t("today.hero.titlePart1")}{" "}
            <span className="text-primary">{t("today.hero.titlePart2")}</span>
          </p>
        </div>



        {/* === SWIPE CAROUSEL of phone mockups === */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="relative flex overflow-x-auto snap-x [&::-webkit-scrollbar]:hidden items-center"
          style={{
            scrollbarWidth: "none",
            // Adaptive height — tight on small phones, generous on large.
            // clamp keeps the phone from feeling lost in whitespace on big
            // screens and from being squashed/cut off on small ones.
            height: "clamp(300px, 38dvh, 420px)",
            // Just enough top space for the "Day X / 365" chip (-top-6 = 24px)
            // and a hair of breathing room below before the caption.
            paddingBlock: "22px 8px",
            scrollPaddingInline: "32%",
            paddingInline: "32%",
            gap: "6%",
            // Apple-calm snap: proximity (not mandatory) + native momentum
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorX: "contain",
          }}
        >
          {days.map(({ offset, date }, i) => {
            const isToday = offset === 0;
            const locked = !isPremium && !isToday;
            const isActive = i === activeIdx;
            // Only slides within reach of the centre get the real mockup. Keyed
            // off `settledIdx` (not `activeIdx`) so a heavy mockup never mounts
            // in the middle of a swipe — that mount was dropping frames on every
            // card change.
            const near = Math.abs(i - settledIdx) <= 2;
            return (
              <button
                key={offset}
                onClick={() => {
                  haptic("soft");
                  // If tapping a non-centered card, glide it to center
                  if (!isActive) {
                    scrollToIdx(i, "smooth");
                    track("today_wallpaper_phone_centered", { day_offset: offset });
                    return;
                  }
                  track("today_wallpaper_phone_tapped", { day_offset: offset, locked, is_premium: !!isPremium });
                  if (locked) onPremium();
                  else navigate("/daily-verse");
                }}
                aria-label={isToday ? t("today.hero.todayBtn") : t("today.hero.phoneAria", { day: date.toDateString() })}
                className="snap-center snap-always flex-shrink-0"
                style={{
                  aspectRatio: "9 / 19.5",
                  height: "92%",
                  opacity: isActive ? 1 : 0.32,
                  filter: isActive ? "none" : "saturate(0.55)",
                  transform: isActive ? "scale(1)" : "scale(0.9)",
                  transformOrigin: "center",
                  transition: "opacity 120ms linear, transform 140ms ease-out, filter 120ms linear",
                  contain: "layout",
                }}
              >
                {near ? (
                  <PhoneMockup
                    date={date}
                    isToday={isToday}
                    isLocked={false}
                    previewSrc={isToday ? previewSrc : undefined}
                    loading={loading}
                  />
                ) : (
                  <LiteMockup />
                )}


              </button>
            );
          })}
        </div>

        {/* Live caption + jump-to-today */}
        <div className="flex justify-center items-center gap-2 mt-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-[0.06em] tabular-nums uppercase"
            style={{
              background: isActiveLocked
                ? "linear-gradient(180deg, hsl(42 70% 16% / 0.85), hsl(38 70% 10% / 0.85))"
                : "hsl(var(--foreground) / 0.08)",
              border: isActiveLocked
                ? "1px solid hsl(42 90% 55% / 0.5)"
                : "1px solid hsl(var(--foreground) / 0.12)",
              color: isActiveLocked
                ? "hsl(42 100% 78%)"
                : "hsl(var(--foreground) / 0.85)",
              boxShadow: isActiveLocked
                ? "0 4px 14px -4px hsl(42 92% 50% / 0.35), inset 0 1px 0 hsl(42 100% 80% / 0.18)"
                : "none",
            }}
          >
            {isActiveLocked && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "hsl(42 100% 70%)", boxShadow: "0 0 6px hsl(42 100% 65%)" }}
              />
            )}
            {captionForOffset(activeDay?.offset ?? 0, now)}
          </span>

          {activeIdx !== TODAY_IDX && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => { haptic("soft"); scrollToIdx(TODAY_IDX); }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-[0.06em] uppercase"
              style={{
                background: "linear-gradient(180deg, hsl(42 92% 60%), hsl(38 88% 48%))",
                color: "hsl(var(--background))",
                boxShadow: "0 4px 14px -4px hsl(var(--primary) / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.3)",
              }}
            >
              <Sun className="w-3 h-3" strokeWidth={2.8} />
              {t("today.hero.todayBtn")}
            </motion.button>
          )}
        </div>


        {/* Pagination dots — tappable */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {days.map((_, i) => (
            <button
              key={i}
              onClick={() => { haptic("soft"); scrollToIdx(i); }}
              aria-label={t("today.hero.goToDay", { n: i + 1 })}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === activeIdx ? 18 : 5,
                height: 5,
                background:
                  i === activeIdx
                    ? "linear-gradient(90deg, hsl(42 92% 60%), hsl(38 100% 70%))"
                    : i === TODAY_IDX
                    ? "hsl(var(--primary) / 0.55)"
                    : "hsl(var(--foreground) / 0.18)",
              }}
            />
          ))}
        </div>

        {/* Primary CTA — free today's verse (outlined when locked behind Pro upsell sibling) */}
        <button
          onClick={handleCtaTap}
          className="w-full mt-2.5 flex items-center justify-center gap-2 rounded-2xl h-12 font-bold text-[14px] tracking-[0.02em] active:scale-[0.985] transition-transform"
          style={
            isActiveLocked
              ? {
                  background:
                    "linear-gradient(180deg, hsl(42 78% 52%) 0%, hsl(38 80% 42%) 100%)",
                  color: "hsl(var(--background))",
                  boxShadow:
                    "0 10px 22px -6px hsl(var(--primary) / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.32)",
                }
              : {
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.14), hsl(var(--accent) / 0.10))",
                  color: "hsl(var(--primary))",
                  border: "1px solid hsl(var(--primary) / 0.42)",
                  boxShadow: "0 6px 18px -8px hsl(var(--primary) / 0.45)",
                }
          }
        >
          {isActiveLocked ? (
            <><Crown className="w-4 h-4" strokeWidth={2.6} /> {t("today.hero.ctaUnlock")}</>
          ) : (
            <><Star className="w-4 h-4" strokeWidth={2.6} /> {t("today.hero.ctaSetFree")}</>
          )}
        </button>

        {/* Secondary CTA — Auto-changing (Premium), now the filled gold primary upsell. */}
        {!isPremium && !isActiveLocked && (
          <button
            onClick={() => { haptic("medium"); track("today_auto_change_pro_tapped", {}); onPremium(); }}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-2xl h-11 font-bold text-[13px] tracking-[0.02em] active:scale-[0.985] transition-transform"
            style={{
              background:
                "linear-gradient(180deg, hsl(42 92% 60%) 0%, hsl(38 88% 48%) 100%)",
              color: "hsl(var(--background))",
              boxShadow:
                "0 10px 22px -6px hsl(var(--primary) / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.32)",
            }}
          >
            <Crown className="w-3.5 h-3.5" strokeWidth={2.6} />
            {t("today.hero.ctaAutoChange")}
          </button>
        )}


        {/* free-user upsell moved to dedicated PremiumNudge below the Journey */}

      </div>
    </motion.div>
  );
}

// ============================================================================
// STREAK BANNER — only renders if user has a streak
// ============================================================================
function StreakBanner() {
  const { current, longest } = useStreak();
  if (current < 1) return null;

  const isHot = current >= 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="mx-3 mb-5 rounded-2xl px-4 py-3 flex items-center gap-3 relative overflow-hidden"
      style={{
        background: isHot
          ? "linear-gradient(105deg, hsl(var(--primary) / 0.18), hsl(var(--premium-gold-glow) / 0.10), hsl(var(--primary) / 0.18))"
          : "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)",
        border: `1px solid hsl(var(--primary) / ${isHot ? 0.5 : 0.22})`,
        boxShadow: isHot
          ? "0 12px 28px -12px hsl(var(--primary) / 0.45)"
          : "0 8px 20px -10px hsl(0 0% 0% / 0.6)",
      }}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, hsl(42 90% 60%), hsl(38 100% 70%))",
          boxShadow: "0 6px 16px -4px hsl(var(--primary) / 0.55)",
        }}
      >
        <Flame className="w-6 h-6" fill="hsl(var(--background))" stroke="hsl(var(--background))" strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-extrabold text-foreground leading-tight">
          {current}-day streak{isHot ? " · on fire" : ""}
        </p>
        <p className="text-[11px] text-foreground/65 mt-0.5 leading-snug">
          {current === 1
            ? "Beautiful start — come back tomorrow."
            : isHot
            ? `Don't break the chain — your best is ${longest}.`
            : "Keep showing up for Him."}
        </p>

      </div>
    </motion.div>
  );
}

// ============================================================================
// PRAYER CARD — shows the current slot (morning before 6pm, evening after).
// Slot at its natural time is direct-open (no fake "tap to reveal" blur).
// When a NEW slot drops and the user hasn't opened it yet, we show a clean
// "Unlock new prayer" CTA. After opening once, it becomes "Continue praying".
// ============================================================================
import {
  getCurrentSlot,
  isOpened,
  PRAYER_SLOT_EVENT,
  type PrayerSlot,
} from "@/lib/prayerSlots";

function useCurrentSlotState() {
  const [slot, setSlot] = useState<PrayerSlot>(getCurrentSlot());
  const [opened, setOpened] = useState<boolean>(() => isOpened(slot));

  useEffect(() => {
    const refresh = () => {
      const s = getCurrentSlot();
      setSlot(s);
      setOpened(isOpened(s));
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    window.addEventListener(PRAYER_SLOT_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener(PRAYER_SLOT_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return { slot, opened };
}

function TodayPrayerCard() {
  useRenderCost("today.prayer_card");
  const navigate = useNavigate();
  const prayer = useMemo(() => getDailyPrayer(), []);
  const { slot, opened } = useCurrentSlotState();
  const isEvening = slot === "evening";
  const label = isEvening ? "Evening Prayer" : "Morning Prayer";
  const next = useNextPrayerCountdown();

  const { dayOfYear } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return { dayOfYear: Math.floor((now.getTime() - start.getTime()) / 86400000) };
  }, []);

  const hook = useMemo(() => {
    const m = prayer.trim().match(/^(.+?[.!?])\s/);
    return m ? m[1] : prayer.trim();
  }, [prayer]);

  // Only navigate — Devotional page is what truly marks the slot "opened"
  // (when the slide scrolls into view). This keeps the Today checklist honest.
  const handleOpen = () => {
    haptic("medium");
    track("today_prayer_tile_tapped", { slot: label, state: "new" });
    navigate("/devotional");
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const CountdownPill = (
    <div
      className="flex items-center gap-1.5 px-2 py-[3px] rounded-full shrink-0"
      style={{
        background: "hsl(var(--primary) / 0.10)",
        border: "1px solid hsl(var(--primary) / 0.28)",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      <span className="text-[9.5px] font-bold tracking-[0.06em] uppercase text-primary tabular-nums">
        {next.label} in {pad(next.h)}:{pad(next.m)}:{pad(next.s)}
      </span>
    </div>
  );

  // ===== ALREADY OPENED — show hook + continue praying + countdown =====
  if (opened) {
    return (
      <motion.button
        whileTap={{ scale: 0.985 }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        onClick={() => { haptic("soft"); track("today_prayer_tile_tapped", { slot: label, state: "opened" }); navigate("/devotional"); }}
        className="mx-3 w-[calc(100%-1.5rem)] block text-left rounded-[22px] relative overflow-hidden mb-5"
        style={{
          background: "var(--tile-grad)",
          border: "1px solid var(--tile-border)",
          boxShadow: "var(--tile-shadow)",
        }}
      >
        <div
          aria-hidden
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-[85%] h-32 pointer-events-none opacity-40"
          style={{ background: "radial-gradient(ellipse at center, var(--tile-aurora) 0%, transparent 70%)" }}
        />
        <div className="relative z-10 px-3.5 pt-3 pb-2.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {isEvening ? <Moon className="w-3 h-3 text-primary" /> : <Sun className="w-3 h-3 text-primary" />}
              <span className="text-[9.5px] font-bold tracking-[0.22em] uppercase text-primary">
                Today's {label}
              </span>
            </div>
            <div
              className="px-2 py-[2px] rounded-full flex items-center gap-1"
              style={{ background: "hsl(var(--primary) / 0.14)", border: "1px solid hsl(var(--primary) / 0.35)" }}
            >
              <span className="text-[9px] font-bold tracking-[0.1em] text-primary">✓ OPENED</span>
            </div>
          </div>

          <div className="relative">
            <span
              aria-hidden
              className="absolute -left-0.5 -top-2 font-bold pointer-events-none select-none leading-none"
              style={{
                fontFamily: "'Georgia','Times New Roman',serif",
                fontSize: 44,
                color: "hsl(var(--primary) / 0.55)",
                textShadow: "0 2px 12px hsl(var(--primary) / 0.25)",
              }}
            >“</span>
            <p
              className="text-[14.5px] leading-[1.55] text-foreground/92 font-medium pl-5"
              style={{
                fontFamily: "'Georgia','Times New Roman',serif",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }}
            >
              {hook}
            </p>
          </div>

          <div
            className="flex items-center justify-between mt-2.5 pt-2.5 gap-2"
            style={{ borderTop: "1px solid var(--tile-divider)" }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Headphones className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={2.4} />
              <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-primary truncate">
                Continue praying
              </span>
            </div>
            {CountdownPill}
          </div>
        </div>
      </motion.button>
    );
  }

  // ===== NEW PRAYER, NOT YET OPENED — clean reveal CTA, no fake blur =====
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15 }}
      onClick={handleOpen}
      className="mx-3 w-[calc(100%-1.5rem)] block text-left rounded-[22px] relative overflow-hidden mb-5"
      style={{
        background: "var(--tile-grad)",
        border: "1px solid var(--tile-border)",
        boxShadow: "var(--tile-shadow)",
      }}
    >
      <div
        aria-hidden
        className="absolute -top-12 left-1/2 -translate-x-1/2 w-[85%] h-36 pointer-events-none opacity-40"
        style={{ background: "radial-gradient(ellipse at center, var(--tile-aurora) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 px-3.5 pt-3 pb-3">
        {/* Eyebrow */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {isEvening ? <Moon className="w-3 h-3 text-primary" /> : <Sun className="w-3 h-3 text-primary" />}
            <span className="text-[9.5px] font-bold tracking-[0.22em] uppercase text-primary">
              Today's {label}
            </span>
          </div>
          <div
            className="inline-flex items-center justify-center px-2.5 py-[3px] rounded-full leading-none"
            style={{ background: "hsl(var(--primary) / 0.12)", border: "1px solid hsl(var(--primary) / 0.3)" }}
          >
            <span className="text-[9px] font-bold tracking-normal text-primary tabular-nums whitespace-nowrap">
              Day {dayOfYear}/365
            </span>
          </div>
        </div>

        {/* Centerpiece — floating cross + "New prayer" headline */}
        <div className="flex flex-col items-center text-center py-4 gap-2.5">
          <motion.div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary) / 0.25) 0%, hsl(var(--primary) / 0.08) 100%)",
              border: "1px solid hsl(var(--primary) / 0.4)",
              boxShadow:
                "0 0 28px hsl(var(--primary) / 0.3), inset 0 1px 0 hsl(var(--primary) / 0.45)",
            }}
          >
            <Lock className="w-5 h-5 text-primary" strokeWidth={2.4} />
          </motion.div>
          <div>
            <p className="text-[14px] font-extrabold text-foreground tracking-tight">
              {isEvening ? "New evening prayer just dropped" : "A new prayer awaits you"}
            </p>
            <p className="text-[11.5px] text-foreground/55 mt-0.5">
              Ad-free · About 1 minute
            </p>
          </div>
        </div>

        {/* CTA pill */}
        <div
          className="flex items-center justify-between mt-1 pt-3 gap-2"
          style={{ borderTop: "1px solid var(--tile-divider)" }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Headphones className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={2.4} />
            <span className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-primary truncate">
              Tap to begin

            </span>
          </div>
          {CountdownPill}
        </div>
      </div>
    </motion.button>
  );
}



// ============================================================================
// PERSONALIZED JOURNEY CARD
// ============================================================================
/**
 * Loader shell: pulls the journey dataset in only after the home screen has
 * painted, then renders the real card. Reserves the card's height so nothing
 * jumps when it arrives.
 */
function PersonalizedJourneyCard() {
  const [mod, setMod] = useState<JourneysModule | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => {
      import("@/data/journeys").then((m) => { if (alive) setMod(m); }).catch(() => {});
    };
    const idle = (window as any).requestIdleCallback;
    const id = idle ? idle(load, { timeout: 1200 }) : window.setTimeout(load, 300);
    return () => {
      alive = false;
      const cancel = (window as any).cancelIdleCallback;
      if (idle && cancel) cancel(id); else clearTimeout(id as number);
    };
  }, []);

  if (!mod) {
    return (
      <div
        className="mx-3 mb-6 rounded-[24px]"
        style={{
          height: 360,
          background: "var(--tile-grad)",
          border: "1px solid var(--tile-border)",
        }}
        aria-hidden
      />
    );
  }
  return <PersonalizedJourneyCardBody mod={mod} />;
}

function PersonalizedJourneyCardBody({ mod }: { mod: JourneysModule }) {
  const { t, version } = useT();
  const navigate = useNavigate();
  const focus = (getUserFocus() ?? "anxiety") as UserFocus;
  const meta = FOCUS_META[focus];
  const journeyId = focusToJourneyId(focus);
  const journey = useMemo(
    () => mod.getJourney(journeyId) ?? mod.getLocalizedJourneys()[0],
    [mod, journeyId, version],
  );
  const { getCompletedDays } = useJourneyProgress();
  const completed = getCompletedDays(journey.id);
  const currentDay = Math.min(completed.length + 1, journey.days.length);
  const progressPct = Math.round((completed.length / journey.days.length) * 100);
  const dayInfo = journey.days[currentDay - 1];

  // Day-dot ladder (cap at 14 visible for compactness)
  const totalDays = journey.days.length;
  const visibleDots = Math.min(totalDays, 14);
  const dotStep = totalDays / visibleDots;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="mx-3 mb-6"
    >
      {/* Feature headline — gives this section the weight it deserves */}
      <div className="px-1 mb-3.5">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[10px] font-extrabold tracking-[0.22em] uppercase px-2 py-[3px] rounded-full"
            style={{
              color: "hsl(var(--primary))",
              background: "hsl(var(--primary) / 0.12)",
              border: "1px solid hsl(var(--primary) / 0.35)",
            }}
          >
            {t("today.journey.chosenForYou")}
          </span>
        </div>
        <h2
          className="fluid-h1 text-foreground"
          style={{ fontFamily: "'Georgia','Times New Roman',serif", fontWeight: 900 }}
        >
          {t("today.journey.titleTop", { n: totalDays })}
          <br />
          <span
            style={{
              background:
                "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(42 95% 65%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {t("today.journey.titleBottom")}
          </span>
        </h2>
        <p className="mt-1.5 fluid-body text-muted-foreground max-w-[80%]">
          {t("today.journey.subtitle", { focus: t(`today.journey.focus.${focus}`) })}
        </p>
      </div>


      <motion.button
        whileTap={{ scale: 0.985 }}
        onClick={() => { haptic("soft"); track("today_journey_tile_tapped", { journey_id: journey.id }); navigate(`/journeys/${journey.id}`); }}
        className="w-full block text-left rounded-[24px] relative overflow-hidden group"
        style={{
          background: "var(--tile-grad)",
          border: "1px solid var(--tile-border)",
          boxShadow: "var(--tile-shadow)",
        }}
      >
        <div className="relative rounded-[23px] p-5 overflow-hidden">
          {/* Layered ambient glows — warm gold + royal blue duotone */}
          <div
            className="absolute -top-20 -right-16 w-56 h-56 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--primary) / 0.38) 0%, transparent 65%)",
            }}
          />
          <div
            className="absolute -bottom-24 -left-16 w-56 h-56 rounded-full pointer-events-none opacity-80"
            style={{
              background:
                "radial-gradient(circle, hsl(220 80% 55% / 0.22) 0%, transparent 65%)",
            }}
          />

          {/* Faint cross watermark — golden in light mode, primary in dark */}
          <div
            className="absolute right-3 bottom-3 pointer-events-none opacity-[0.18] dark:opacity-[0.07] dark:text-primary"
            style={{ color: "hsl(42 78% 52%)" }}
            aria-hidden
          >
            <svg width="130" height="130" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 2h4v7h7v4h-7v9h-4v-9H3V9h7z" />
            </svg>
          </div>

          {/* Header row */}
          <div className="relative flex items-center gap-3.5">
            <div
              className="relative w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-[30px]"
              style={{
                background:
                  "radial-gradient(120% 120% at 30% 20%, hsl(var(--primary) / 0.55), hsl(var(--primary) / 0.12) 70%)",
                border: "1px solid hsl(var(--primary) / 0.55)",
                boxShadow:
                  "inset 0 1px 0 hsl(0 0% 100% / 0.35), 0 8px 22px -10px hsl(var(--primary) / 0.6)",
              }}
            >
              {journey.emoji}
              <Star className="absolute -top-1 -right-1 w-3.5 h-3.5 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.8)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9.5px] font-bold tracking-[0.24em] uppercase text-primary mb-1">
                {completed.length === 0
                  ? t("today.journey.beginDay1")
                  : t("today.journey.dayOf", { current: currentDay, total: totalDays })}
              </p>
              <p className="fluid-h4 text-foreground leading-tight tracking-tight truncate">
                {journey.title}
              </p>
            </div>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: "hsl(var(--primary) / 0.18)",
                border: "1px solid hsl(var(--primary) / 0.45)",
              }}
            >
              <ChevronRight className="w-4 h-4 text-primary" />
            </div>
          </div>

          {/* Day-dot ladder */}
          <div className="relative mt-5 flex items-center justify-between gap-1">
            {Array.from({ length: visibleDots }).map((_, i) => {
              const dayIndex = Math.floor(i * dotStep);
              const isDone = dayIndex < completed.length;
              const isCurrent = dayIndex === completed.length;
              return (
                <motion.span
                  key={i}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.025 }}
                  className="flex-1 h-1.5 rounded-full"
                  style={{
                    background: isDone
                      ? "linear-gradient(90deg, hsl(var(--primary)), hsl(42 95% 60%))"
                      : isCurrent
                      ? "hsl(var(--primary) / 0.6)"
                      : "hsl(var(--primary) / 0.22)",
                    boxShadow: isDone
                      ? "0 0 8px hsl(var(--primary) / 0.55)"
                      : isCurrent
                      ? "0 0 6px hsl(var(--primary) / 0.45)"
                      : "none",
                  }}
                />
              );
            })}
          </div>

          {/* CTA footer — big, obvious, "this is a feature" */}
          <div className="relative mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-foreground leading-tight truncate">
                {completed.length === 0
                  ? t("today.journey.startReading")
                  : t("today.journey.continueReading")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {dayInfo?.title ?? journey.subtitle}
              </p>
            </div>
            <span
              className="text-[11px] font-extrabold tabular-nums px-2.5 py-1 rounded-full shrink-0"
              style={{
                color: "hsl(var(--primary))",
                background: "hsl(var(--primary) / 0.16)",
                border: "1px solid hsl(var(--primary) / 0.4)",
              }}
            >
              {progressPct}%
            </span>
          </div>
        </div>
      </motion.button>
    </motion.div>
  );
}

// ============================================================================
// DAILY BIBLE QUESTION TEASER
// ============================================================================
const DAILY_Q_STORAGE_KEY = "daily-bible-q.v1";

function DailyQuestionCard() {
  useRenderCost("today.daily_question");
  const { t, version } = useT();
  const navigate = useNavigate();
  const refresh = useThreeHourCountdown();
  const [seed, setSeed] = useState<number>(() => getThreeHourSeed());
  const [picked, setPicked] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(DAILY_Q_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data?.seed === getThreeHourSeed() && typeof data?.picked === "number") {
        return data.picked;
      }
    } catch {}
    return null;
  });
  const [answeredAt, setAnsweredAt] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(DAILY_Q_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data?.seed === getThreeHourSeed() && typeof data?.at === "number") {
        return data.at;
      }
    } catch {}
    return null;
  });

  // "Calm" the answer pills 5s after answering — keep explanation intact,
  // just soften the loud green/red fills back to neutral with a thin ring.
  const CALM_DELAY_MS = 5000;
  const [calmed, setCalmed] = useState<boolean>(() => {
    if (answeredAt == null) return false;
    return Date.now() - answeredAt >= CALM_DELAY_MS;
  });
  useEffect(() => {
    if (answeredAt == null) { setCalmed(false); return; }
    const elapsed = Date.now() - answeredAt;
    if (elapsed >= CALM_DELAY_MS) { setCalmed(true); return; }
    const t = setTimeout(() => setCalmed(true), CALM_DELAY_MS - elapsed);
    return () => clearTimeout(t);
  }, [answeredAt]);

  // Roll forward when the 3h window advances (e.g. user kept the tab open).
  useEffect(() => {
    const tick = () => {
      const s = getThreeHourSeed();
      if (s !== seed) {
        setSeed(s);
        setPicked(null);
        setAnsweredAt(null);
        setCalmed(false);
        try { localStorage.removeItem(DAILY_Q_STORAGE_KEY); } catch {}
      }
    };
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [seed]);

  // The quiz bank is ~70KB of JSON-ish data. Loading it statically forced the
  // main bundle to parse it during cold start (a top jank/ANR contributor), so
  // it now streams in as its own chunk after first paint.
  const [pool, setPool] = useState<QuizQuestion[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      import("@/data/quizQuestions").then((m) => {
        if (alive) setPool(m.quizQuestions);
      }).catch(() => {});
    const ric = (window as any).requestIdleCallback;
    const handle = ric ? ric(load, { timeout: 2000 }) : window.setTimeout(load, 300);
    return () => {
      alive = false;
      if (ric && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(handle);
      else clearTimeout(handle as number);
    };
  }, []);

  // Pick a deterministic question for the current 3h window — must be stable
  // across tab switches/remounts, so we hash the seed directly into the full
  // question list (no random shuffle).
  const q = useMemo(() => {
    if (!pool || pool.length === 0) return null;
    // Cheap integer hash so consecutive seeds don't pick adjacent questions.
    const h = Math.abs(Math.imul(seed | 0, 2654435761)) >>> 0;
    const picked = pool[h % pool.length] ?? pool[0];
    return picked ? localizeQuizQuestion(picked) : null;
  }, [seed, pool, version]);


  if (!q) return null;
  const answered = picked !== null;
  const isCorrect = picked === q.correctIndex;

  const handlePick = (i: number) => {
    if (answered) return;
    haptic(i === q.correctIndex ? "medium" : "soft");
    const at = Date.now();
    setPicked(i);
    setAnsweredAt(at);
    setCalmed(false);
    try {
      localStorage.setItem(
        DAILY_Q_STORAGE_KEY,
        JSON.stringify({ seed, picked: i, at })
      );
    } catch {}
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25 }}
      className="mx-3 mb-5"
    >
      <SectionLabel>{t("today.section.dailyQuestion")}</SectionLabel>
      <div
        className="w-full rounded-[22px] p-4 relative overflow-hidden"
        style={{
          background: "var(--tile-grad-soft)",
          border: "1px solid var(--tile-border)",
          boxShadow: "var(--tile-shadow-soft)",
        }}
      >
        {/* Top gold hairline accent */}
        <div
          aria-hidden
          className="absolute top-0 left-6 right-6 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.65), transparent)",
          }}
        />
        {/* Soft gold glow in corner */}
        <div
          aria-hidden
          className="absolute -top-12 -right-12 w-36 h-36 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, transparent 65%)",
          }}
        />

        <div className="flex items-center justify-between mb-3.5">
          <span className="text-[9.5px] font-bold tracking-[0.22em] uppercase text-primary/85">
            {t("today.question.label")}
          </span>
        </div>

        <p
          className="fluid-lead font-bold text-foreground mb-3.5 relative"
          style={{
            fontFamily: "'Georgia','Times New Roman',serif",
            letterSpacing: "-0.005em",
          }}
        >
          {q.question}
        </p>


        <div className="grid grid-cols-2 gap-2">
          {q.options.slice(0, 4).map((opt, i) => {
            const isPicked = picked === i;
            const isAnswer = i === q.correctIndex;
            const showRight = answered && isAnswer;
            const showWrong = answered && isPicked && !isAnswer;
            // After 5s, fade the loud colored fills back to neutral but keep
            // a soft tinted ring so the correct answer is still recognizable.
            const bg = calmed
              ? "var(--tile-inner-bg)"
              : showRight
              ? "hsl(140 60% 40% / 0.22)"
              : showWrong
              ? "hsl(0 70% 50% / 0.18)"
              : "var(--tile-inner-bg)";
            const border = calmed
              ? showRight
                ? "hsl(140 65% 45% / 0.45)"
                : showWrong
                ? "hsl(0 65% 55% / 0.35)"
                : "var(--tile-inner-border)"
              : showRight
              ? "hsl(140 70% 45% / 0.65)"
              : showWrong
              ? "hsl(0 75% 55% / 0.6)"
              : "var(--tile-inner-border)";
            const color = calmed
              ? "hsl(var(--foreground) / 0.85)"
              : showRight
              ? "hsl(140 75% 38%)"
              : showWrong
              ? "hsl(0 75% 50%)"
              : "hsl(var(--foreground) / 0.9)";
            return (
              <motion.button
                key={opt}
                whileTap={{ scale: answered ? 1 : 0.96 }}
                onClick={() => handlePick(i)}
                disabled={answered}
                className="rounded-xl px-3 py-2.5 text-[12px] font-semibold text-center transition-all duration-700"
                style={{
                  background: bg,
                  border: `1px solid ${border}`,
                  color,
                  boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.4)",
                  opacity: answered && !calmed && !showRight && !showWrong ? 0.5 : 1,
                }}
              >
                {opt}
              </motion.button>
            );
          })}
        </div>

        {/* Verdict + explanation */}
        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={`mt-3 rounded-xl p-3 border transition-colors duration-700 ${
              calmed
                ? "bg-foreground/[0.03] border-foreground/10 dark:bg-foreground/[0.04] dark:border-foreground/10"
                : isCorrect
                ? "bg-emerald-500/15 border-emerald-600/45 dark:bg-emerald-400/12 dark:border-emerald-400/35"
                : "bg-amber-500/12 border-amber-600/40 dark:bg-amber-400/10 dark:border-amber-400/30"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className={`text-[11px] font-extrabold tracking-[0.08em] uppercase ${
                  isCorrect
                    ? "text-emerald-800 dark:text-emerald-300"
                    : "text-amber-800 dark:text-amber-300"
                }`}
              >
                {isCorrect ? "✓ Amen — correct!" : "Not quite — keep growing"}
              </span>
            </div>
            <p className="text-[12px] leading-[1.5] text-foreground/85 font-medium">
              {q.explanation}
            </p>
            <p className="text-[10.5px] mt-1.5 font-bold tracking-[0.04em]"
              style={{ color: "hsl(var(--primary) / 0.9)" }}
            >
              {q.reference}
            </p>
          </motion.div>
        )}

        {/* CTA row — changes after answer */}
        <div
          className="flex items-center justify-between mt-3 pt-3 gap-3"
          style={{ borderTop: "1px solid var(--tile-divider)" }}
        >
          {answered ? (
            <>
              <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-foreground/55 shrink-0">
                New question in {refresh}
              </span>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => { haptic("medium"); track("today_quiz_start_tapped", { surface: "quiz_card_answered" }); navigate("/quiz"); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-extrabold"
                style={{
                  background: "linear-gradient(180deg, hsl(42 92% 60%), hsl(38 88% 48%))",
                  color: "hsl(var(--background))",
                  boxShadow: "0 6px 16px -4px hsl(var(--primary) / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.3)",
                }}
              >
                <Star className="w-3.5 h-3.5" strokeWidth={2.6} />
                Start full quiz
              </motion.button>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-foreground/55">
                Tap an answer to begin
              </span>
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-foreground/40 tabular-nums">
                New in {refresh}
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// QUICK ACTIONS — small navigation row
// ============================================================================
function QuickActions() {
  const { t } = useT();
  const navigate = useNavigate();
  const items = [
    { label: t("today.quick.live"), icon: Play, to: "/live", hue: 280 },
    { label: t("today.quick.photos"), icon: BookOpen, to: "/static-wallpapers", hue: 200 },
    { label: t("today.quick.journeys"), icon: Heart, to: "/journeys", hue: 340 },
  ];
  return (
    <div className="mx-3 mb-5">
      <SectionLabel>{t("today.section.explore")}</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it, i) => (
          <motion.button
            key={it.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => { haptic("soft"); track("today_quick_link_tapped", { label: it.label, to: it.to }); navigate(it.to); }}
            className="rounded-2xl py-3 px-2 flex flex-col items-center gap-1.5"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--glass-border))",
            }}

          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, hsl(${it.hue} 80% 55% / 0.22), hsl(${it.hue} 80% 45% / 0.05))`,
                border: `1px solid hsl(${it.hue} 70% 55% / 0.32)`,
              }}
            >
              <it.icon className="w-4 h-4" style={{ color: `hsl(${it.hue} 85% 72%)` }} strokeWidth={2.2} />
            </div>
            <span className="text-[11px] font-extrabold text-foreground">{it.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TODAY'S PICKS — 2 hand-picked wallpapers, rotates daily
// ============================================================================
const INSTALL_KEY = "jw_install_day";
function getDaysSinceInstall(): number {
  try {
    const today = Math.floor(Date.now() / 86_400_000);
    const stored = Number(localStorage.getItem(INSTALL_KEY) || 0);
    if (!stored) {
      localStorage.setItem(INSTALL_KEY, String(today));
      return 0;
    }
    return Math.max(0, today - stored);
  } catch {
    return 0;
  }
}

type StaticPick = {
  kind: "static";
  id: string;
  title: string;
  image_url: string;
  is_premium: boolean;
};
type LivePick = {
  kind: "live";
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  is_premium: boolean;
};
type Pick = StaticPick | LivePick;

function isImageAssetUrl(url?: string | null) {
  return !!url && /\.(avif|webp|png|jpe?g|gif)(\?|$)/i.test(url);
}

function isVideoAssetUrl(url?: string | null) {
  return !!url && (/\.(webm|mp4|mov|m4v)(\?|$)/i.test(url) || url.includes("/previews/"));
}

function PickPhone({
  pick,
  onTap,
  delay,
}: {
  pick: Pick;
  onTap: () => void;
  delay: number;
}) {
  const isLive = pick.kind === "live";
  const thumbSrc = isLive ? (pick.thumbnail_url || pick.video_url || "") : pick.image_url;
  const disableInlineVideo = isAndroidPerfMode();
  const isLiveVideoPreview = isLive && !disableInlineVideo && isVideoAssetUrl(thumbSrc);
  const staticPreviewSrc = !isLiveVideoPreview && !isVideoAssetUrl(thumbSrc) ? thumbSrc : null;
  const { blobUrl } = useProxyImage(staticPreviewSrc || null);
  const [videoReady, setVideoReady] = useState(false);
  const containerRef = useRef<HTMLButtonElement>(null);

  return (
    <motion.button
      ref={containerRef}
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.97 }}
      onClick={() => { haptic("light"); onTap(); }}
      className="relative flex-1 overflow-hidden"
      style={{
        aspectRatio: "9 / 18",
        borderRadius: "26px",
        background: "hsl(var(--secondary) / 0.4)",
        border: "1px solid hsl(var(--primary) / 0.24)",
        boxShadow:
          "0 18px 36px -16px hsl(0 0% 0% / 0.7), inset 0 1px 0 hsl(0 0% 100% / 0.06)",
      }}
    >
      {isLiveVideoPreview && thumbSrc ? (
        <video
          key={thumbSrc}
          src={thumbSrc}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: videoReady ? 1 : 0,
            filter: "saturate(1.1) contrast(1.05)",
            transform: "translateZ(0)",
          }}
        />
      ) : blobUrl ? (
        <img
          src={blobUrl}
          alt={pick.title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "saturate(1.1) contrast(1.05)" }}
        />
      ) : isLive ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 25%, hsl(var(--primary) / 0.18), transparent 44%), linear-gradient(160deg, hsl(var(--card)), hsl(var(--background)))",
          }}
        />
      ) : (
        <div className="absolute inset-0 shimmer-skeleton" />
      )}

      {/* Notch */}
      <div
        aria-hidden
        className="absolute top-1.5 left-1/2 -translate-x-1/2 w-[34%] h-[14px] rounded-full"
        style={{ background: "hsl(0 0% 0% / 0.55)" }}
      />
      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{ background: "linear-gradient(to top, hsl(0 0% 0% / 0.7), transparent)" }}
      />
      {isLive && (
        <div
          className="absolute top-2.5 left-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full"
          style={{
            background: "hsl(0 0% 0% / 0.55)",
            border: "1px solid hsl(var(--primary) / 0.4)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "hsl(140 80% 55%)", boxShadow: "0 0 6px hsl(140 80% 55% / 0.8)" }}
          />
          <span className="text-[8.5px] font-extrabold tracking-[0.1em] text-white/90">LIVE</span>
        </div>
      )}
      {pick.is_premium && (
        <div
          className="absolute top-3 right-2.5 flex items-center justify-center w-5 h-5 rounded-full"
          style={{
            background: "hsl(0 0% 0% / 0.55)",
            border: "1px solid hsl(var(--primary) / 0.4)",
          }}
        >
          <Crown className="w-2.5 h-2.5 text-primary" strokeWidth={2.6} />
        </div>
      )}
    </motion.button>
  );
}

function TodaysPicksCard() {
  useRenderCost("today.todays_picks");
  const navigate = useNavigate();
  const [selected, setSelected] = useState<null | StaticPick>(null);
  const refresh = useMidnightCountdown();

  const { data: statics } = useQuery({
    queryKey: ["todays-picks-statics"],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallpapers")
        .select("id, title, image_url, is_premium")
        .order("sort_order", { ascending: true })
        .range(0, 19);
      return (data || []).map((w): StaticPick => ({ kind: "static", ...w }));
    },
  });

  const { data: lives } = useQuery({
    queryKey: ["todays-picks-lives"],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data } = await supabase
        .from("live_wallpapers")
        .select("id, title, video_url, thumbnail_url, is_premium")
        .order("sort_order", { ascending: true })
        .range(0, 19);
      return (data || []).map((w): LivePick => ({ kind: "live", ...w }));
    },
  });

  const picks = useMemo<Pick[]>(() => {
    const s = statics || [];
    const l = lives || [];
    if (s.length + l.length < 2) return [];

    const offset = getDaysSinceInstall();

    // First-ever day: show the two top live wallpapers so brand new
    // users meet our most polished motion picks right away.
    if (offset === 0 && l.length >= 2) return [l[0], l[1]];

    // Subsequent days: deterministic but mixed — any combo of live + static.
    // Interleave so the combined pool alternates kinds, then walk it by day.
    const mixed: Pick[] = [];
    const maxLen = Math.max(s.length, l.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < l.length) mixed.push(l[i]);
      if (i < s.length) mixed.push(s[i]);
    }
    if (mixed.length < 2) return mixed;
    const a = (offset * 2) % mixed.length;
    const b = (offset * 2 + 1) % mixed.length;
    return [mixed[a], mixed[b]];
  }, [statics, lives]);

  if (picks.length < 2) return null;

  const handleTap = (p: Pick) => {
    if (p.kind === "live") {
      // Jump to /live and open the live preview/apply overlay directly for this pick.
      // The full record is passed via location state so LiveFeed can open the overlay
      // without an extra fetch.
      const { kind, ...record } = p;
      navigate("/live", { state: { previewLive: record } });
    } else {
      setSelected(p);
    }
  };


  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mx-3 mb-5"
      >
        <SectionLabel>✨ Today's Picks</SectionLabel>
        <div
          className="relative rounded-[22px] p-[18px] overflow-hidden"
          style={{
            background: "var(--tile-grad)",
            border: "1px solid var(--tile-border)",
            boxShadow: "var(--tile-shadow)",
          }}
        >
          {/* Top accent hairline */}
          <div
            aria-hidden
            className="absolute top-0 left-6 right-6 h-px pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.7), transparent)",
            }}
          />
          {/* Soft aurora glow */}
          <div
            aria-hidden
            className="absolute -top-14 -right-12 w-44 h-44 rounded-full pointer-events-none"
            style={{
              background: "var(--tile-aurora)",
            }}
          />

          <div className="relative flex items-center justify-between mb-3.5 gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-foreground leading-tight truncate">
                Hand-picked for today
              </p>
              <p className="text-[10.5px] font-semibold text-foreground/55 mt-0.5 truncate">
                Two fresh wallpapers, every day
              </p>
            </div>
            <span
              className="shrink-0 flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.16em] uppercase pl-2 pr-2.5 py-1 rounded-full bg-primary text-primary-foreground"
              style={{
                boxShadow:
                  "0 4px 10px -3px hsl(var(--primary) / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.35)",
              }}
            >
              <span
                aria-hidden
                className="w-1.5 h-1.5 rounded-full bg-primary-foreground/85"
              />
              Daily
            </span>
          </div>

          <div className="relative flex gap-3">
            {picks.map((w, i) => (
              <PickPhone
                key={w.id}
                pick={w}
                delay={0.1 + i * 0.08}
                onTap={() => handleTap(w)}
              />
            ))}
          </div>

          <div className="relative flex items-center justify-between mt-3.5 pt-3 gap-3"
            style={{ borderTop: "1px solid var(--tile-divider)" }}
          >
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-foreground/55 truncate">
              Tap to set on your phone
            </span>
            <span className="shrink-0 text-[9.5px] font-bold tracking-[0.08em] uppercase text-foreground/45 tabular-nums">
              New in {refresh}
            </span>
          </div>
        </div>
      </motion.div>

      {selected && (
        <WallpaperDetail
          wallpaper={{
            id: selected.id,
            src: selected.image_url,
            title: selected.title,
            category: "",
            isPremium: selected.is_premium,
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// ============================================================================
// PREMIUM NUDGE — only for free users
// ============================================================================
function PremiumNudge({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.35 }}
      onClick={() => { haptic("medium"); onOpen(); }}
      className="mx-3 mt-4 mb-8 w-[calc(100%-1.5rem)] block text-left rounded-[22px] p-4 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, hsl(42 85% 50% / 0.16), hsl(38 100% 65% / 0.06))",
        border: "1px solid hsl(42 85% 60% / 0.45)",
        boxShadow: "0 14px 32px -14px hsl(42 85% 50% / 0.35)",
      }}
    >
      {/* Shimmer sweep removed — was an infinite framer-motion loop running
          on every Today render, contributing to perceived sluggishness on
          low-end Androids. The gold gradient + border + glow already carry
          the "premium" read without continuous repaint. */}
      <div className="relative flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, hsl(42 90% 60%), hsl(38 100% 70%))",
            boxShadow: "0 6px 16px -4px hsl(42 85% 50% / 0.6)",
          }}
        >
          <Crown className="w-5 h-5" style={{ color: "hsl(var(--background))" }} strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-extrabold text-foreground leading-tight">
            {t("today.nudge.title")}
          </p>
          <p className="text-[11px] text-foreground/70 mt-1 leading-snug">
            {t("today.nudge.subtitle")}
          </p>
        </div>
        <div
          className="px-3 py-2 rounded-xl font-extrabold text-[11px] tracking-[0.06em]"
          style={{
            background:
              "linear-gradient(135deg, hsl(42 95% 62%), hsl(42 88% 50%))",
            color: "hsl(var(--background))",
          }}
        >
          {t("today.nudge.cta")}
        </div>
      </div>
    </motion.button>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function Today() {
  const { t } = useT();
  useResetToday();
  useOpenReflectionFromQuery();
  const navigate = useNavigate();
  const greeting = useGreeting();
  const { isPremium, unlock } = usePremium();
  const [showPremium, setShowPremium] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [showPrayerSetup, setShowPrayerSetup] = useState(false);
  const { config: prayerConfig, enable: enablePrayerBells } = usePrayerAlarms();

  // One-tap enable — no sheet, no permission primer. Android grants
  // USE_EXACT_ALARM automatically (declared in manifest), so this just works.
  const handleEnableBells = async () => {
    try {
      await enablePrayerBells({ times: DEFAULT_TIMES, soundEnabled: true });
      toast.success(t("today.bells.set"), {
        description: "Morning · Midday · Evening — we'll call you back to Jesus.",
      });
    } catch {
      toast.error(t("today.bells.error"));
    }
  };
  const [userName, setUserNameState] = useState<string | null>(() => getUserName());

  // Ensure streak ticks on mount
  useStreak();

  useEffect(() => {
    track("today_page_viewed", { is_premium: !!isPremium });
  }, [isPremium]);

  useEffect(() => {
    const onChange = () => setUserNameState(getUserName());
    window.addEventListener("onboarding-complete", onChange);
    window.addEventListener(USER_PROFILE_EVENT, onChange);
    return () => {
      window.removeEventListener("onboarding-complete", onChange);
      window.removeEventListener(USER_PROFILE_EVENT, onChange);
    };
  }, []);

  useAndroidBack(() => {
    if (showPremium) { setShowPremium(false); return; }
    if (showSearch) { setShowSearch(false); return; }
    const overlay = document.querySelector(
      "[data-back-consumer], [role='dialog'][data-state='open'], [role='alertdialog'][data-state='open'], [data-radix-popper-content-wrapper], [data-vaul-drawer][data-state='open']"
    );
    if (overlay) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return;
    }
    setShowExit(true);
  });

  return (
    <div data-theme-scope="today" className="h-full flex flex-col bg-background relative overflow-hidden">
      {/* Header */}
      <div
        className="flex-shrink-0 relative z-30"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px), 0.5rem)",
          background: "linear-gradient(180deg, hsl(var(--background)), hsl(var(--background) / 0.92))",
          borderBottom: "1px solid hsl(var(--glass-border))",
        }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <PremiumCrossLogo size={36} />
            <div className="leading-none min-w-0">
              <div className="flex items-center gap-1.5">
                <greeting.Icon className="w-3 h-3 text-primary" strokeWidth={2.4} />
                <p className="text-[9.5px] font-bold tracking-[0.2em] uppercase text-primary/80">
                  {greeting.text}
                </p>
              </div>
              <h1
                className="font-black tracking-[-0.02em] leading-tight mt-1 text-foreground truncate"
                style={{ fontSize: "clamp(15px, 4.4vw, 22px)", maxWidth: "min(60vw, 240px)" }}
              >
                {userName ? userName : t("today.header.fallbackName")}
              </h1>
              <p className="text-[10px] font-semibold tracking-[0.04em] text-foreground/50 mt-0.5">
                {dayLabel(new Date().getDay())}, {monthLabel(new Date().getMonth())} {new Date().getDate()}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            <StreakBadge />
            {/* Search removed — not relevant on Daily */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { haptic("soft"); navigate("/settings"); }}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "hsl(var(--foreground) / 0.06)", border: "1px solid hsl(var(--glass-border))" }}
            >
              <SettingsIcon className="w-4 h-4 text-foreground/60" strokeWidth={2.2} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Scroll body */}
      <div className="flex-1 overflow-y-auto scroll-container pb-28 pt-3">
        <VerseHero onPremium={() => setShowPremium(true)} />

        <TodayChecklist />

        {isPremium && <ProPrayerToggle />}
        <PrayerAlarmToggles />

        {/* ParallaxRail is 524-line component. Lazy-loaded — reserve height
            so scroll doesn't jump when chunk resolves. */}
        <Suspense fallback={<div style={{ minHeight: 180 }} aria-hidden />}>
          <ParallaxRail />
        </Suspense>

        <PersonalizedJourneyCard />

        {/* Below-fold: lazy chunk. Placeholder holds space so LCP is stable. */}
        <Suspense fallback={<div style={{ minHeight: 220 }} aria-hidden />}>
          <BibleCompanionCard />
        </Suspense>

        {!isPremium && <PremiumNudge onOpen={() => setShowPremium(true)} />}
        <DailyQuestionCard />

        {/* Faith-built footer — gentle, never preachy */}
        <div className="px-6 pt-10 pb-4 text-center">
          <div
            className="mx-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{
              background: "hsl(var(--glass))",
              border: "1px solid hsl(var(--glass-border))",
              color: "hsl(var(--primary))",
            }}
          >
            <span aria-hidden>✝</span>
            {t("today.footer.tagline")}
          </div>
          <p className="text-[11px] text-foreground/45 mt-3 leading-relaxed max-w-[260px] mx-auto">
            {t("today.footer.line1")}
          </p>
          <p className="text-[10px] text-foreground/30 mt-2 italic">
            {t("today.footer.soliDeo")}
          </p>
        </div>
      </div>

      {/* Modals: mount ONLY on first open. React.lazy + conditional mount so
          none of these ~500-line trees are parsed on initial Today render. */}
      <Suspense fallback={null}>
        {showPremium && (
          <PremiumSheet
            isOpen={showPremium}
            onClose={() => setShowPremium(false)}
            onUnlock={unlock}
            trigger="today"
          />
        )}
        {showPrayerSetup && (
          <PrayerSetupSheet open={showPrayerSetup} onClose={() => setShowPrayerSetup(false)} />
        )}
        {showSearch && (
          <SearchOverlay open={showSearch} onClose={() => setShowSearch(false)} />
        )}
        {showExit && (
          <ExitConfirmDialog open={showExit} onClose={() => setShowExit(false)} />
        )}
      </Suspense>
    </div>

  );
}
