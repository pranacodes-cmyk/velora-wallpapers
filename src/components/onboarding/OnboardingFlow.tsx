import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig, PanInfo } from "framer-motion";
import { OnboardingContext } from "@/contexts/OnboardingContext";
import { useT } from "@/i18n";
import { haptic } from "@/utils/haptics";
import LanguageSlide, { ONB_LANG_PICKED_KEY } from "./LanguageSlide";
import {
  IS_ANDROID,
  ONB_REPEAT,
  ONB_NAV_LOCK_MS,
  ONB_SLIDE_FADE_SECONDS,
  ONB_PRESENCE_MODE,
  ONB_SLIDE_EXIT,
  ONB_IN_DELAY,
  ONB_IN_DUR,
  ONB_STAGGER,
  headlineStyle,
  goldSpan,
  hapticAfterPaint,
  appLogo,
  divineBgDark,
  bgSunrise,
  bgOcean,
  bgClouds,
  devotionalBg,
} from "./onboardingShared";

/**
 * First-launch onboarding — PrayScreen story, core faith experiences, then personal focus.
 * Unskippable. Gated by localStorage["cw_onboarded_v1"].
 *
 * Later Prayer and Focus slides live in
 * `./OnboardingLateSlides` and load as a separate chunk — keeps first-paint
 * JS parse cost small on low-end Android devices.
 */

const ONBOARDING_KEY = "cw_onboarded_v3";
export const REDO_ONBOARDING_EVENT = "prayly-redo-onboarding";
export const ONBOARDING_REPLAY_KEY = "cw_onboarding_replay_active";
export const POST_ONBOARDING_FLOW_COMPLETE_EVENT = "prayly-post-onboarding-flow-complete";

// Lazy-loaded late slides. Chunk is prefetched when the user reaches slide 1.
const PrayerSlide = lazy(() =>
  import("./OnboardingLateSlides").then((m) => ({ default: m.PrayerSlide })),
);
const RhythmSlide = lazy(() =>
  import("./OnboardingLateSlides").then((m) => ({ default: m.RhythmSlide })),
);
const BibleSlide = lazy(() =>
  import("./BibleSlide").then((m) => ({ default: m.BibleSlide })),
);
const SocialProofSlide = lazy(() =>
  import("./OnboardingLateSlides").then((m) => ({ default: m.SocialProofSlide })),
);

function prefetchLateSlides() {
  void import("./OnboardingLateSlides").catch(() => { /* ignore */ });
}

function shouldShowOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ONBOARDING_KEY) !== "true";
  } catch {
    return false;
  }
}

function markComplete() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "true");
    localStorage.setItem("cw_onboarded_v3_at", String(Date.now()));
  } catch {}
}

const onboardingImageSources = [appLogo, bgSunrise, bgOcean, bgClouds, devotionalBg].filter(Boolean);




