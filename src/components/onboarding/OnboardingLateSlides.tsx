// Lazy-loaded onboarding slides for Prayer and personal Focus.
// This chunk is only fetched/parsed after slide 1 — keeps the initial JS parse
// (and first-paint cost of OnboardingFlow) small on low-end Android.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";
import PrayerAlarm from "@/plugins/prayer-alarm";
import { setUserTime, type UserTime } from "@/lib/userProfile";
import {
  IS_ANDROID,
  ONB_REPEAT,
  ONB_BLUR_14,
  ONB_SLIDE_FADE_SECONDS,
  ONB_BG_INITIAL,
  onbBgAnimate,
  onbBgTransition,
  ONB_SLIDE_EXIT,
  ONB_IN_DELAY,
  ONB_IN_DUR,
  ONB_STAGGER,
  headlineStyle,
  goldSpan,
  devotionalBg,
  divineBgDark,
  appLogo,
  seedPrayerTimes,
  PRAYER_SEED_KEY,
} from "./onboardingShared";
import { BookOpen, HandHeart, Users } from "lucide-react";
import { VoyagePoster } from "@/components/challenge/VoyagePoster";

export function PrayerSlide({ active, exiting }: { active: boolean; exiting?: boolean }) {
  const { t } = useT();
  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      exit={ONB_SLIDE_EXIT}
      transition={{ duration: ONB_SLIDE_FADE_SECONDS, ease: "easeOut" }}
      className="onb-slide-layer absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Warm prayer background */}
      <motion.img
        src={devotionalBg}
        alt=""
        initial={ONB_BG_INITIAL}
        animate={onbBgAnimate(exiting)}
        transition={onbBgTransition(exiting)}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, hsl(220 50% 6% / 0.55) 0%, hsl(220 55% 6% / 0.78) 55%, hsl(220 65% 4%) 100%)",
        }}
      />

      {/* Golden halo */}
      <motion.div
        animate={{ opacity: [0.25, 0.45, 0.25], scale: [1, 1.08, 1] }}
        transition={{ duration: 5, repeat: ONB_REPEAT, ease: "easeInOut" }}
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 380,
          height: 380,
          top: "30%",
          background:
            "radial-gradient(circle, hsl(42 85% 55% / 0.28) 0%, transparent 65%)",
        }}
      />

      {/* Scrollable, height-adaptive column (Flutter twin: SingleChildScrollView + Center) */}
      <div className="relative z-10 flex max-h-full w-full flex-col items-center overflow-y-auto px-8 pb-36 pt-[max(env(safe-area-inset-top),44px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-full max-w-[420px] flex-col items-center">

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.85, y: 0 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
          className="text-[10px] font-bold tracking-[0.4em] uppercase mb-3"
          style={{ color: "hsl(42 75% 60%)" }}
        >
          {t("onb.prayer.kicker")}
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-[26px] leading-[1.18] font-bold mb-3"
          style={headlineStyle}
        >
          {t("onb.prayer.headlinePre")}
          <br />
          <span style={goldSpan}>{t("onb.prayer.headlineGold")}</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
          className="text-center text-[13px] leading-[1.55] mb-6 max-w-[320px]"
          style={{ color: "hsl(40 22% 80%)" }}
        >
          {t("onb.prayer.subcopy")}
        </motion.p>

        {/* Narrative bridge: the same Shield from the PrayScreen slides now
            opens into the daily prayer. */}
        <motion.div
          initial={{ opacity: 0, scaleY: 0.4 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
          className="mb-3.5 mt-1 flex flex-col items-center"
          style={{ transformOrigin: "top" }}
        >
          <span className="block h-[18px] w-px" style={{ background: "linear-gradient(180deg, hsl(42 85% 58% / 0), hsl(42 85% 58% / 0.55))" }} />
          <span
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
            style={{
              background: "hsl(42 85% 58% / 0.1)",
              border: "1px solid hsl(42 85% 58% / 0.42)",
              boxShadow: "0 0 22px 4px hsl(42 85% 58% / 0.16)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="hsl(42 85% 58%)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </span>
          <span className="block h-[18px] w-px" style={{ background: "linear-gradient(180deg, hsl(42 85% 58% / 0.55), hsl(42 85% 58% / 0))" }} />
        </motion.div>

        {/* Prayer card with audio narration cue */}
        <motion.div


          initial={{ opacity: 0, y: 26, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full rounded-2xl px-5 py-5"
          style={{
            background:
              "linear-gradient(165deg, hsl(220 45% 14% / 0.85) 0%, hsl(220 55% 8% / 0.95) 100%)",
            border: "1px solid hsl(42 60% 50% / 0.22)",
            boxShadow:
              "0 30px 60px -20px hsl(0 0% 0% / 0.8), 0 0 50px -10px hsl(42 85% 55% / 0.18), inset 0 1px 0 hsl(0 0% 100% / 0.05)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 38,
                height: 38,
                background:
                  "linear-gradient(135deg, hsl(42 85% 55% / 0.22), hsl(42 85% 45% / 0.05))",
                border: "1px solid hsl(42 70% 55% / 0.3)",
              }}
            >
              <svg width="13" height="18" viewBox="0 0 14 20" fill="none">
                <rect x="5" y="0" width="4" height="20" rx="1" fill="hsl(42 85% 62%)" />
                <rect x="0" y="5" width="14" height="4" rx="1" fill="hsl(42 85% 62%)" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[9.5px] font-bold tracking-[0.22em] uppercase"
                style={{ color: "hsl(42 75% 62%)" }}
              >
                {t("onb.prayer.cardKicker")}
              </p>
              <p className="text-[14px] font-bold mt-0.5" style={{ color: "hsl(40 25% 95%)" }}>
                {t("onb.prayer.cardTitle")}
              </p>
            </div>
            <span
              className="text-[9px] font-bold px-2 py-1 rounded-full"
              style={{
                color: "hsl(42 85% 70%)",
                background: "hsl(42 70% 55% / 0.12)",
                border: "1px solid hsl(42 60% 50% / 0.3)",
              }}
            >
              {t("onb.prayer.badgeNew")}
            </span>
          </div>

          <p
            className="text-[13.5px] leading-[1.6] italic"
            style={{
              color: "hsl(40 22% 88%)",
              fontFamily: "'Georgia', serif",
            }}
          >
            {t("onb.prayer.quote")}
          </p>

          {/* Narration row */}
          <div
            className="flex items-center gap-3 mt-4 pt-3"
            style={{ borderTop: "1px solid hsl(42 60% 50% / 0.15)" }}
          >
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{
                width: 32,
                height: 32,
                background:
                  "linear-gradient(135deg, hsl(42 90% 60%), hsl(38 100% 70%))",
                boxShadow: "0 6px 16px -4px hsl(42 85% 50% / 0.5)",
              }}
            >
              <svg width="10" height="12" viewBox="0 0 11 13" fill="none">
                <path d="M0 0L11 6.5L0 13V0Z" fill="hsl(220 65% 8%)" />
              </svg>
            </div>
            <div className="flex items-center gap-[3px] flex-1">
              {[8, 14, 10, 18, 12, 16, 9, 20, 11, 15, 8, 13, 17, 10, 14].map((h, idx) => (
                IS_ANDROID ? (
                  // Android: plain div — avoids 15 Framer instances per mount.
                  <div
                    key={idx}
                    className="w-[2.5px] rounded-full"
                    style={{ height: h, background: "hsl(42 85% 60%)", opacity: 0.65 }}
                  />
                ) : (
                  <motion.div
                    key={idx}
                    animate={{ scaleY: [1, 1.5, 1] }}
                    transition={{
                      duration: 1.2,
                      repeat: ONB_REPEAT,
                      delay: idx * 0.07,
                      ease: "easeInOut",
                    }}
                    className="w-[2.5px] rounded-full"
                    style={{
                      height: h,
                      background: "hsl(42 85% 60%)",
                      transformOrigin: "center",
                      opacity: 0.65,
                    }}
                  />
                )
              ))}
            </div>
            <span
              className="text-[10px] font-semibold tabular-nums"
              style={{ color: "hsl(40 20% 70%)" }}
            >
              2:14
            </span>
          </div>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
          className="flex flex-wrap items-center justify-center gap-1.5 mt-5"
        >
          {[
            { icon: "☀️", label: t("onb.prayer.pillMorningNight") },
            { icon: "🎧", label: t("onb.prayer.pillVoice") },
            { icon: "📖", label: t("onb.prayer.pillScripture") },
          ].map((f) => (
            <span
              key={f.label}
              className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full"
              style={{
                color: "hsl(40 22% 86%)",
                background: "hsl(220 40% 18% / 0.55)",
                border: "1px solid hsl(42 50% 50% / 0.18)",
              }}
            >
              <span className="mr-1">{f.icon}</span>
              {f.label}
            </span>
          ))}
        </motion.div>
        </div>
      </div>

    </motion.div>
  );
}
// =============================================================================
// SLIDE — GUIDED JOURNEYS: multi-day walks with God through every season
// =============================================================================
// 75 Days of Light preview (replaces the old multi-day Journeys list).
const JOURNEY_CARDS = [
  { titleKey: "onb.journeys.item1Title", metaKey: "onb.journeys.item1Meta", hue: 42, equaliser: true, Icon: BookOpen },
  { titleKey: "onb.journeys.item2Title", metaKey: "onb.journeys.item2Meta", hue: 28, equaliser: false, Icon: HandHeart },
  { titleKey: "onb.journeys.item3Title", metaKey: "onb.journeys.item3Meta", hue: 220, equaliser: false, Icon: Users },
];

function JourneyEqualiser() {
  const heights = [6, 12, 8, 16, 10, 14, 7];
  return (
    <span className="flex items-center gap-[2px] shrink-0" aria-hidden>
      {heights.map((h, i) => (
        <motion.span
          key={i}
          animate={{ scaleY: [1, 1.6, 1] }}
          transition={{ duration: 1.2, repeat: ONB_REPEAT, delay: i * 0.12, ease: "easeInOut" }}
          className="w-[2px] rounded-full"
          style={{ height: h, background: "hsl(42 85% 62%)", transformOrigin: "center" }}
        />
      ))}
    </span>
  );
}

export function JourneysSlide({ active, exiting }: { active: boolean; exiting?: boolean }) {
  const { t } = useT();
  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      exit={ONB_SLIDE_EXIT}
      transition={{ duration: ONB_SLIDE_FADE_SECONDS, ease: "easeOut" }}
      className="onb-slide-layer absolute inset-0 flex flex-col items-center overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 30%, hsl(220 60% 14%) 0%, hsl(220 65% 5%) 75%)",
        }}
      />
      {/* Breathing blue halo */}
      <motion.div
        animate={{ opacity: [0.26, 0.5, 0.26], scale: [1, 1.08, 1] }}
        transition={{ duration: 5, repeat: ONB_REPEAT, ease: "easeInOut" }}
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 480,
          height: 480,
          top: "8%",
          background:
            "radial-gradient(circle, hsl(217 91% 60% / 0.22) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 flex max-h-full w-full flex-col items-center overflow-y-auto px-7 pb-36 pt-[max(env(safe-area-inset-top),40px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-full max-w-[420px] flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
            className="mb-4 w-full max-w-[320px] overflow-hidden rounded-[22px]"
            style={{ border: "1px solid hsl(42 70% 55% / 0.28)", boxShadow: "0 22px 44px -20px hsl(0 0% 0% / 0.8)" }}
          >
            <VoyagePoster days={18} fromDays={0} sea="night" labels priority sailDelay={900} sailMs={2600} />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.75, y: 0 }}
            transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
            className="mb-3 text-[10px] font-bold uppercase tracking-[0.4em]"
            style={{ color: "hsl(42 75% 60%)" }}
          >
            {t("onb.journeys.kicker")}
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
            className="mb-2 text-center text-[26px] leading-[1.18] font-bold"
            style={headlineStyle}
          >
            {t("onb.journeys.headlinePre")}
            <br />
            <span style={goldSpan}>{t("onb.journeys.headlineGold")}</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
            className="mb-7 max-w-[310px] text-center text-[12.5px] leading-[1.5]"
            style={{ color: "hsl(40 22% 82%)" }}
          >
            {t("onb.journeys.subcopy")}
          </motion.p>

          {JOURNEY_CARDS.map((card, i) => (
            <motion.div
              key={card.titleKey}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ONB_IN_DELAY + (i + 1) * ONB_STAGGER, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
              className="relative mb-2.5 w-full rounded-2xl px-4 py-3.5"
              style={{
                background:
                  "linear-gradient(165deg, hsl(220 45% 14% / 0.92) 0%, hsl(220 55% 8% / 0.96) 100%)",
                border: `1px solid hsl(${card.hue} 70% 55% / 0.22)`,
                boxShadow: "0 18px 36px -14px hsl(0 0% 0% / 0.7)",
              }}
            >
              <span
                className="absolute -left-4 top-0.5 bottom-0.5 w-[3px] rounded-full"
                style={{
                  background: `linear-gradient(180deg, hsl(${card.hue} 90% 60%), hsl(${card.hue} 85% 45%))`,
                  boxShadow: `0 0 12px hsl(${card.hue} 90% 55% / 0.6)`,
                }}
              />
              <div className="flex items-center gap-3 pl-2">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                  style={{ border: `1px solid hsl(${card.hue} 70% 55% / 0.35)`, background: `hsl(${card.hue} 70% 55% / 0.14)`, color: `hsl(${card.hue} 85% 66%)` }}
                >
                  <card.Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold leading-[1.15]" style={{ color: "hsl(40 25% 95%)" }}>
                    {t(card.titleKey)}
                  </span>
                  <span className="mt-0.5 block truncate text-[10.5px]" style={{ color: "hsl(40 15% 65%)" }}>
                    {t(card.metaKey)}
                  </span>
                </span>
                {card.equaliser && <JourneyEqualiser />}
              </div>
            </motion.div>
          ))}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            transition={{ delay: ONB_IN_DELAY + 4 * ONB_STAGGER, duration: ONB_IN_DUR }}
            className="mt-2.5 text-center text-[11px] tracking-[0.05em]"
            style={{ color: "hsl(40 18% 72%)" }}
          >
            {t("onb.journeys.footer")}
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// SLIDE 5 — SOCIAL PROOF: real reviews from real believers
// =============================================================================
function Stars({ size = 11 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-[2px] shrink-0">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="hsl(42 90% 58%)" aria-hidden>
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

function Laurel({ flip }: { flip?: boolean }) {
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 24 24"
      fill="none"
      stroke="hsl(42 88% 58%)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: flip ? "scaleX(-1)" : undefined, flexShrink: 0 }}
      aria-hidden
    >
      <path d="M2 22 14 10" />
      <path d="M7 17c-2 0-3-1-3-3 2 0 3 1 3 3Z" />
      <path d="M10 14c-2 0-3-1-3-3 2 0 3 1 3 3Z" />
      <path d="M13 11c-2 0-3-1-3-3 2 0 3 1 3 3Z" />
      <path d="M9 19c0-2 1-3 3-3 0 2-1 3-3 3Z" />
      <path d="M12 16c0-2 1-3 3-3 0 2-1 3-3 3Z" />
      <path d="M15 13c0-2 1-3 3-3 0 2-1 3-3 3Z" />
    </svg>
  );
}

const REVIEW_IDS = [1, 2, 3, 4, 5, 6, 7, 8];

function ReviewCard({
  review,
}: {
  review: { name: string; place: string; time: string; title: string; body: string };
}) {
  return (
    <div
      className="rounded-[17px] p-[13px] text-left"
      style={{
        background: "linear-gradient(165deg, hsl(220 45% 14% / 0.92) 0%, hsl(220 55% 8% / 0.96) 100%)",
        border: "1px solid hsl(42 60% 50% / 0.18)",
        boxShadow: "0 10px 22px -10px hsl(0 0% 0% / 0.5)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11.5px] font-black"
          style={{
            background: "linear-gradient(135deg, hsl(42 85% 52%), hsl(38 88% 42%))",
            color: "hsl(220 65% 8%)",
          }}
        >
          {review.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-extrabold" style={{ color: "hsl(40 25% 95%)" }}>
            {review.name}
          </p>
          <p className="truncate text-[9.5px]" style={{ color: "hsl(40 18% 62%)" }}>
            {review.place}
          </p>
        </div>
        <span className="text-[9px] shrink-0" style={{ color: "hsl(40 15% 55%)" }}>
          {review.time}
        </span>
      </div>
      <div className="mt-2.5">
        <Stars size={8} />
      </div>
      <p className="mt-1.5 text-[12.5px] font-black leading-[1.2]" style={{ color: "hsl(42 88% 80%)" }}>
        {review.title}
      </p>
      <p className="mt-1 text-[11px] leading-[1.42]" style={{ color: "hsl(40 20% 76%)" }}>
        {review.body}
      </p>
    </div>
  );
}

type ProofReview = { name: string; place: string; time: string; title: string; body: string };

/// Auto-drifting, hand-scrollable review feed. Two stacked copies make the wrap
/// invisible; touching the list pauses the drift and it resumes after release.
function ReviewFeed({ reviews }: { reviews: ProofReview[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const resumeRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!pausedRef.current) {
        const half = el.scrollHeight / 2;
        let next = el.scrollTop + (16 * dt) / 1000;
        if (half > 0 && next >= half) next -= half;
        el.scrollTop = next;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      if (resumeRef.current) window.clearTimeout(resumeRef.current);
    };
  }, []);

  const pause = () => {
    if (resumeRef.current) window.clearTimeout(resumeRef.current);
    pausedRef.current = true;
  };
  const resume = () => {
    if (resumeRef.current) window.clearTimeout(resumeRef.current);
    resumeRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, 3000);
  };

  return (
    <div
      ref={ref}
      onPointerDown={pause}
      onPointerUp={resume}
      onPointerCancel={resume}
      onWheel={() => {
        pause();
        resume();
      }}
      className="h-full w-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        maskImage: "linear-gradient(to bottom, transparent 0%, #000 7%, #000 88%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, #000 7%, #000 88%, transparent 100%)",
      }}
    >
      <div className="flex w-full flex-col gap-2.5">
        {[0, 1].map((copy) =>
          reviews.map((review) => <ReviewCard key={`${copy}-${review.name}`} review={review} />),
        )}
      </div>
    </div>
  );
}

export function SocialProofSlide({ active, exiting }: { active: boolean; exiting?: boolean }) {

  const { t } = useT();
  if (!active) return null;

  const reviews = REVIEW_IDS.map((i) => ({
    name: t(`onb.proof.r${i}Name`),
    place: t(`onb.proof.r${i}Place`),
    time: t(`onb.proof.r${i}Time`),
    title: t(`onb.proof.r${i}Title`),
    body: t(`onb.proof.r${i}Body`),
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      exit={ONB_SLIDE_EXIT}
      transition={{ duration: ONB_SLIDE_FADE_SECONDS, ease: "easeOut" }}
      className="onb-slide-layer absolute inset-0 flex flex-col items-center overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 30%, hsl(220 60% 14%) 0%, hsl(220 65% 5%) 75%)",
        }}
      />

      <div className="relative z-10 flex h-full w-full max-w-[440px] flex-col items-center overflow-hidden px-[22px] pb-[122px] pt-9">
        {/* Laurel award badge — strongest trust mark leads the slide */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
          className="flex items-center justify-center"
        >
          <Laurel flip />
          <div className="mx-1 flex flex-col items-center">
            <p
              className="w-[132px] text-center text-[10px] font-black leading-[1.25] tracking-[0.06em]"
              style={{ color: "hsl(42 90% 74%)" }}
            >
              {t("onb.proof.badge")}
            </p>
            <div className="mt-[5px]">
              <Stars size={9} />
            </div>
            <p className="mt-1 text-[10px] font-extrabold" style={{ color: "hsl(40 25% 90%)" }}>
              {t("onb.proof.reviews")}
            </p>
          </div>
          <Laurel />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ONB_IN_DELAY + ONB_STAGGER, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
          className="mb-3.5 mt-3.5 text-center text-[26px] font-bold leading-[1.18]"
          style={headlineStyle}
        >
          {t("onb.proof.headlinePre")}{" "}
          <span style={goldSpan}>{t("onb.proof.headlineGold")}</span>
        </motion.h2>

        {/* Endless review feed — auto-drifts, and the user can scroll it too */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: ONB_IN_DELAY + 2 * ONB_STAGGER, duration: ONB_IN_DUR }}
          className="relative min-h-0 w-full flex-1"
        >
          <ReviewFeed reviews={reviews} />
        </motion.div>


        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.66 }}
          transition={{ delay: ONB_IN_DELAY + 4 * ONB_STAGGER, duration: ONB_IN_DUR }}
          className="mt-2.5 text-center text-[11px] font-semibold"
          style={{ color: "hsl(40 20% 78%)" }}
        >
          {t("onb.proof.footer")}
        </motion.p>
      </div>
    </motion.div>
  );
}



