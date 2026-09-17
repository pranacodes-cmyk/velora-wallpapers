// Lazy-loaded onboarding slides 2-6 (Prayer, BibleChat, Focus, Time, Name).
// This chunk is only fetched/parsed after slide 1 — keeps the initial JS parse
// (and first-paint cost of OnboardingFlow) small on low-end Android.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";
import PrayerAlarm from "@/plugins/prayer-alarm";
import { setUserFocus, setUserTime, type UserFocus, type UserTime } from "@/lib/userProfile";
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

      <div className="relative z-10 flex flex-col items-center px-8 max-w-[420px] pb-28">
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
    </motion.div>
  );
}
export function BibleChatSlide({ active, exiting }: { active: boolean; exiting?: boolean }) {
  const { t } = useT();
  const conversations = useMemo(
    () => [
      {
        question: t("onb.chat.q1"),
        reply: t("onb.chat.reply1"),
        verseRef: t("onb.chat.ref1"),
      },
      {
        question: t("onb.chat.q2"),
        reply: t("onb.chat.reply2"),
        verseRef: t("onb.chat.ref2"),
      },
      {
        question: t("onb.chat.q3"),
        reply: t("onb.chat.reply3"),
        verseRef: t("onb.chat.ref3"),
      },
    ],
    [t]
  );
  const [cIdx, setCIdx] = useState(0);
  const [phase, setPhase] = useState<"asking" | "typing" | "answered">("asking");

  useEffect(() => {
    if (!active) return;
    setPhase("asking");
    const t1 = setTimeout(() => setPhase("typing"), 1200);
    const t2 = setTimeout(() => setPhase("answered"), 2400);
    const t3 = setTimeout(() => setCIdx((i) => (i + 1) % conversations.length), 5400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active, cIdx, conversations.length]);

  if (!active) return null;
  const current = conversations[cIdx];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      exit={ONB_SLIDE_EXIT}
      transition={{ duration: ONB_SLIDE_FADE_SECONDS, ease: "easeOut" }}
      className="onb-slide-layer absolute inset-0 flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden"
    >
      {/* Atmospheric backdrop — kept identical to sibling slides */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 38%, hsl(220 60% 14%) 0%, hsl(220 65% 5%) 75%)",
        }}
      />
      <motion.div
        animate={{ opacity: [0.25, 0.5, 0.25], scale: [1, 1.08, 1] }}
        transition={{ duration: 5, repeat: ONB_REPEAT, ease: "easeInOut" }}
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 420,
          height: 420,
          top: "22%",
          background:
            "radial-gradient(circle, hsl(42 85% 55% / 0.28) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-7 max-w-[420px] pt-[max(env(safe-area-inset-top),16px)] mt-12 pb-40 w-full">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.85, y: 0 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
          className="text-[10px] font-bold tracking-[0.4em] uppercase mb-3"
          style={{ color: "hsl(42 75% 60%)" }}
        >
          {t("onb.chat.kicker")}
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-[26px] leading-[1.18] font-bold mb-3"
          style={headlineStyle}
        >
          {t("onb.chat.headlinePre")}{" "}
          <span style={goldSpan}>{t("onb.chat.headlineGold")}</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.75 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
          className="text-center text-[13px] leading-[1.55] mb-6 max-w-[310px]"
          style={{ color: "hsl(40 22% 80%)" }}
        >
          {t("onb.chat.subcopy")}
        </motion.p>

        {/* Chat card mock */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full rounded-2xl px-5 py-5"
          style={{
            background:
              "linear-gradient(165deg, hsl(220 45% 14% / 0.92) 0%, hsl(220 55% 8% / 0.96) 100%)",
            border: "1px solid hsl(42 60% 50% / 0.22)",
            boxShadow:
              "0 30px 60px -20px hsl(0 0% 0% / 0.8), 0 0 50px -10px hsl(42 85% 55% / 0.18), inset 0 1px 0 hsl(0 0% 100% / 0.05)",
          }}
        >
          {/* Top row: app chip + private */}
          <div className="flex items-center justify-between mb-4">
            <span
              className="flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.22em] uppercase"
              style={{ color: "hsl(42 75% 62%)" }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(42 90% 60%), hsl(38 100% 70%))",
                  color: "hsl(220 65% 8%)",
                }}
              >
                ✝
              </span>
              {t("onb.chat.chip")}
            </span>
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full"
              style={{
                color: "hsl(42 90% 75%)",
                background: "hsl(42 70% 55% / 0.14)",
                border: "1px solid hsl(42 60% 50% / 0.3)",
              }}
            >
              <span>🔒</span>
              <span>{t("onb.chat.private")}</span>
            </span>
          </div>

          {/* Chat thread */}
          <div className="relative flex flex-col gap-3" style={{ minHeight: 232 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`c-${cIdx}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: ONB_IN_DUR }}
                className="flex flex-col gap-3"
              >
                {/* User bubble */}
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
                  className="self-end max-w-[82%] rounded-2xl rounded-tr-md px-3.5 py-2.5"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(220 45% 26%), hsl(220 50% 20%))",
                    border: "1px solid hsl(220 35% 35% / 0.45)",
                  }}
                >
                  <p
                    className="text-[13px] leading-[1.45] font-medium"
                    style={{ color: "hsl(40 22% 92%)" }}
                  >
                    {current.question}
                  </p>
                </motion.div>

                {/* Typing dots */}
                {phase === "typing" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="self-start flex items-center gap-1.5 rounded-2xl rounded-tl-md px-3.5 py-3"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(42 60% 22% / 0.5), hsl(42 50% 16% / 0.45))",
                      border: "1px solid hsl(42 60% 50% / 0.28)",
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{
                          duration: 1.1,
                          repeat: ONB_REPEAT,
                          delay: i * 0.15,
                          ease: "easeInOut",
                        }}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "hsl(42 85% 70%)" }}
                      />
                    ))}
                  </motion.div>
                )}

                {/* Reply bubble */}
                {phase === "answered" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
                    className="self-start max-w-[88%] rounded-2xl rounded-tl-md px-3.5 py-3"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(42 60% 24% / 0.55), hsl(42 50% 16% / 0.45))",
                      border: "1px solid hsl(42 85% 60% / 0.42)",
                      boxShadow:
                        "0 10px 24px -10px hsl(42 85% 50% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.06)",
                    }}
                  >
                    <p
                      className="text-[13px] leading-[1.5] font-medium mb-2"
                      style={{ color: "hsl(42 30% 95%)" }}
                    >
                      {current.reply}
                    </p>
                    <p
                      className="text-[10px] font-bold tracking-[0.12em] uppercase"
                      style={{ color: "hsl(42 85% 72%)" }}
                    >
                      {current.verseRef}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Composer hint */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
            className="flex items-center gap-2 mt-4 pt-3 px-3 py-2 rounded-full"
            style={{
              borderTop: "1px solid hsl(42 60% 50% / 0.15)",
              background: "hsl(220 40% 16% / 0.55)",
              border: "1px solid hsl(220 30% 28% / 0.5)",
            }}
          >
            <span className="text-[11.5px] flex-1" style={{ color: "hsl(40 18% 65%)" }}>
              {t("onb.chat.composer")}
            </span>
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, hsl(42 90% 60%), hsl(38 100% 70%))",
                boxShadow: "0 4px 12px -2px hsl(42 85% 50% / 0.5)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6h7M6 3l3 3-3 3"
                  stroke="hsl(220 65% 8%)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// SLIDE 5 — FOCUS: What brought you here?
// =============================================================================
export function FocusSlide({ active, exiting, picked, onPick }: { active: boolean; exiting?: boolean; picked: UserFocus | null; onPick: (f: UserFocus) => void }) {
  const { t } = useT();
  const FOCUS_OPTIONS: { id: UserFocus; emoji: string; title: string; sub: string }[] = [
    { id: "anxiety",   emoji: "🌊", title: t("onb.focus.anxietyTitle"),   sub: t("onb.focus.anxietySub") },
    { id: "strength",  emoji: "🛡️", title: t("onb.focus.strengthTitle"),  sub: t("onb.focus.strengthSub") },
    { id: "healing",   emoji: "🌿", title: t("onb.focus.healingTitle"),   sub: t("onb.focus.healingSub") },
    { id: "gratitude", emoji: "🌅", title: t("onb.focus.gratitudeTitle"), sub: t("onb.focus.gratitudeSub") },
    { id: "doubt",     emoji: "🕊️", title: t("onb.focus.doubtTitle"),     sub: t("onb.focus.doubtSub") },
    { id: "closer",    emoji: "✝️", title: t("onb.focus.closerTitle"),    sub: t("onb.focus.closerSub") },
  ];
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
      <motion.div
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 5, repeat: ONB_REPEAT, ease: "easeInOut" }}
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 420, height: 420, top: "18%",
          background: "radial-gradient(circle, hsl(42 85% 55% / 0.25) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-6 pt-14 pb-32 w-full max-w-[440px]">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.85, y: 0 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
          className="text-[10px] font-bold tracking-[0.4em] uppercase mb-3"
          style={{ color: "hsl(42 75% 60%)" }}
        >
          {t("onb.focus.kicker")}
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-[26px] leading-[1.18] font-bold mb-2"
          style={headlineStyle}
        >
          {t("onb.focus.headlinePre")}{" "}
          <span style={goldSpan}>{t("onb.focus.headlineGold")}</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
          className="text-center text-[12.5px] leading-[1.5] mb-5 max-w-[300px]"
          style={{ color: "hsl(40 22% 80%)" }}
        >
          {t("onb.focus.subcopy")}
        </motion.p>

        <div className="w-full grid grid-cols-2 gap-2">
          {FOCUS_OPTIONS.map((opt, i) => {
            const isPicked = picked === opt.id;
            return (
              <motion.button
                key={opt.id}
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: ONB_IN_DELAY + i * ONB_STAGGER, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  haptic("soft");
                  onPick(opt.id);
                }}
                className="relative rounded-2xl px-3 py-3 text-left overflow-hidden"
                style={{
                  background: isPicked
                    ? "linear-gradient(135deg, hsl(42 85% 50% / 0.28), hsl(42 85% 60% / 0.10))"
                    : "linear-gradient(165deg, hsl(220 45% 14% / 0.92) 0%, hsl(220 55% 8% / 0.96) 100%)",
                  border: isPicked
                    ? "1px solid hsl(42 85% 60% / 0.65)"
                    : "1px solid hsl(42 60% 50% / 0.18)",
                  boxShadow: isPicked
                    ? "0 12px 28px -10px hsl(42 85% 50% / 0.45)"
                    : "0 10px 22px -10px hsl(0 0% 0% / 0.5)",
                }}
              >
                <div className="text-[22px] leading-none mb-1.5">{opt.emoji}</div>
                <p
                  className="text-[12.5px] font-extrabold leading-tight"
                  style={{ color: isPicked ? "hsl(42 90% 82%)" : "hsl(40 25% 95%)" }}
                >
                  {opt.title}
                </p>
                <p
                  className="text-[10px] mt-0.5 leading-snug"
                  style={{ color: "hsl(40 18% 65%)" }}
                >
                  {opt.sub}
                </p>
                {isPicked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, hsl(42 90% 60%), hsl(38 100% 70%))",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="hsl(220 65% 8%)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
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
function PrayerPreviewMockup() {
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
            {idx === 0 ? "Full-screen prayer alarm" : "Gentle notification"}
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