// =============================================================================
// PHONE LOCK-SCREEN MOCK — shows the daily verse wallpaper in situ
// =============================================================================
function LockScreenMock() {
  const { t } = useT();
  // Fixed mockup time — feels intentional and matches Apple marketing convention
  const hh = "10";
  const mm = "08";

  // Rotating verse + background pairs — each scripture gets a thematically
  // matched scene, proving the "fresh every morning" promise visually.
  const pairs = useMemo(
    () => [
      { text: t("onb.lock.verse1Text"), reference: t("onb.lock.verse1Ref"), bg: bgSunrise },
      { text: t("onb.lock.verse2Text"), reference: t("onb.lock.verse2Ref"), bg: bgOcean },
      { text: t("onb.lock.verse3Text"), reference: t("onb.lock.verse3Ref"), bg: bgClouds },
      { text: t("onb.lock.verse4Text"), reference: t("onb.lock.verse4Ref"), bg: bgSunrise },
    ],
    [t]
  );
  const [vIdx, setVIdx] = useState(0);
  // Only mount wallpapers we have already shown (+ the next one). Mounting all
  // four at once made the WebView decode 3 full-screen images while the slide
  // was still animating in — the exact stall users felt on slides 1-3.
  const [mountCount, setMountCount] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setVIdx((i) => (i + 1) % pairs.length), 3600);
    return () => clearInterval(id);
  }, [pairs.length]);
  useEffect(() => {
    setMountCount((c) => Math.max(c, Math.min(pairs.length, vIdx + 2)));
  }, [vIdx, pairs.length]);
  const current = pairs[vIdx];

  return (
    <div
      className="relative mx-auto"
      style={{
        // Restored to the original slimmer lock-screen proportion — this slide
        // was already visually balanced and should not inherit permission-slide sizing.
        width: 200,
        height: 400,
        borderRadius: 38,
        padding: 4,
        background:
          "linear-gradient(160deg, hsl(220 10% 38%) 0%, hsl(220 15% 10%) 50%, hsl(220 10% 30%) 100%)",
        // A 80px-blur shadow over a full-screen background is one of the most
        // expensive things a mid-range Android WebView can paint. Keep the
        // depth cue, shrink the blur radius on Android.
        boxShadow: IS_ANDROID
          ? "0 14px 26px -14px hsl(0 0% 0% / 0.9), 0 0 0 1px hsl(0 0% 100% / 0.06)"
          : "0 40px 80px -25px hsl(0 0% 0% / 0.85), 0 0 0 1px hsl(0 0% 100% / 0.06)",
      }}
    >
      <div
        className="relative w-full h-full overflow-hidden"
        style={{ borderRadius: 34, background: "hsl(220 60% 6%)" }}
      >
        {/* Cross-fading wallpapers — stacked <img> with pure CSS opacity.
            No mount/unmount = no decode + paint jank on every verse swap. */}
        {pairs.slice(0, mountCount).map((p, i) => (
          <img
            key={`${p.bg}-${i}`}
            src={p.bg}
            alt=""
            aria-hidden
            decoding="async"
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "low"}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: i === vIdx ? 1 : 0,
              transition: "opacity 550ms ease-out",
              willChange: "opacity",
            }}
          />
        ))}

        <div
          className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, hsl(220 50% 4% / 0.35) 55%, hsl(220 60% 3% / 0.78) 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, hsl(0 0% 0% / 0.55) 0%, transparent 100%)",
          }}
        />
        <div
          className="absolute top-1.5 left-1/2 -translate-x-1/2"
          style={{ width: 64, height: 17, borderRadius: 999, background: "hsl(0 0% 0%)" }}
        />
        <div className="absolute inset-x-0 top-7 flex flex-col items-center">
          <div
            className="text-[10px] font-medium tracking-[0.1em] uppercase"
            style={{ color: "hsl(0 0% 100% / 0.78)" }}
          >
            {t("onb.lock.today")}
          </div>
          <div
            className="text-[60px] font-light leading-none mt-0.5"
            style={{
              color: "hsl(0 0% 100%)",
              fontFamily: "'SF Pro Display', -apple-system, system-ui, sans-serif",
              fontVariantNumeric: "tabular-nums",
              textShadow: "0 2px 12px hsl(0 0% 0% / 0.5)",
            }}
          >
            {hh}:{mm}
          </div>
        </div>

        {/* Verse glass card — directly below the time */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-3 right-3 rounded-2xl px-3.5 py-3 overflow-hidden"
          style={{
            top: 116,
            background:
              "linear-gradient(165deg, hsl(220 40% 12% / 0.55) 0%, hsl(220 50% 8% / 0.72) 100%)",
            border: "1px solid hsl(42 60% 50% / 0.26)",
            boxShadow:
              "0 12px 30px -10px hsl(0 0% 0% / 0.7), inset 0 1px 0 hsl(0 0% 100% / 0.06)",
            minHeight: 84,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current.reference}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: ONB_IN_DUR, ease: "easeOut" }}
              
            >
              <p
                className="text-center text-[10px] leading-[1.45] font-light italic"
                style={{ color: "hsl(40 25% 95%)", fontFamily: "'Georgia', serif" }}
              >
                "{current.text}"
              </p>
              <p
                className="text-center text-[7.5px] mt-1.5 font-bold tracking-[0.3em] uppercase"
                style={{ color: "hsl(42 78% 66%)" }}
              >
                — {current.reference}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* "New every morning" badge — wrapper handles centering so framer-motion's
            transforms don't override -translate-x-1/2. */}
        <div
          className="absolute left-0 right-0 flex justify-center px-3 pointer-events-none"
          style={{ bottom: "22%" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
            className="flex items-center gap-1 rounded-full px-2 py-[3px] whitespace-nowrap pointer-events-auto"
            style={{
              background: "hsl(42 80% 50% / 0.22)",
              border: "1px solid hsl(42 80% 60% / 0.5)",
              boxShadow: "0 6px 18px -6px hsl(42 90% 50% / 0.5)",
            }}
          >
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.8, repeat: ONB_REPEAT, ease: "easeInOut" }}
              className="w-[3px] h-[3px] rounded-full shrink-0"
              style={{ background: "hsl(42 95% 65%)", boxShadow: "0 0 5px hsl(42 95% 65%)" }}
            />
            <span
              className="text-[6px] font-bold tracking-[0.14em] uppercase"
              style={{ color: "hsl(42 90% 82%)" }}
            >
              {t("onb.lock.badge")}
            </span>
          </motion.div>
        </div>





        <div
          className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full"
          style={{ width: 74, height: 3, background: "hsl(0 0% 100% / 0.6)" }}
        />
      </div>

      <motion.div
        animate={{ opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 5, repeat: ONB_REPEAT, ease: "easeInOut" }}
        className="absolute -inset-10 -z-10 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(42 85% 55% / 0.35) 0%, transparent 65%)",
        }}
      />
    </div>
  );
}