// =============================================================================
// SLIDE 6 — TIME: When do you connect with God?
// =============================================================================
const TIME_OPTIONS: { id: UserTime; emoji: string; title: string; sub: string }[] = [
  { id: "morning", emoji: "🌅", title: "Mornings",  sub: "A soft bell at 7:00 AM" },
  { id: "evening", emoji: "🌙", title: "Evenings",  sub: "A soft bell at 9:00 PM" },
  { id: "both",    emoji: "✨", title: "Both",      sub: "Morning & evening bells" },
];

// Rotating phone mockup — shows what the alarm + notification actually look
// like. Sized with clamp() so it never overflows on 320px phones and never
// looks oversized on tablets. Apple-clean visual language inside the frame.
export function PrayerPreviewMockup() {
  const { t } = useT();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % 2), 3400);
    return () => clearInterval(t);
  }, []);

  // Adaptive sizing. Use svh as the limiting axis so Chrome/native browser
  // bars and short Android screens shrink the mockup instead of pushing the
  // selector behind the fixed CTA.
  const frameW = "clamp(96px, min(42vw, 17svh), 190px)";

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Soft ambient glow behind phone */}
      <div
        aria-hidden
        className="absolute pointer-events-none rounded-full"
        style={{
          width: "150%", height: "75%", top: "12%", left: "-25%",
          background: "radial-gradient(ellipse, hsl(42 85% 55% / 0.22) 0%, transparent 65%)",
          filter: ONB_BLUR_14,
        }}
      />

      {/* Phone frame */}
      <div
        className="onb-alarm-phone relative rounded-[34px] overflow-hidden"
        style={{
          width: frameW,
          aspectRatio: "9 / 19.5",
          containerType: "inline-size",
          background: "linear-gradient(160deg, hsl(220 18% 22%), hsl(220 25% 4%))",
          border: "1px solid hsl(42 50% 55% / 0.3)",
          boxShadow:
            "0 30px 60px -20px hsl(0 0% 0% / 0.9), inset 0 0 0 2px hsl(0 0% 0% / 0.5), 0 0 28px hsl(42 85% 50% / 0.18)",
          padding: 4,
        }}
      >
        {/* Dynamic Island */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-full z-30"
          style={{ top: "2.2%", width: "32%", height: "4.2%", background: "hsl(0 0% 0%)" }}
        />

        {/* Screen */}
        <div className="relative w-full h-full rounded-[28px] overflow-hidden bg-black">
          <AnimatePresence mode="wait">
            {idx === 0 ? (
              <LockscreenPreview key="lock" />
            ) : (
              <NotificationPreview key="notif" />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Caption + dots */}
      <div className="onb-alarm-caption mt-3.5 flex flex-col items-center gap-1.5">
        <AnimatePresence mode="wait">
          <motion.p
            key={idx}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 0.9, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.3 }}
            className="text-[10.5px] font-semibold tracking-wide"
            style={{ color: "hsl(42 75% 78%)" }}
          >
            {idx === 0 ? t("onb.time.mockAlarm") : t("onb.time.mockNotif")}
          </motion.p>
        </AnimatePresence>
        <div className="flex gap-1.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 16 : 5,
                height: 5,
                background: i === idx ? "hsl(42 90% 60%)" : "hsl(40 30% 60% / 0.3)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// iOS-style alarm screen — clean, minimal, beautiful.
