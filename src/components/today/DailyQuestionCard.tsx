import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star } from "lucide-react";

import type { QuizQuestion } from "@/data/quizQuestions";
import { localizeQuizQuestion } from "@/i18n/content";
import { useT } from "@/i18n";
import { haptic } from "@/utils/haptics";
import { track } from "@/services/analytics";
import { useRenderCost } from "@/services/perf-attribution";
import { SectionLabel, getThreeHourSeed, useThreeHourCountdown } from "./todayShared";

// ============================================================================
// DAILY BIBLE QUESTION TEASER
// ============================================================================
const DAILY_Q_STORAGE_KEY = "daily-bible-q.v1";

export default function DailyQuestionCard() {
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