// =============================================================================
// SLIDE 1 — Daily Verse (now showcases lock-screen wallpaper)
// =============================================================================
function VerseSlide({ active, exiting }: { active: boolean; exiting?: boolean }) {
  const { t } = useT();
  if (!active) return null;


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      exit={ONB_SLIDE_EXIT}
      transition={{ duration: ONB_SLIDE_FADE_SECONDS, ease: "easeOut" }}
      className="onb-slide-layer absolute inset-0 flex flex-col items-center justify-center"
    >
      {/* Atmospheric bg — matches the PrayScreen story slides so the flow feels continuous */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_78%_52%_at_50%_38%,hsl(var(--primary)/0.13),transparent_72%)]" />
      <div className="absolute inset-x-0 top-0 h-[42%] bg-[linear-gradient(180deg,hsl(var(--accent)/0.16),transparent)]" />


      <div className="relative z-10 flex max-h-full w-full flex-col items-center overflow-y-auto px-6 pb-36 pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Kicker */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.75, y: 0 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
          className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.34em] text-primary"
        >
          {t("onb.verse.kicker")}
        </motion.p>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
          className="mb-4 px-2 text-center text-[clamp(21px,3.4svh,27px)] font-bold leading-[1.16]"
          style={headlineStyle}
        >
          {t("onb.verse.headlinePre")}<br />
          <span style={goldSpan}>{t("onb.verse.headlineGold")}</span>
        </motion.h2>

        {/* Phone lock-screen mock — auto-scales on short viewports so it never overflows */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
          style={{
            transform: "scale(clamp(0.65, calc((100dvh - 320px) / 480), 1))",
            transformOrigin: "center top",
          }}
        >
          <LockScreenMock />
        </motion.div>

        {/* Subcopy */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
          className="mt-3 text-center text-[12.5px] leading-[1.5] max-w-[290px]"
          style={{ color: "hsl(40 22% 82%)" }}
        >
          {t("onb.verse.subcopy")}
        </motion.p>
      </div>
    </motion.div>
  );
}

// =============================================================================
// SLIDE 3 — Daily Bible Prayer (replaces wallpaper showcase)
// =============================================================================