function LockscreenPreview() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: ONB_IN_DUR }}
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(180deg, hsl(220 55% 12%) 0%, hsl(220 70% 4%) 100%)",
      }}
    >
      {/* Top status bar */}
      <div className="absolute inset-x-[9%] top-[3.8%] flex items-center justify-between z-10">
        <span className="onb-lock-status font-bold" style={{ color: "hsl(40 25% 96%)" }}>9:41</span>
        <div className="flex gap-1 items-center">
          <SignalIcon />
          <WifiIcon />
          <BatteryIcon />
        </div>
      </div>

      {/* Soft halo glow behind cross */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          width: "120%", height: "55%", top: "14%", left: "-10%",
          background: "radial-gradient(ellipse, hsl(42 90% 60% / 0.32) 0%, transparent 60%)",
          filter: ONB_BLUR_14,
        }}
      />

      {/* Center — cross + time + label (verse removed to avoid crowding) */}
      <div className="absolute inset-x-[8%] top-[13%] bottom-[18%] z-10 flex flex-col items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.8, repeat: ONB_REPEAT, ease: "easeInOut" }}
          className="onb-lock-cross relative flex items-center justify-center"
          style={{
            borderRadius: "50%",
            background: "radial-gradient(circle, hsl(42 95% 65% / 0.5) 0%, hsl(42 90% 55% / 0.12) 60%, transparent 80%)",
            boxShadow: "0 0 26px hsl(42 90% 55% / 0.55)",
          }}
        >
          <svg className="w-[48%] h-[48%]" viewBox="0 0 24 24" fill="none">
            <path d="M12 2v20M5 9h14" stroke="hsl(42 95% 80%)" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </motion.div>

        <p
          className="onb-lock-label mt-[14%] font-semibold tracking-[0.22em] uppercase"
          style={{ color: "hsl(42 70% 72%)" }}
        >
          Prayer Bell
        </p>
        <p
          className="onb-lock-time mt-[5%] font-thin leading-none"
          style={{
            color: "hsl(40 30% 98%)",
            fontFamily: "'SF Pro Display', system-ui",
            letterSpacing: "-0.04em",
          }}
        >
          7:00
        </p>
        <p
          className="onb-lock-subtitle mt-[6%] font-medium text-center leading-tight"
          style={{ color: "hsl(40 25% 92%)" }}
        >
          Morning Prayer
        </p>
      </div>

      {/* Bottom — iOS-style action buttons */}
      <div className="absolute inset-x-[10%] bottom-[6%] z-10">
        <button
          className="onb-lock-action w-full rounded-full font-semibold"
          style={{
            background: "linear-gradient(135deg, hsl(42 90% 60%), hsl(38 100% 70%))",
            color: "hsl(220 65% 8%)",
            boxShadow: "0 4px 14px -4px hsl(42 90% 55% / 0.6)",
          }}
        >
          Open Prayer
        </button>
      </div>
    </motion.div>
  );
}

