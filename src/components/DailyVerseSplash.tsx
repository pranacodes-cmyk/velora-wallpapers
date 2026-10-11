import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDailyVerse } from "@/hooks/useDailyVerse";
import { useStreak } from "@/hooks/useStreak";
import { haptic } from "@/utils/haptics";
import divineBgDark from "@/assets/divine-bg-dark.webp";
import divineBgLight from "@/assets/divine-bg-light.webp";
import { useT } from "@/i18n";

const SPLASH_KEY = "cw_verse_splash_date";

function shouldShow(): boolean {
  try {
    if (window.location.pathname === "/parallax") return false;
    const root = document.documentElement;
    // The Android ANR cluster is during cold start render. Do not put a
    // full-screen animated image splash over the first frame on those devices.
    if (root.classList.contains("android-device") || root.classList.contains("low-end-device")) return false;
    const today = new Date().toISOString().split("T")[0];
    return localStorage.getItem(SPLASH_KEY) !== today;
  } catch {
    return false;
  }
}

function markShown() {
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem(SPLASH_KEY, today);
}

function useSystemTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDark;
}

export function DailyVerseSplash() {
  const { t } = useT();
  const [visible, setVisible] = useState(() => shouldShow());
  const [bgLoaded, setBgLoaded] = useState(false);
  const { verse } = useDailyVerse();
  const { current: streak } = useStreak();
  const isDark = useSystemTheme();
  const constrainedStartup =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("startup-safe-mode") ||
      document.documentElement.classList.contains("low-end-device"));

  const dismiss = useCallback(() => {
    setVisible(false);
    markShown();
    haptic("soft");
    window.dispatchEvent(new CustomEvent("splash-dismissed"));
  }, []);

  useEffect(() => {
    if (!visible) return;
    import("@/services/analytics").then((a) => a.track("daily_verse_viewed", {
      reference: (verse as any)?.reference || (verse as any)?.ref,
    })).catch(() => {});
    const t = setTimeout(dismiss, 6000);
    return () => clearTimeout(t);
  }, [visible, dismiss, verse]);


  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);

  const bgImg = isDark ? divineBgDark : divineBgLight;
  const overlayColor = isDark
    ? "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.85) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.7) 100%)";
  const textColor = isDark ? "#fff" : "#1a1a2e";
  const goldColor = isDark ? "#d4a845" : "#a07828";
  const subTextColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(26,26,46,0.5)";

  if (!visible) return null;

  return (
    <>
      {/* Solid blocker — prevents flash of app content */}
      <div
        data-splash
        className="fixed inset-0 z-[9998]"
        style={{ background: isDark ? "#000" : "#f5f0e8" }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: bgLoaded ? 1 : 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
        onClick={dismiss}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-end cursor-pointer select-none overflow-hidden"
      >
        {/* Full-bleed divine background */}
        <motion.img
          src={bgImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          decoding="async"
          initial={{ scale: constrainedStartup ? 1 : 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: constrainedStartup ? 0 : 6, ease: "easeOut" }}
          onLoad={() => setBgLoaded(true)}
        />

          {/* Gradient overlay for text readability */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: overlayColor }}
          />

          {/* Content container - positioned in lower half */}
          <div className="relative z-10 flex flex-col items-center w-full px-8 pb-20">

            {/* Cross icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.7, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.8, type: "spring" }}
              className="mb-5"
            >
              <svg width="28" height="40" viewBox="0 0 28 40" fill="none">
                <rect x="10" y="0" width="8" height="40" rx="2" fill={goldColor} opacity="0.6" />
                <rect x="0" y="9" width="28" height="8" rx="2" fill={goldColor} opacity="0.6" />
              </svg>
            </motion.div>

            {/* Day counter */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.5, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-[9px] font-semibold tracking-[0.35em] uppercase mb-6"
              style={{ color: goldColor }}
            >
              {t("ov.splash.dayYear", { day: dayOfYear, year: now.getFullYear() })}
            </motion.p>

            {/* Verse text */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="text-center text-[22px] leading-[1.6] font-light italic max-w-[320px]"
              style={{
                fontFamily: "'Georgia', 'Times New Roman', serif",
                color: textColor,
              }}
            >
              "{verse.text}"
            </motion.p>

            {/* Reference */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3, duration: 0.6 }}
              className="mt-5 text-[11px] font-bold tracking-[0.25em] uppercase"
              style={{ color: goldColor }}
            >
              — {verse.reference}
            </motion.p>

            {/* Streak badge */}
            {streak > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.6, duration: 0.5 }}
                className="mt-8 flex items-center gap-2 px-4 py-2 rounded-full"
                style={{
                  background: isDark ? "rgba(212,168,69,0.12)" : "rgba(160,120,40,0.1)",
                  border: `1px solid ${isDark ? "rgba(212,168,69,0.2)" : "rgba(160,120,40,0.15)"}`,
                }}
              >
                <span className="text-[14px]">🔥</span>
                <span
                  className="text-[11px] font-bold tabular-nums tracking-wide"
                  style={{ color: goldColor }}
                >
                  {t("ov.splash.streak", { count: streak })}
                </span>
              </motion.div>
            )}

            {/* Tap hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ delay: 2.5, duration: 1 }}
              className="mt-10 text-[8px] tracking-[0.35em] uppercase"
              style={{ color: subTextColor }}
            >
              {t("ov.splash.tapHint")}
            </motion.p>
          </div>

          {/* Progress bar */}
          <motion.div
            className="absolute bottom-0 left-0 h-[2px] z-20"
            style={{
              background: `linear-gradient(90deg, transparent, ${goldColor}, transparent)`,
              opacity: 0.6,
            }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 6, ease: "linear" }}
          />
      </motion.div>
    </>
  );
}