// =============================================================================
// MAIN
// =============================================================================
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [active, setActive] = useState(() => shouldShowOnboarding());
  // Step 0 — language picker. Shown before the narrative slides so every
  // slide after it is already in the user's own language.
  const [langPicked, setLangPicked] = useState(() => {
    try { return !!localStorage.getItem(ONB_LANG_PICKED_KEY); } catch { return true; }
  });
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [closing, setClosing] = useState(false);
  const navLockedRef = useRef(false);
  const navUnlockTimerRef = useRef<number | null>(null);
  const isReplayRef = useRef(false);
  const closingRef = useRef(false);
  useEffect(() => { closingRef.current = closing; }, [closing]);

  // Settings can replay the full tour without clearing favorites, streaks,
  // theme, language, or premium entitlement. Keep the chosen language so the
  // replay starts immediately in the language the user already selected.
  useEffect(() => {
    const replay = () => {
      try {
        localStorage.removeItem(ONBOARDING_KEY);
        localStorage.removeItem("cw_onboarded_v3_at");
        localStorage.removeItem("cw_post_onboarding_premium_shown");
        localStorage.setItem(ONBOARDING_REPLAY_KEY, "1");
      } catch {}
      setStep(0);
      setExiting(false);
      setClosing(false);
      setLangPicked(true);
      isReplayRef.current = true;
      setActive(true);
    };
    window.addEventListener(REDO_ONBOARDING_EVENT, replay);
    return () => window.removeEventListener(REDO_ONBOARDING_EVENT, replay);
  }, []);

  // Keep the app shell completely unmounted through the trial animation and
  // Premium sheet. The handoff owns the screen until the sheet is dismissed,
  // so Today can never paint for a frame between these three surfaces.
  useEffect(() => {
    const completeHandoff = () => {
      // Ignore stray handoffs (e.g. the paywall unmounting as a replay
      // starts) — only a finishing onboarding may be released.
      if (!closingRef.current) return;
      setActive(false);
      setClosing(false);
    };
    window.addEventListener(POST_ONBOARDING_FLOW_COMPLETE_EVENT, completeHandoff);
    return () => window.removeEventListener(POST_ONBOARDING_FLOW_COMPLETE_EVENT, completeHandoff);
  }, []);

  // Hard failsafe: the overlay must never outlive the post-onboarding flow.
  // If the handoff event never arrives (overlay lock never resolves, paywall
  // chunk fails to load, purchase edge case), release the screen anyway.
  useEffect(() => {
    if (!active || !closing) return;
    const timer = window.setTimeout(() => {
      setActive(false);
      setClosing(false);
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [active, closing]);

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      if (navUnlockTimerRef.current !== null) {
        window.clearTimeout(navUnlockTimerRef.current);
        navUnlockTimerRef.current = null;
      }
    };
  }, [active]);

  // Decode at most the next visual, never the whole onboarding sequence. This
  // keeps a swipe instant without competing with the current slide animation.
  useEffect(() => {
    if (!active) return;
    const src = onboardingImageSources[Math.min(step + 1, onboardingImageSources.length - 1)];
    if (!src) return;
    const timer = window.setTimeout(() => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }, IS_ANDROID ? 700 : 300);
    return () => window.clearTimeout(timer);
  }, [active, step]);


  // Per-step tracking so we can see exactly where users drop off.
  useEffect(() => {
    if (!active) return;
    import("@/services/analytics")
      .then((a) => a.track("onboarding_step_viewed", { step }))
      .catch(() => {});
  }, [active, step]);

  // Fetch late slides only when they are one step away. Startup idle time is
  // reserved for the image the user is about to see.
  useEffect(() => {
    if (!active) return;
    if (step >= 0) {
      prefetchLateSlides();
    }
  }, [active, step]);




  if (!active) {
    return (
      <OnboardingContext.Provider value={{ isOnboardingActive: false }}>
        {children}
      </OnboardingContext.Provider>
    );
  }

  // Step 0: language. Rendered on its own (no progress dots / CTA chrome) so
  // the first thing a new user sees is their own language, one tap away.
  if (!langPicked) {
    return (
      <OnboardingContext.Provider value={{ isOnboardingActive: true }}>
        {children}
        <div className="fixed inset-0 z-[9997]" style={{ background: "hsl(220 65% 4%)" }} />
        <div
          className="onboarding-theme fixed inset-0 z-[9998] overflow-hidden select-none"
          data-onboarding="active"
          style={{ background: "hsl(220 65% 4%)" }}
        >
          <LanguageSlide onDone={() => setLangPicked(true)} />
        </div>
      </OnboardingContext.Provider>
    );
  }



  // Verse, Prayer, Rhythm, opt-in classic alarm, Journeys, social proof.
  // Alarm scheduling happens only after an explicit toggle/time selection.
  // The old "what's your name" slide has been removed too: it served no feature
  // (name is optional everywhere and editable in Settings) and ~30% of users
  // dropped there. Focus is now the final step.
  const totalSlides = 5;
  const lastStep = totalSlides - 1;
  const isFinale = step >= lastStep;

  // Nothing is gated any more — the last slide is social proof.
  const canAdvance = true;


  const advanceRaw = () => {
    if (navLockedRef.current) return;
    if (step < lastStep) {
      if (step === 2) {
        // Rhythm choice (Morning / Evening / Both) is the alarm opt-in.
        let slot = "both";
        try { slot = localStorage.getItem("prayly_daily_reminder_slots_v1") || "both"; } catch { /* ignore */ }
        void import("@/hooks/usePrayerAlarms").then((m) => m.armPrayerAlarmsFromRhythm(slot)).catch(() => {});
      }
      navLockedRef.current = true;
      setStep((s) => s + 1);
      navUnlockTimerRef.current = window.setTimeout(() => {
        navLockedRef.current = false;
        navUnlockTimerRef.current = null;
      }, ONB_NAV_LOCK_MS);
    }
  };

  const advance = () => {
    if (navLockedRef.current || closing) return;
    if (!canAdvance) {
      haptic("soft");
      return;
    }
    advanceRaw();
    hapticAfterPaint("soft");
  };

  const finish = () => {
    if (closing) return;
    hapticAfterPaint("medium");
    setClosing(true);
    markComplete();
    // Analytics: onboarding completed
    import("@/services/analytics").then((a) => a.track("onboarding_completed")).catch(() => {});
    const replay = isReplayRef.current;
    // The onboarding screen stays mounted beneath the entire transition and
    // Premium sheet. PostOnboardingPremium releases it only after the sheet
    // closes (or immediately when no offer should be shown).
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("onboarding-complete", {
        detail: { replay },
      }));
      isReplayRef.current = false;
    });

  };


  const goBack = () => {
    if (navLockedRef.current || closing) return;
    // Step 0 goes back to the language picker — it is the first onboarding step.
    if (step === 0) {
      setLangPicked(false);
      hapticAfterPaint("soft");
      return;
    }
    navLockedRef.current = true;
    setStep((s) => Math.max(0, s - 1));
    navUnlockTimerRef.current = window.setTimeout(() => {
      navLockedRef.current = false;
      navUnlockTimerRef.current = null;
    }, ONB_NAV_LOCK_MS);
    hapticAfterPaint("soft");
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -250) {
      if (isFinale) finish();
      else advance();
    } else if (info.offset.x > 60 || info.velocity.x > 250) {
      goBack();
    }
  };

  return (
    <OnboardingContext.Provider value={{ isOnboardingActive: true }}>
      {children}

      <div
        className="fixed inset-0 z-[9997]"
        style={{ background: "hsl(220 65% 4%)" }}
      />

      {/* On Android WebView, Framer animates transforms by writing inline
          styles from JS every frame. With ~70 motion nodes per slide that is
          pure main-thread work and it collides with taps. `reducedMotion`
          snaps transforms to their end value and keeps only opacity fades —
          same look, no per-frame transform math. */}
      <MotionConfig reducedMotion={IS_ANDROID ? "always" : "user"}>
      <AnimatePresence>
        {active && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
            className="onboarding-theme fixed inset-0 z-[9998] overflow-hidden select-none"
            data-onboarding="active"
            style={{ background: "hsl(220 65% 4%)" }}
          >
            <style>{`
              @keyframes onb-gold-sweep {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }

              .onb-lock-status { font-size: clamp(4.8px, 6.1cqw, 10px); }
              .onb-lock-cross { width: clamp(26px, 34cqw, 56px); height: clamp(26px, 34cqw, 56px); }
              .onb-lock-label { font-size: clamp(5.4px, 6.1cqw, 10px); }
              .onb-lock-time { font-size: clamp(22px, 27cqw, 46px); }
              .onb-lock-subtitle { font-size: clamp(7px, 7.3cqw, 12px); }
              .onb-lock-action { min-height: clamp(17px, 16cqw, 34px); font-size: clamp(6px, 6.9cqw, 11.5px); padding: 0 clamp(8px, 7cqw, 14px); }
              .onb-notif-date { font-size: clamp(5.4px, 6.6cqw, 11px); }
              .onb-notif-time { font-size: clamp(26px, 32cqw, 56px); }
              .onb-notif-icon { width: clamp(18px, 21cqw, 36px); height: clamp(18px, 21cqw, 36px); }
              .onb-notif-kicker { font-size: clamp(4.8px, 5cqw, 8.5px); }
              .onb-notif-now { font-size: clamp(4.5px, 4.8cqw, 8px); }
              .onb-notif-title { font-size: clamp(6px, 6.2cqw, 10.5px); }
              .onb-notif-body { font-size: clamp(5.3px, 5.4cqw, 9px); }

              /* === Time-selection phase — FLUID =============================
                 Same intrinsic-responsive treatment as the permission phase:
                 header, eyebrow, title, alarm mockup, caption, prompt,
                 option cards, and skip link all scale via clamp() + svh so
                 nothing overlaps the bottom CTA on short screens — no hard
                 breakpoint snaps. */
              .onb-time-content { padding-left: clamp(14px, 4vw, 22px) !important; padding-right: clamp(14px, 4vw, 22px) !important; }
              .onb-time-header { margin-top: clamp(18px, 4svh, 44px) !important; }
              .onb-time-eyebrow { font-size: clamp(8px, 1.1svh, 10px) !important; letter-spacing: clamp(0.28em, 0.4svh, 0.4em) !important; }
              .onb-time-title { font-size: clamp(15px, 2.4svh, 22px) !important; margin-top: clamp(4px, 0.8svh, 9px) !important; line-height: 1.2 !important; }
              .onb-time-mockup { margin-top: clamp(6px, 1.4svh, 14px) !important; margin-bottom: clamp(6px, 1.4svh, 14px) !important; }
              .onb-alarm-phone { width: clamp(108px, 19svh, 180px) !important; border-radius: clamp(22px, 3.4svh, 32px) !important; padding: 3px !important; }
              .onb-alarm-phone > div { border-radius: clamp(17px, 2.8svh, 27px) !important; }
              .onb-alarm-caption { margin-top: clamp(5px, 1.2svh, 12px) !important; gap: clamp(2px, 0.5svh, 6px) !important; }
              .onb-alarm-caption p { font-size: clamp(10px, 1.4svh, 12.5px) !important; line-height: 1.35 !important; }
              .onb-time-options { margin-top: clamp(0px, 0.4svh, 6px) !important; }
              .onb-time-prompt { font-size: clamp(10px, 1.4svh, 12px) !important; margin-bottom: clamp(6px, 1.2svh, 12px) !important; }
              .onb-time-option-card { padding-top: clamp(7px, 1.4svh, 14px) !important; padding-bottom: clamp(7px, 1.4svh, 14px) !important; border-radius: clamp(16px, 2.4svh, 22px) !important; gap: clamp(2px, 0.5svh, 5px) !important; }
              .onb-time-option-emoji { font-size: clamp(17px, 2.6svh, 24px) !important; }
              .onb-time-option-sub { font-size: clamp(7.5px, 1.05svh, 9.5px) !important; line-height: 1.25 !important; }
              .onb-time-skip { margin-top: clamp(7px, 1.4svh, 14px) !important; font-size: clamp(10px, 1.3svh, 12px) !important; }
              /* Last-resort hide on extreme short screens (split-screen) */
              @media (max-height: 520px) {
                .onb-time-title { display: none !important; }
                .onb-alarm-caption p { display: none !important; }
                .onb-time-option-sub { display: none !important; }
                .onb-time-skip { display: none !important; }
              }


              /* === Permission phase — FLUID (intrinsic responsive) =========
                 Whole slide scales mathematically against svh so on short
                 screens (S25, foldables, browser-chrome-heavy Androids) the
                 header, mockup, body, steps card, CTA, and "Maybe later" all
                 shrink together — no overlap, no clipped CTA, no hard
                 breakpoint snaps. Scoped to the permission phase via
                 :has(.onb-perm-mock) so the time-selection slide is
                 unaffected. */
              .onb-time-content:has(.onb-perm-mock) {
                padding-left: clamp(14px, 4vw, 22px) !important;
                padding-right: clamp(14px, 4vw, 22px) !important;
              }
              .onb-time-content:has(.onb-perm-mock) .onb-time-header {
                margin-top: clamp(18px, 4svh, 44px) !important;
              }
              .onb-time-content:has(.onb-perm-mock) .onb-time-eyebrow {
                font-size: clamp(8px, 1.1svh, 10px) !important;
                letter-spacing: clamp(0.28em, 0.4svh, 0.4em) !important;
              }
              .onb-time-content:has(.onb-perm-mock) .onb-time-title {
                font-size: clamp(15px, 2.4svh, 22px) !important;
                margin-top: clamp(4px, 0.8svh, 9px) !important;
                line-height: 1.2 !important;
              }
              .onb-time-content:has(.onb-perm-mock) .onb-time-mockup {
                margin-top: clamp(6px, 1.4svh, 14px) !important;
                margin-bottom: clamp(6px, 1.4svh, 14px) !important;
              }
              .onb-time-mockup .onb-perm-mock .onb-alarm-phone {
                width: clamp(104px, 18svh, 168px) !important;
                border-radius: clamp(22px, 3.4svh, 32px) !important;
                padding: 3px !important;
              }
              .onb-time-mockup .onb-perm-mock .onb-alarm-phone > div {
                border-radius: clamp(17px, 2.8svh, 27px) !important;
              }
              .onb-perm-body {
                font-size: clamp(10px, 1.5svh, 13px) !important;
                line-height: 1.45 !important;
                max-width: min(320px, 86vw) !important;
              }
              .onb-perm-steps {
                margin-top: clamp(6px, 1.4svh, 14px) !important;
                padding: clamp(6px, 1.1svh, 11px) clamp(10px, 2.6vw, 16px) !important;
                max-width: min(340px, 92vw) !important;
              }
              .onb-perm-steps p {
                font-size: clamp(9px, 1.25svh, 11.5px) !important;
                line-height: 1.35 !important;
              }
              .onb-perm-step {
                padding-top: clamp(2px, 0.5svh, 5px) !important;
                padding-bottom: clamp(2px, 0.5svh, 5px) !important;
              }
              .onb-perm-cta {
                margin-top: clamp(7px, 1.4svh, 14px) !important;
                padding-top: clamp(9px, 1.4svh, 14px) !important;
                padding-bottom: clamp(9px, 1.4svh, 14px) !important;
                font-size: clamp(11.5px, 1.6svh, 14px) !important;
                max-width: min(340px, 92vw) !important;
              }
              .onb-perm-later {
                margin-top: clamp(4px, 0.9svh, 10px) !important;
                font-size: clamp(9.5px, 1.3svh, 12px) !important;
              }
              /* Extreme short-screen last resort (split-screen / landscape) */
              @media (max-height: 520px) {
                .onb-time-content:has(.onb-perm-mock) .onb-time-title { display: none !important; }
                .onb-perm-body { display: none !important; }
                .onb-perm-steps .onb-perm-step:not(:first-child) { display: none !important; }
              }
            `}</style>


            {/* Android: detect the swipe with a pan gesture instead of `drag`.
                `drag` physically moves the whole full-screen slide subtree, so
                every few pixels of finger travel re-measured and re-painted the
                entire tree — even on a plain tap. Pan reads the same gesture
                with zero layout work. Web/iOS keep the rubber-band drag. */}
            <motion.div
              {...(IS_ANDROID
                ? { onPanEnd: handleDragEnd }
                : {
                    drag: "x" as const,
                    dragConstraints: { left: 0, right: 0 },
                    dragElastic: 0.15,
                    onDragEnd: handleDragEnd,
                  })}
              className="absolute inset-0"
            >

              {/* Suspense wraps AnimatePresence because the late Prayer and Focus slides are
                  React.lazy(). Chunk is prefetched on step 0/1 so Suspense
                  should never actually suspend in practice — fallback=null
                  is a defensive safety net for the cold-cache first-run. */}
              <Suspense fallback={null}>
              <AnimatePresence initial={false} mode={ONB_PRESENCE_MODE}>
{/* Android uses mode="wait" — old slide unmounts before new mounts so we never
    paint two heavy Framer trees at once (the actual source of the "glitchy" feel
    on Adreno/Mali). Web/iOS keeps the smoother crossfade via mode="sync". */}
                {step === 0 && <VerseSlide key="s3" active exiting={exiting} />}
                {step === 1 && <PrayerSlide key="s4" active exiting={exiting} />}
                {step === 2 && <RhythmSlide key="rh" active exiting={exiting} />}
                {step === 3 && <BibleSlide key="bible" active exiting={exiting} />}
                {step === 4 && <SocialProofSlide key="s5" active exiting={exiting} />}
              </AnimatePresence>
              </Suspense>

            </motion.div>

            {/* Bottom CTA */}
            <div
              className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center gap-3 px-8"
              hidden={closing}
              style={{
                paddingBottom: "max(env(safe-area-inset-bottom), 28px)",
                paddingTop: 16,
                background:
                  "linear-gradient(180deg, transparent 0%, hsl(220 65% 4% / 0.6) 40%, hsl(220 65% 4%) 100%)",
              }}
            >
              <motion.button
                /* No per-step key: the button stays mounted across slides so it
                   never re-runs its fade-up (that replay is what made every
                   Continue tap feel like the UI froze for a beat). */

                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: ONB_IN_DUR, delay: ONB_IN_DELAY, ease: [0.22, 1, 0.36, 1] }}
                whileTap={{ scale: canAdvance ? 0.97 : 1 }}
                onClick={isFinale ? () => finish() : advance}
                disabled={!canAdvance}
                className="relative w-full max-w-[360px] h-[56px] rounded-full font-bold text-[15px] tracking-[0.06em] overflow-hidden transition-opacity"
                style={{
                  background: canAdvance
                    ? "linear-gradient(105deg, hsl(42 85% 50%) 0%, hsl(38 100% 65%) 50%, hsl(42 85% 50%) 100%)"
                    : "linear-gradient(105deg, hsl(220 25% 22%), hsl(220 25% 18%))",
                  backgroundSize: "200% 100%",
                  animation: canAdvance && !IS_ANDROID ? "onb-gold-sweep 1.6s ease-out 1 both" : "none",
                  color: canAdvance ? "hsl(220 65% 8%)" : "hsl(40 15% 60%)",
                  boxShadow: canAdvance
                    ? "0 12px 32px -8px hsl(42 85% 50% / 0.5), 0 0 0 1px hsl(42 90% 70% / 0.4) inset, 0 1px 0 hsl(42 100% 85% / 0.5) inset"
                    : "0 4px 12px -4px hsl(0 0% 0% / 0.4)",
                  fontFamily: "'SF Pro Display', 'Inter', system-ui, sans-serif",
                  opacity: canAdvance ? 1 : 0.6,
                }}
              >
                {isFinale ? t("onb.cta.begin") : t("onb.cta.continue")}
              </motion.button>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ duration: ONB_IN_DUR, delay: 0.15 }}
                className="text-[10px] tracking-[0.3em] uppercase font-semibold"
                style={{ color: "hsl(40 20% 65%)" }}
              >
                {isFinale ? t("onb.cta.tapToEnter") : t("onb.cta.swipeOrTap")}
              </motion.p>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
      </MotionConfig>

    </OnboardingContext.Provider>
  );
}