// iOS-style lockscreen with notification banner sliding in.
function NotificationPreview() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: ONB_IN_DUR }}
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(180deg, hsl(220 40% 18%) 0%, hsl(220 60% 6%) 100%)",
      }}
    >
      {/* Status bar */}
      <div className="absolute inset-x-[9%] top-[3.8%] flex items-center justify-between z-10">
        <span className="onb-lock-status font-bold" style={{ color: "hsl(40 25% 96%)" }}>9:41</span>
        <div className="flex gap-1 items-center">
          <SignalIcon />
          <WifiIcon />
          <BatteryIcon />
        </div>
      </div>

      {/* Time big — iOS lockscreen */}
      <div className="absolute inset-x-[8%] top-[16%] flex flex-col items-center">
        <p
          className="onb-notif-date font-medium"
          style={{ color: "hsl(40 25% 90%)" }}
        >
          Sunday, May 24
        </p>
        <p
          className="onb-notif-time font-thin leading-none mt-[4%]"
          style={{
            color: "hsl(40 30% 98%)",
            fontFamily: "'SF Pro Display', system-ui",
            letterSpacing: "-0.04em",
          }}
        >
          7:00
        </p>
      </div>

      {/* Notification banner */}
      <motion.div
        initial={{ y: -24, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
        className="absolute left-[7%] right-[7%] top-[48%] rounded-[16px] px-[6%] py-[5%] flex gap-[5%]"
        style={{
          // backdrop-filter removed — was a major frame killer over animated
          // wallpaper bg on low-end Androids. Higher opacity solid reads
          // visually equivalent at this size and composites in one pass.
          background: "hsl(220 28% 12% / 0.94)",
          border: "0.5px solid hsl(42 60% 55% / 0.28)",
          boxShadow: "0 10px 22px -8px hsl(0 0% 0% / 0.6)",
        }}
      >
        <div
          className="onb-notif-icon rounded-[9px] flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, hsl(42 90% 55%), hsl(38 100% 65%))",
            boxShadow: "0 3px 8px -2px hsl(42 90% 55% / 0.5)",
          }}
        >
          <svg className="w-[48%] h-[48%]" viewBox="0 0 24 24" fill="none">
            <path d="M12 2v20M5 9h14" stroke="hsl(220 65% 8%)" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="onb-notif-kicker font-semibold truncate uppercase tracking-wider" style={{ color: "hsl(42 70% 75%)" }}>
              Prayer Bell
            </p>
            <p className="onb-notif-now" style={{ color: "hsl(40 18% 65%)" }}>now</p>
          </div>
          <p className="onb-notif-title font-semibold mt-[2%]" style={{ color: "hsl(40 28% 96%)" }}>
            Morning Prayer awaits
          </p>
          <p className="onb-notif-body leading-snug mt-[2%]" style={{ color: "hsl(40 20% 75%)" }}>
            A breath of peace to start your day with Him 🕊️
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Tiny iOS-style status bar icons
const SignalIcon = () => (
  <svg width="9" height="6" viewBox="0 0 16 10" fill="none">
    <rect x="0" y="7" width="2.5" height="3" rx="0.4" fill="hsl(40 25% 96%)" />
    <rect x="3.5" y="5" width="2.5" height="5" rx="0.4" fill="hsl(40 25% 96%)" />
    <rect x="7" y="2.5" width="2.5" height="7.5" rx="0.4" fill="hsl(40 25% 96%)" />
    <rect x="10.5" y="0" width="2.5" height="10" rx="0.4" fill="hsl(40 25% 96%)" />
  </svg>
);
const WifiIcon = () => (
  <svg width="9" height="6" viewBox="0 0 12 8" fill="none">
    <path d="M6 6.5 Q6 6.5 6 6.5 L6 6.5" stroke="hsl(40 25% 96%)" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M2.5 4.2 Q6 1.5 9.5 4.2" stroke="hsl(40 25% 96%)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    <path d="M0.5 2 Q6 -2 11.5 2" stroke="hsl(40 25% 96%)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    <circle cx="6" cy="6.5" r="0.8" fill="hsl(40 25% 96%)" />
  </svg>
);
const BatteryIcon = () => (
  <svg width="14" height="6" viewBox="0 0 22 10" fill="none">
    <rect x="0.5" y="0.5" width="18" height="9" rx="2" stroke="hsl(40 25% 96%)" strokeWidth="0.8" opacity="0.6" fill="none" />
    <rect x="2" y="2" width="14" height="6" rx="1" fill="hsl(40 25% 96%)" />
    <rect x="19.5" y="3" width="1.5" height="4" rx="0.5" fill="hsl(40 25% 96%)" opacity="0.6" />
  </svg>
);

