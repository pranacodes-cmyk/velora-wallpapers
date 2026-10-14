import { Suspense, useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sun, Flame, Crown, Star, Settings as SettingsIcon, Lock, Gift,
} from "lucide-react";
import { useDailyVerse } from "@/hooks/useDailyVerse";
import { useStreak } from "@/hooks/useStreak";
import { usePremium } from "@/hooks/usePremium";
import { Button } from "@/components/ui/button";
import { StreakBadge } from "@/components/StreakBadge";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { haptic } from "@/utils/haptics";
import { track } from "@/services/analytics";
import { useRenderCost } from "@/services/perf-attribution";
import { getUserName, USER_PROFILE_EVENT } from "@/lib/userProfile";
import { useVerseWallpaper, getBgCardForDay } from "@/hooks/useVerseWallpaper";
import { toAbsoluteAssetUrl } from "@/data/parallaxScenes";
import { PrayerBellsHero } from "@/components/prayer/PrayerBellsHero";
import { PrayerBellsPill } from "@/components/prayer/PrayerBellsPill";
import { useT, t as t_, getLang } from "@/i18n";
import { markContentReady } from "@/services/perf";
import { lazyPage } from "@/lib/lazy-page";

// ─── Lazy-loaded chunks ────────────────────────────────────────────────────
// Modals: only load when first opened. Below-fold cards: mount on scroll-in via
// IntersectionObserver. Both drop initial JS parse + first-paint cost of Today.
const PremiumSheet = lazyPage(() =>
  import("@/components/PremiumSheet").then((m) => ({ default: m.PremiumSheet })),
);
const LifeCalendarPreview = lazyPage(() =>
  import("@/components/LifeCalendarPreview").then((m) => ({ default: m.LifeCalendarPreview })),
);
const SearchOverlay = lazyPage(() =>
  import("@/components/SearchOverlay").then((m) => ({ default: m.SearchOverlay })),
);
const ExitConfirmDialog = lazyPage(() =>
  import("@/components/ExitConfirmDialog").then((m) => ({ default: m.ExitConfirmDialog })),
);
const PrayerSetupSheet = lazyPage(() =>
  import("@/components/prayer/PrayerSetupSheet").then((m) => ({ default: m.PrayerSetupSheet })),
);
const ParallaxRail = lazyPage(() =>
  import("@/components/ParallaxRail").then((m) => ({ default: m.ParallaxRail })),
);
const ChallengeHomeCard = lazyPage(() => import("@/components/challenge/ChallengeHomeCard"));
const PrayScreenFeatureCard = lazyPage(() =>
  import("@/components/prayscreen/PrayScreenFeatureCard").then((m) => ({ default: m.PrayScreenFeatureCard })),
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
import TodayPrayerCard from "@/components/today/TodayPrayerCard";
import DailyQuestionCard from "@/components/today/DailyQuestionCard";
import {
  SectionLabel,
  dayLabel,
  monthLabel,
  useGreeting,
  useMidnightCountdown,
} from "@/components/today/todayShared";
import { PrayerAlarmToggles } from "@/components/prayer/PrayerAlarmToggles";
// ParallaxRail lazy-imported above


// ============================================================================
// Helpers
// ============================================================================
// SECTION HEADER
// ============================================================================


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

  // Set below, once `paintDepth` exists (declaration order only).
  const paintDepthRef = useRef<(() => number) | null>(null);

  // Measure + center on today in a single layout pass on mount.
  useLayoutEffect(() => {
    measure();
    scrollToIdx(TODAY_IDX, "auto");
    const onResize = () => { measure(); paintDepthRef.current?.(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measure, scrollToIdx]);

  // Scroll handling: rAF-throttled, zero DOM reads (pure math on cached
  // geometry) AND zero React re-renders while the finger is down. The depth
  // effect (fade + shrink of off-centre phones) is written straight to the
  // slide elements, so a swipe never re-renders the 11 mockups, the caption or
  // the CTAs — that mid-swipe render pass is what felt like a jam. React state
  // (`activeIdx` / `settledIdx`) is only updated once the scroll has settled.
  const lastHapticIdx = useRef(activeIdx);
  const rafRef = useRef(0);
  const settleTimer = useRef<number | null>(null);
  const [settledIdx, setSettledIdx] = useState(TODAY_IDX);

  const paintDepth = useCallback(() => {
    const el = scrollRef.current;
    const geom = geomRef.current;
    if (!el || !geom || geom.centers.length === 0) return -1;
    const center = el.scrollLeft + geom.viewport / 2;
    const step =
      geom.centers.length > 1
        ? Math.abs(geom.centers[1] - geom.centers[0]) || geom.viewport
        : geom.viewport;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < geom.centers.length; i++) {
      const dist = Math.abs(geom.centers[i] - center);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      const node = el.children[i] as HTMLElement | undefined;
      if (!node) continue;
      const d = Math.min(1, dist / step);
      node.style.opacity = String(1 - 0.68 * d);
      node.style.transform = `scale(${1 - 0.1 * d})`;
    }
    return bestIdx;
  }, []);
  paintDepthRef.current = paintDepth;


  const onScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const bestIdx = paintDepth();
      if (bestIdx < 0) return;
      if (bestIdx !== lastHapticIdx.current) {
        lastHapticIdx.current = bestIdx;
        haptic("soft");
      }
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => {
        setActiveIdx((prev) => (prev === bestIdx ? prev : bestIdx));
        setSettledIdx((prev) => (prev === bestIdx ? prev : bestIdx));
      }, 140);
    });
  }, [paintDepth]);

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
            // 30px top: the "Day X / 365" chip sits 24px above each frame, so
            // 22px let it ride up into the headline above.
            paddingBlock: "22px 8px",
            scrollPaddingInline: "32%",
            paddingInline: "32%",
            // Fixed, not a percentage: `6%` resolved against this track's own
            // content box (~130px) and collapsed to ~7px, so the phones read as
            // if they were touching. 16px is the breathing space, and Flutter
            // uses the exact same number.
            gap: "16px",
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
                  // Initial values only — `paintDepth()` keeps these in sync
                  // with the scroll position on every frame. No CSS transition
                  // here on purpose: a transition would chase the per-frame
                  // writes and smear the motion. The saturate() filter is gone
                  // too; animating a filter forced an extra GPU pass per frame.
                  opacity: isActive ? 1 : 0.32,
                  transform: isActive ? "scale(1)" : "scale(0.9)",
                  transformOrigin: "center",
                  willChange: "transform, opacity",
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
                  background: "hsl(var(--card))",
                  color: "hsl(var(--primary))",
                  border: "1.5px solid hsl(var(--primary) / 0.35)",
                  boxShadow: "none",
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
  const [giftSeen, setGiftSeen] = useState(() => { try { return localStorage.getItem("prayly_gift_seen_v1") === "1"; } catch { return true; } });
  const [showLifeCalendar, setShowLifeCalendar] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [showPrayerSetup, setShowPrayerSetup] = useState(false);
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
            <button
              type="button"
              aria-label="Life Calendar gift"
              title="Life Calendar"
              onClick={() => {
                haptic("soft");
                setShowLifeCalendar(true);
                if (!giftSeen) { setGiftSeen(true); try { localStorage.setItem("prayly_gift_seen_v1", "1"); } catch { /* storage blocked */ } }
              }}
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-primary-foreground shadow-[0_4px_14px_hsl(var(--primary)/0.45)] ring-1 ring-primary/50 transition-transform active:scale-90"
            >
              <Gift className="h-[22px] w-[22px]" strokeWidth={2.2} />
              {!giftSeen && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-background bg-destructive" />
                </span>
              )}
            </button>
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
        <PrayerAlarmToggles />

        {/* ParallaxRail is 524-line component. Lazy-loaded — reserve height
            so scroll doesn't jump when chunk resolves. */}
        <Suspense fallback={<div style={{ minHeight: 180 }} aria-hidden />}>
          <ParallaxRail />
        </Suspense>

        {/* 75 Days of Light — replaces the old Journey card. Height reserved so scroll does not jump. */}
        <Suspense fallback={<div className="mx-3 mb-6 h-[172px] rounded-[26px] border border-primary/20" aria-hidden />}>
          <ChallengeHomeCard />
        </Suspense>

        {/* Below-fold: lazy chunk. Placeholder holds space so LCP is stable. */}
        <Suspense fallback={<div className="min-h-24" aria-hidden />}>
          <PrayScreenFeatureCard />
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
        {showLifeCalendar && <LifeCalendarPreview open={showLifeCalendar} onOpenChange={setShowLifeCalendar} />}
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
