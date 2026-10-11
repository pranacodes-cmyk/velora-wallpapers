import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Star } from "lucide-react";

import { useJourneyProgress } from "@/hooks/useJourneyProgress";
import { FOCUS_META, focusToJourneyId, getUserFocus, type UserFocus } from "@/lib/userProfile";
import { haptic } from "@/utils/haptics";
import { track } from "@/services/analytics";
import { useT } from "@/i18n";

type JourneysModule = typeof import("@/data/journeys");

// PERSONALIZED JOURNEY CARD
// ============================================================================
/**
 * Loader shell: pulls the journey dataset in only after the home screen has
 * painted, then renders the real card. Reserves the card's height so nothing
 * jumps when it arrives.
 */
export default function PersonalizedJourneyCard() {
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