// =============================================================================
// ANDROID "APPEAR ON TOP" SETTINGS MOCKUP — animated demonstration of exactly
// what the user will see when they tap through to system settings, so the
// permission ask never feels mysterious. Toggle auto-flips off→on every ~2.4s.
// =============================================================================
function AppearOnTopMockup() {
  const { t } = useT();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 2400);
    return () => clearInterval(id);
  }, []);

  // Keep the visual height compact, but widen the permission phone slightly so
  // the Android settings UI no longer looks mathematically squeezed.
  const frameW = "clamp(92px, min(34vw, 14svh), 158px)";

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Ambient gold glow */}
      <div
        aria-hidden
        className="absolute pointer-events-none rounded-full"
        style={{
          width: "150%", height: "75%", top: "12%", left: "-25%",
          background: "radial-gradient(ellipse, hsl(42 85% 55% / 0.22) 0%, transparent 65%)",
          filter: ONB_BLUR_14,
        }}
      />

      <div
        className="onb-alarm-phone relative rounded-[34px] overflow-hidden"
        style={{
          width: frameW,
          aspectRatio: "10.3 / 19.5",
          containerType: "inline-size",
          background: "linear-gradient(160deg, hsl(220 18% 22%), hsl(220 25% 4%))",
          border: "1px solid hsl(42 50% 55% / 0.3)",
          boxShadow:
            "0 30px 60px -20px hsl(0 0% 0% / 0.9), inset 0 0 0 2px hsl(0 0% 0% / 0.5), 0 0 28px hsl(42 85% 50% / 0.18)",
          padding: 4,
        }}
      >
        {/* Dynamic island */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-full z-30"
          style={{ top: "2.2%", width: "32%", height: "4.2%", background: "hsl(0 0% 0%)" }}
        />

        {/* Android settings screen */}
        <div
          className="relative w-full h-full rounded-[28px] overflow-hidden"
          style={{ background: "hsl(220 12% 10%)" }}
        >
          {/* Status bar */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-[10%] pt-[7%]">
            <span className="text-white/85 text-[6.5cqw] font-semibold tabular-nums">10:08</span>
            <div className="flex items-center gap-[3cqw]">
              <span className="text-white/60 text-[5cqw]">●●●</span>
            </div>
          </div>

          {/* Title bar */}
          <div className="absolute inset-x-0 flex items-center gap-[4cqw] px-[7%]" style={{ top: "13%" }}>
            <span className="text-white/85 text-[8cqw] leading-none">‹</span>
            <span className="text-white text-[6.4cqw] font-semibold leading-tight">{t("onb.time.overlaySettingsTitle")}</span>
          </div>

          {/* Settings rows */}
          <div className="absolute inset-x-0" style={{ top: "24%" }}>
            {/* Prayly row (highlighted) */}
            <motion.div
              className="flex items-center gap-[4cqw] px-[7%] py-[3.6cqw] relative"
              animate={{ background: on ? "hsl(42 85% 50% / 0.10)" : "hsl(0 0% 100% / 0)" }}
              transition={{ duration: ONB_IN_DUR }}
            >
              {/* App icon — real Prayly logo */}
              <div
                className="rounded-[3.5cqw] overflow-hidden shrink-0"
                style={{
                  width: "11cqw",
                  height: "11cqw",
                  background: "linear-gradient(135deg, hsl(42 90% 55%), hsl(38 100% 70%))",
                  boxShadow: "0 1px 2px hsl(0 0% 0% / 0.4)",
                }}
              >
                <img
                  src={appLogo}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[5.8cqw] font-semibold leading-tight truncate">Prayly</p>
                <motion.p
                  animate={{ color: on ? "hsl(140 60% 65%)" : "hsl(0 0% 100% / 0.45)" }}
                  transition={{ duration: 0.3 }}
                  className="text-[4.4cqw] mt-[0.6cqw] leading-tight truncate"
                >
                  Bible Prayer & Verse
                </motion.p>
              </div>

              {/* Animated Material toggle — flex-centered so knob sits perfectly */}
              <div
                className="relative rounded-full shrink-0 flex items-center"
                style={{
                  width: "13.5cqw",
                  height: "7.5cqw",
                  paddingLeft: "0.55cqw",
                  paddingRight: "0.55cqw",
                  background: on ? "hsl(42 85% 50% / 0.45)" : "hsl(0 0% 100% / 0.18)",
                  transition: "background 240ms ease",
                }}
              >
                <motion.div
                  animate={{ x: on ? "5.85cqw" : "0cqw" }}
                  transition={{ type: "spring", stiffness: 360, damping: 26 }}
                  className="rounded-full"
                  style={{
                    width: "6.4cqw",
                    height: "6.4cqw",
                    background: on ? "hsl(42 90% 60%)" : "hsl(0 0% 92%)",
                    boxShadow: "0 1px 3px hsl(0 0% 0% / 0.5)",
                  }}
                />
              </div>

              {/* Tap ripple cue */}
              <AnimatePresence>
                {on && (
                  <motion.div
                    key="ripple"
                    initial={{ scale: 0.4, opacity: 0.45 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: ONB_IN_DUR, ease: "easeOut" }}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      right: "8%",
                      top: "50%",
                      width: "13.5cqw",
                      height: "13.5cqw",
                      marginTop: "-6.75cqw",
                      background: "hsl(42 90% 60% / 0.5)",
                    }}
                  />
                )}
              </AnimatePresence>
            </motion.div>

            {/* Decoy rows — desaturated, build trust the mockup is real */}
            {[
              { name: "Chrome", letter: "C", hue: 215 },
              { name: "Maps", letter: "M", hue: 145 },
            ].map((row) => (
              <div key={row.name} className="flex items-center gap-[4cqw] px-[7%] py-[3.6cqw] opacity-55">
                <div
                  className="rounded-[3.5cqw] flex items-center justify-center shrink-0"
                  style={{
                    width: "11cqw",
                    height: "11cqw",
                    background: `linear-gradient(135deg, hsl(${row.hue} 55% 55%), hsl(${row.hue} 65% 40%))`,
                  }}
                >
                  <span className="text-white text-[6cqw] font-black">{row.letter}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/85 text-[5.8cqw] font-semibold leading-tight truncate">{row.name}</p>
                  <p className="text-white/40 text-[4.6cqw] mt-[0.6cqw] leading-tight">{t("onb.time.notAllowed")}</p>
                </div>
                <div
                  className="rounded-full shrink-0 flex items-center"
                  style={{
                    width: "13.5cqw", height: "7.5cqw",
                    paddingLeft: "0.55cqw", paddingRight: "0.55cqw",
                    background: "hsl(0 0% 100% / 0.14)",
                  }}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: "6.4cqw", height: "6.4cqw",
                      background: "hsl(0 0% 85%)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Soft top fade for premium feel */}
          <div
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{
              height: "12%",
              background: "linear-gradient(180deg, hsl(220 12% 6%) 0%, transparent 100%)",
            }}
          />
        </div>
      </div>

      {/* Caption that mirrors the toggle state */}
      <div className="onb-alarm-caption mt-3.5 flex flex-col items-center gap-1.5">
        <AnimatePresence mode="wait">
          <motion.p
            key={on ? "on" : "off"}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 0.92, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.3 }}
            className="text-[10.5px] font-semibold tracking-wide"
            style={{ color: on ? "hsl(140 60% 72%)" : "hsl(42 75% 78%)" }}
          >
            {on ? "Tap the toggle for Prayly" : "Find Prayly in the list"}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// =============================================================================
