import { useState, useEffect } from "react";
import { Flame } from "lucide-react";
import { useStreak } from "@/hooks/useStreak";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";

/**
 * Streak badge in the Today header.
 *
 * Previous version stacked: two expanding attention rings, a 5-keyframe
 * scale-bounce entrance, an infinite shimmer sweep, and a 200ms polling
 * loop for the splash element. On low-end Androids this was a measurable
 * source of jank on home open (every render pass triggered another GPU
 * sample of the gradient + shadow). User explicitly called these
 * animations useless — so we keep the badge + the tap-to-open tooltip,
 * and drop every infinite/repaint-heavy effect. A single CSS fade-in
 * preserves the "appears after splash" feel at ~0 cost.
 */
export function StreakBadge() {
  const { t } = useT();
  const { current, longest } = useStreak();
  const [showTooltip, setShowTooltip] = useState(false);

  // Auto-close tooltip on scroll anywhere
  useEffect(() => {
    if (!showTooltip) return;
    const close = () => setShowTooltip(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("touchmove", close, { capture: true, passive: true });
    window.addEventListener("wheel", close, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", close, { capture: true } as any);
      window.removeEventListener("touchmove", close, { capture: true } as any);
      window.removeEventListener("wheel", close, { capture: true } as any);
    };
  }, [showTooltip]);

  if (current < 1) return null;

  const isHot = current >= 7;
  const isOnFire = current >= 3;

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          haptic("soft");
          setShowTooltip((prev) => !prev);
        }}
        className="flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full relative overflow-hidden animate-fade-in active:scale-95 transition-transform"
        style={{
          background: isHot
            ? "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))"
            : "hsl(var(--primary) / 0.14)",
          border: isHot ? "none" : "1px solid hsl(var(--primary) / 0.22)",
          boxShadow: isHot
            ? "0 3px 18px hsl(var(--primary) / 0.45), inset 0 1px 0 rgba(255,255,255,0.18)"
            : "0 2px 10px hsl(var(--primary) / 0.18), inset 0 1px 0 hsl(var(--primary) / 0.08)",
        }}
      >
        <Flame
          className={`w-[17px] h-[17px] ${isHot ? "text-white" : "text-primary"} drop-shadow-[0_1px_2px_hsl(var(--primary)/0.4)]`}
          strokeWidth={2.4}
          fill={isOnFire ? "currentColor" : "none"}
        />
        <span
          className={`text-[15px] font-black tabular-nums leading-none tracking-tight ${
            isHot ? "text-white" : "text-primary"
          }`}
          style={{ textShadow: isHot ? "0 1px 2px rgba(0,0,0,0.18)" : undefined }}
        >
          {current}
        </span>
      </button>

      {/* Tooltip — only mounted while open, plain CSS fade. No AnimatePresence. */}
      {showTooltip && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowTooltip(false)}
          />
          <div
            className="absolute top-full right-0 mt-2 z-50 w-56 rounded-2xl p-4 overflow-hidden animate-fade-in"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--glass-border))",
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.1))",
                }}
              >
                <Flame className="w-5 h-5 text-primary" fill="currentColor" />
              </div>
              <div>
                <p className="text-[13px] font-extrabold text-foreground">{t("today.badge.dailyStreak")}</p>
                <p className="text-[10px] text-muted-foreground">{t("today.badge.openDaily")}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <div
                className="flex-1 rounded-xl p-2.5 text-center"
                style={{ background: "hsl(var(--primary) / 0.08)" }}
              >
                <p className="text-[18px] font-black text-primary tabular-nums">{current}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{t("today.badge.current")}</p>
              </div>
              <div
                className="flex-1 rounded-xl p-2.5 text-center"
                style={{ background: "hsl(var(--accent) / 0.08)" }}
              >
                <p className="text-[18px] font-black text-accent tabular-nums">{longest}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{t("today.badge.best")}</p>
              </div>
            </div>

            <div
              className="flex items-center gap-2 mt-3 p-2 rounded-lg"
              style={{ background: "hsl(var(--primary) / 0.06)" }}
            >
              <span className="text-[13px]">✝️</span>
              <p className="text-[10px] text-muted-foreground leading-snug">
                {t("today.badge.freshVerse")}
              </p>
            </div>

            <p className="text-[10px] text-muted-foreground text-center mt-2 leading-relaxed">
              {current >= 7
                ? t("today.badge.msgHot")
                : current >= 3
                ? t("today.badge.msgWarm")
                : t("today.badge.msgCold")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