// SLIDE 6 — TIME (2 phases: pick → appear-on-top permission)
// =============================================================================
export function TimeSlide({
  active,
  exiting,
  picked,
  onPick,
  onSkip,
  onReadyChange,
  onPermissionGranted,
}: {
  active: boolean;
  exiting?: boolean;
  picked: UserTime | null;
  onPick: (t: UserTime) => void;
  onSkip: () => void;
  onReadyChange: (ready: boolean) => void;
  onPermissionGranted: () => void;
}) {
  // Native vs web — on web the permission can't actually be granted, so the
  // user must explicitly tap "Maybe later" to move on (no silent bypass).
  const isNative = Capacitor.isNativePlatform();

  // SYSTEM_ALERT_WINDOW status, polled when the slide regains focus.
  const [overlayOk, setOverlayOk] = useState<boolean | null>(null);

  // User explicitly chose to skip the permission step ("I'll do it later").
  const [permissionDeferred, setPermissionDeferred] = useState(false);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const poll = async () => {
      try {
        const s = await PrayerAlarm.getStatus();
        if (alive) setOverlayOk(!!s.overlayAllowed);
      } catch { /* web — ignore */ }
    };
    poll();
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [active]);

  // Overlay permission is no longer required (SYSTEM_ALERT_WINDOW removed).
  // Slide has a single phase — pick a time, tap Continue.
  const phase: "pick" | "permission" = "pick";

  useEffect(() => {
    if (!active) return;
    onReadyChange(!!picked);
  }, [active, picked, onReadyChange]);



  const requestOverlay = async () => {
    haptic("soft");
    try { await PrayerAlarm.openOverlaySettings(); } catch { /* ignore */ }
  };

  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      exit={ONB_SLIDE_EXIT}
      transition={{ duration: ONB_SLIDE_FADE_SECONDS, ease: "easeOut" }}
      className="onb-slide-layer absolute inset-0 flex flex-col items-center overflow-y-auto overflow-x-hidden overscroll-contain"
      style={{
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
        overscrollBehavior: "contain",
      }}
      onPointerDownCapture={(e) => {
        // Stop the parent horizontal drag wrapper from hijacking vertical
        // pans on small phones, so the user can always scroll this slide.
        e.stopPropagation();
      }}
    >
      <div
        className="pointer-events-none"
        style={{
          position: "sticky",
          top: 0,
          height: 0,
          width: "100%",
          zIndex: 0,
        }}
      >
        <div
          className="pointer-events-none"
          style={{
            position: "absolute",
            inset: "0 0 auto 0",
            height: "100vh",
            background:
              "radial-gradient(ellipse 90% 70% at 50% 35%, hsl(220 60% 14%) 0%, hsl(220 65% 5%) 75%)",
          }}
        />
      </div>

      <div
        className="onb-time-content relative z-10 flex flex-col items-center px-5 w-full max-w-[440px]"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 14px)",
          paddingBottom: "max(196px, calc(env(safe-area-inset-bottom) + 176px))",
        }}
      >
        {/* Header — copy swaps based on phase */}
        <div className="onb-time-header flex flex-col items-center w-full mt-10">
          <AnimatePresence mode="wait">
            <motion.p
              key={`eyebrow-${phase}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 0.85, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: ONB_IN_DUR }}
              className="onb-time-eyebrow text-[9.5px] font-bold tracking-[0.4em] uppercase"
              style={{ color: "hsl(42 75% 60%)" }}
            >
              {phase === "pick" ? "Daily Prayer Bell" : "One Last Step"}
            </motion.p>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p
              key={`title-${phase}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 0.92, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: ONB_IN_DUR }}
              className="onb-time-title text-center text-[20px] sm:text-[22px] font-bold leading-tight mt-2 max-w-[300px]"
              style={{ color: "hsl(40 28% 95%)" }}
            >
              {phase === "pick" ? "Here's what you'll receive" : "Let the bell rise above any app"}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Mockup — cross-fades from alarm preview to settings demo */}
        <div className="onb-time-mockup mt-3 mb-3 w-full flex justify-center">
          <AnimatePresence mode="wait">
            {phase === "pick" ? (
              <motion.div
                key="pick-mock"
                initial={{ opacity: 0, y: 14, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.94 }}
                transition={{ duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
              >
                <PrayerPreviewMockup />
              </motion.div>
            ) : (
              <motion.div
                key="perm-mock"
                initial={{ opacity: 0, y: 14, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.94 }}
                transition={{ duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
                className="onb-perm-mock"
              >
                <AppearOnTopMockup />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Body — pick phase shows tiles + skip, permission phase shows primer */}
        <div className="onb-time-options w-full flex flex-col items-center mt-1">
          <AnimatePresence mode="wait">
            {phase === "pick" ? (
              <motion.div
                key="pick-body"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: ONB_IN_DUR }}
                className="w-full flex flex-col items-center"
              >
                <p
                  className="onb-time-prompt text-center text-[11px] leading-snug mb-2.5 max-w-[300px]"
                  style={{ color: "hsl(40 22% 78%)" }}
                >
                  When would you like Jesus to <span style={{ color: "hsl(42 85% 70%)", fontWeight: 600 }}>gently call</span> on you?
                </p>

                <div className="w-full grid grid-cols-3 gap-2">
                  {TIME_OPTIONS.map((opt, i) => {
                    const isPicked = picked === opt.id;
                    return (
                      <motion.button
                        key={opt.id}
                        initial={{ opacity: 0, y: 12, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: ONB_IN_DELAY + i * ONB_STAGGER, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          haptic("soft");
                          onPick(opt.id);
                        }}
                        className="onb-time-option-card relative rounded-2xl px-2 py-3 flex flex-col items-center justify-center gap-1 overflow-hidden"
                        style={{
                          background: isPicked
                            ? "linear-gradient(160deg, hsl(42 85% 50% / 0.28), hsl(42 85% 60% / 0.06))"
                            : "linear-gradient(165deg, hsl(220 45% 14% / 0.92) 0%, hsl(220 55% 8% / 0.96) 100%)",
                          border: isPicked
                            ? "1px solid hsl(42 85% 60% / 0.6)"
                            : "1px solid hsl(42 60% 50% / 0.2)",
                          boxShadow: isPicked
                            ? "0 12px 24px -10px hsl(42 85% 50% / 0.45)"
                            : "0 8px 16px -10px hsl(0 0% 0% / 0.55)",
                          minHeight: "clamp(64px, 10svh, 82px)",
                        }}
                      >
                        <div className="onb-time-option-emoji text-[22px] leading-none">{opt.emoji}</div>
                        <p
                          className="text-[11.5px] font-extrabold leading-tight mt-0.5"
                          style={{ color: isPicked ? "hsl(42 90% 82%)" : "hsl(40 25% 95%)" }}
                        >
                          {opt.title}
                        </p>
                        <p
                          className="onb-time-option-sub text-[8.5px] text-center leading-tight px-0.5"
                          style={{ color: "hsl(40 18% 62%)" }}
                        >
                          {opt.sub}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.55 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
                  onClick={() => { haptic("soft"); onSkip(); }}
                  className="onb-time-skip mt-3 text-[11px] font-medium tracking-wide underline-offset-4 hover:underline"
                  style={{ color: "hsl(40 18% 70%)" }}
                >
                  No reminders, thanks
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="perm-body"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: ONB_IN_DUR }}
                className="w-full flex flex-col items-center"
              >
                <p
                  className="onb-perm-body text-center text-[12px] leading-[1.55] max-w-[320px] font-medium"
                  style={{ color: "hsl(40 25% 86%)" }}
                >
                  Never miss a single moment with God — let the prayer bell <span style={{ color: "hsl(42 85% 72%)", fontWeight: 700 }}>rise above any app</span> and gently call you back, even while you're scrolling.
                </p>

                {overlayOk === true ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 340, damping: 22 }}
                    className="mt-4 flex items-center gap-2 rounded-full px-4 py-2"
                    style={{
                      background: "hsl(140 55% 40% / 0.16)",
                      border: "1px solid hsl(140 60% 55% / 0.5)",
                    }}
                  >
                    <span className="text-[14px] leading-none">✓</span>
                    <p className="text-[11.5px] font-bold tracking-wide" style={{ color: "hsl(140 70% 80%)" }}>
                      Prayer bell can now reach you anywhere
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {/* Step-by-step what to do — small numbered list */}
                    <div
                      className="onb-perm-steps mt-3.5 w-full max-w-[340px] rounded-2xl px-3.5 py-3"
                      style={{
                        background: "hsl(220 45% 14% / 0.7)",
                        border: "1px solid hsl(42 60% 50% / 0.22)",
                      }}
                    >
                      {[
                        "Tap the gold button below — settings opens",
                        "Find Prayly in the list",
                        "Flip the toggle on, then return here",
                      ].map((line, i) => (
                        <div key={i} className="onb-perm-step flex items-start gap-2.5 py-1">
                          <div
                            className="flex items-center justify-center rounded-full shrink-0 mt-[1px]"
                            style={{
                              width: 16, height: 16,
                              background: "linear-gradient(135deg, hsl(42 90% 60%), hsl(38 100% 70%))",
                              color: "hsl(220 65% 8%)",
                              fontSize: 9.5, fontWeight: 800,
                            }}
                          >
                            {i + 1}
                          </div>
                          <p className="text-[10.5px] leading-[1.4]" style={{ color: "hsl(40 22% 86%)" }}>
                            {line}
                          </p>
                        </div>
                      ))}
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={requestOverlay}
                      className="onb-perm-cta mt-3.5 w-full max-w-[340px] rounded-full font-bold text-[12.5px] tracking-[0.06em] py-3"
                      style={{
                        background:
                          "linear-gradient(105deg, hsl(42 85% 50%), hsl(38 100% 65%), hsl(42 85% 50%))",
                        backgroundSize: "200% 100%",
                        animation: IS_ANDROID ? "none" : "onb-gold-sweep 1.6s ease-out 1 both",
                        color: "hsl(220 65% 8%)",
                        boxShadow: "0 10px 24px -8px hsl(42 85% 50% / 0.5)",
                      }}
                    >
                      Open Settings
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { haptic("soft"); setPermissionDeferred(true); }}
                      className="onb-perm-later mt-2.5 text-[10.5px] font-medium underline-offset-4 hover:underline"
                      // Intentionally muted: this is the deferring/skip path,
                      // not the primary CTA. Keeping it quiet (≈40% opacity,
                      // dim warm gray) lets "Open Settings" carry the weight
                      // without feeling like two equal buttons.
                      style={{ color: "hsl(40 12% 78%)", opacity: 0.32 }}
                    >
                      Maybe later
                    </motion.button>
                  </>
                )}

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// SLIDE — DAILY RHYTHM: morning / evening / both → quiet daily reminder times
// =============================================================================
export const DAILY_REMINDER_SLOTS_KEY = "prayly_daily_reminder_slots_v1";

const RHYTHM_OPTIONS: { id: UserTime; emoji: string; hue: number }[] = [
  { id: "morning", emoji: "🌅", hue: 38 },
  { id: "evening", emoji: "🌙", hue: 220 },
  { id: "both", emoji: "✨", hue: 45 },
];

export function RhythmSlide({ active, exiting }: { active: boolean; exiting?: boolean }) {
  const { t } = useT();
  const [picked, setPicked] = useState<UserTime>(() => {
    try { return (localStorage.getItem(DAILY_REMINDER_SLOTS_KEY) as UserTime) || "both"; } catch { return "both"; }
  });
  useEffect(() => {
    try {
      localStorage.setItem(DAILY_REMINDER_SLOTS_KEY, picked);
      localStorage.setItem("prayly_daily_reminder_v1", "true");
    } catch { /* ignore */ }
    setUserTime(picked);
  }, [picked]);
  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      exit={ONB_SLIDE_EXIT}
      transition={{ duration: ONB_SLIDE_FADE_SECONDS, ease: "easeOut" }}
      className="onb-slide-layer absolute inset-0 flex flex-col items-center overflow-hidden"
    >
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 70% at 50% 28%, hsl(222 58% 14%) 0%, hsl(222 65% 5%) 75%)" }} />
      <motion.div
        animate={{ opacity: [0.3, 0.55, 0.3], scale: [1, 1.08, 1] }}
        transition={{ duration: 5, repeat: ONB_REPEAT, ease: "easeInOut" }}
        className="absolute pointer-events-none rounded-full"
        style={{ width: 460, height: 460, top: "6%", background: "radial-gradient(circle, hsl(42 90% 58% / 0.2) 0%, transparent 65%)" }}
      />
      <div className="relative z-10 flex max-h-full w-full flex-col items-center overflow-y-auto px-7 pb-36 pt-[max(env(safe-area-inset-top),40px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-full max-w-[420px] flex-col items-center">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 0.75, y: 0 }} transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
            className="mb-3 text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: "hsl(42 75% 60%)" }}>
            {t("onb.rhythm.kicker")}
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
            className="mb-2 text-center text-[26px] leading-[1.18] font-bold" style={headlineStyle}>
            {t("onb.rhythm.headlinePre")}<br /><span style={goldSpan}>{t("onb.rhythm.headlineGold")}</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
            className="mb-7 max-w-[310px] text-center text-[12.5px] leading-[1.5]" style={{ color: "hsl(40 22% 82%)" }}>
            {t("onb.rhythm.subcopy")}
          </motion.p>

          {RHYTHM_OPTIONS.map((o, i) => {
            const on = picked === o.id;
            return (
              <motion.button
                key={o.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); setPicked(o.id); haptic("soft"); }}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0, scale: on ? 1.015 : 1 }}
                transition={{ delay: ONB_IN_DELAY + (i + 1) * ONB_STAGGER, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
                className="relative mb-2.5 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
                style={{
                  background: on
                    ? "linear-gradient(165deg, hsl(42 60% 20% / 0.55) 0%, hsl(220 55% 9% / 0.96) 100%)"
                    : "linear-gradient(165deg, hsl(220 45% 14% / 0.92) 0%, hsl(220 55% 8% / 0.96) 100%)",
                  border: on ? "1.5px solid hsl(42 88% 58% / 0.85)" : "1px solid hsl(40 30% 70% / 0.14)",
                  boxShadow: on ? "0 0 26px -6px hsl(42 90% 55% / 0.45)" : "0 18px 36px -14px hsl(0 0% 0% / 0.7)",
                }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[22px]"
                  style={{ background: `linear-gradient(135deg, hsl(${o.hue} 85% 55% / 0.22), hsl(${o.hue} 85% 45% / 0.04))`, border: `1px solid hsl(${o.hue} 70% 55% / 0.3)` }}>
                  {o.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-bold leading-[1.15]" style={{ color: "hsl(40 25% 95%)" }}>{t(`onb.rhythm.${o.id}Title`)}</span>
                  <span className="mt-0.5 block text-[11px]" style={{ color: "hsl(40 15% 65%)" }}>{t(`onb.rhythm.${o.id}Desc`)}</span>
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: on ? "linear-gradient(135deg, hsl(45 95% 65%), hsl(38 90% 48%))" : "transparent", border: on ? "none" : "1.5px solid hsl(40 20% 70% / 0.3)" }}>
                  {on && (
                    <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(222 65% 8%)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </motion.svg>
                  )}
                </span>
              </motion.button>
            );
          })}

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} transition={{ delay: ONB_IN_DELAY + 4 * ONB_STAGGER, duration: ONB_IN_DUR }}
            className="mt-2.5 text-center text-[11px] tracking-[0.05em]" style={{ color: "hsl(40 18% 72%)" }}>
            {t("onb.rhythm.footer")}
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
