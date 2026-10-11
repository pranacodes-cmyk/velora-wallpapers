import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { motion, AnimatePresence } from "framer-motion";
import { BellRing, Smartphone, HandHeart } from "lucide-react";
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  scheduleDailyPrayerNotifications,
} from "@/services/prayer-notifications";
import { NotificationPermission } from "@/lib/notificationPermissionPlugin";
import PrayerAlarm from "@/plugins/prayer-alarm";
import { haptic } from "@/utils/haptics";
import { addAppLog } from "@/services/app-logs";
import { usePremium } from "@/hooks/usePremium";
import { acquireOverlay } from "@/lib/overlayQueue";
import { t } from "@/i18n";

const ONBOARDING_TS_KEY = "cw_onboarded_v3_at";
const DAY_ONE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Daily re-prompt for ANY missing permission (notifications + display-over-other-apps).
 *
 * Rules:
 *  - Runs only on native Android, only on the home route after splash.
 *  - Shows at most ONCE per calendar day (local date).
 *  - If notif is "denied"/"prompt" OR overlay is missing, surfaces a clean
 *    sheet and lets the user fix each with one tap.
 *  - Tomorrow, if anything is still missing, we ask again.
 */

const DAY_KEY = "prayly:dailyPermNudge:lastShownDay";

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const alreadyShownToday = () => {
  try { return localStorage.getItem(DAY_KEY) === todayKey(); } catch { return false; }
};
const markShownToday = () => {
  try { localStorage.setItem(DAY_KEY, todayKey()); } catch {}
};

type MissingState = { notif: boolean; overlay: boolean };

async function readMissing(): Promise<MissingState> {
  let notif = false;
  let overlay = false;
  try {
    const s = await getNotificationPermissionStatus();
    notif = s === "denied" || s === "prompt";
  } catch {}
  try {
    const st = await PrayerAlarm.getStatus();
    overlay = !st.overlayAllowed;
  } catch {}
  return { notif, overlay };
}

// Per-permission visual theme — two distinct accents so the cards read
// as different surfaces, not as a repeated row.
const THEMES = {
  notif: {
    icon: BellRing,
    accent: "#E8C36B", // warm gold
    accentDeep: "#B8862A",
    glow: "rgba(232,195,107,0.32)",
    chipBg: "linear-gradient(135deg, rgba(232,195,107,0.22), rgba(232,195,107,0.06))",
    chipBorder: "rgba(232,195,107,0.45)",
    btnText: "#1A1408",
  },
  overlay: {
    icon: Smartphone,
    accent: "#8FB8FF", // royal blue
    accentDeep: "#3B6FD9",
    glow: "rgba(143,184,255,0.32)",
    chipBg: "linear-gradient(135deg, rgba(143,184,255,0.22), rgba(143,184,255,0.06))",
    chipBorder: "rgba(143,184,255,0.45)",
    btnText: "#0B1428",
  },
} as const;

export function DailyPermissionNudge() {
  const { isPremium } = usePremium();
  const [missing, setMissing] = useState<MissingState | null>(null);
  const [busy, setBusy] = useState<"notif" | "overlay" | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);

  const releaseLock = () => {
    if (releaseRef.current) { releaseRef.current(); releaseRef.current = null; }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isPremium) return;
    let cancelled = false;
    let fired = false;

    const isFirstDay = () => {
      try {
        const ts = Number(localStorage.getItem(ONBOARDING_TS_KEY) || 0);
        if (!ts) {
          // Backfill once if the timestamp wasn't recorded — assume now,
          // which means we'll skip today's nudge for fresh installs.
          if (localStorage.getItem("cw_onboarded_v3") === "true") {
            localStorage.setItem(ONBOARDING_TS_KEY, String(Date.now()));
            return true;
          }
          return false;
        }
        return Date.now() - ts < DAY_ONE_GRACE_MS;
      } catch { return false; }
    };

    const evaluate = async () => {
      if (cancelled || fired) return;
      if (window.location.pathname !== "/") return;
      if (document.querySelector("[data-splash]")) return;
      if (alreadyShownToday()) return;
      // Day 1 belongs to onboarding → notif primer + premium paywall.
      // Don't pile a third sheet on the user's first day.
      if (isFirstDay()) return;

      const m = await readMissing();
      if (cancelled) return;
      if (!m.notif && !m.overlay) return;

      // Wait for the notif primer / premium sheet to finish first.
      const release = await acquireOverlay("daily_perm_nudge");
      if (cancelled) { release(); return; }
      // Re-check after acquiring — state may have changed while we waited.
      if (alreadyShownToday()) { release(); return; }
      const m2 = await readMissing();
      if (!m2.notif && !m2.overlay) { release(); return; }

      releaseRef.current = release;
      fired = true;
      markShownToday();
      setMissing(m2);
      addAppLog("info", "[DailyPermNudge] showing", m2);
    };

    const interval = setInterval(() => {
      if (fired || cancelled) { clearInterval(interval); return; }
      if (
        window.location.pathname === "/" &&
        !document.querySelector("[data-splash]")
      ) {
        clearInterval(interval);
        setTimeout(() => void evaluate(), 2200);
      }
    }, 350);
    const stopT = setTimeout(() => clearInterval(interval), 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(stopT);
      releaseLock();
    };
  }, [isPremium]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => void } | undefined;
    (async () => {
      const sub = await CapacitorApp.addListener("appStateChange", async (s) => {
        if (!s.isActive || !missing) return;
        const m = await readMissing();
        if (!m.notif && !m.overlay) { setMissing(null); releaseLock(); }
        else setMissing(m);
      });
      handle = sub;
    })();
    return () => handle?.remove();
  }, [missing]);

  const handleNotif = async () => {
    if (busy) return;
    setBusy("notif");
    haptic("medium");
    try {
      const before = await getNotificationPermissionStatus();
      if (before === "prompt") {
        await requestNotificationPermission();
      } else {
        try { await NotificationPermission.openSettings(); } catch {}
      }
      for (let i = 0; i < 4; i++) {
        const s = await getNotificationPermissionStatus();
        if (s === "granted") {
          await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      const m = await readMissing();
      if (!m.notif && !m.overlay) { setMissing(null); releaseLock(); }
      else setMissing(m);
    } finally {
      setBusy(null);
    }
  };

  const handleOverlay = async () => {
    if (busy) return;
    setBusy("overlay");
    haptic("medium");
    try {
      await PrayerAlarm.openOverlaySettings();
    } finally {
      setBusy(null);
    }
  };

  const handleLater = () => {
    haptic("soft");
    setMissing(null);
    releaseLock();
  };

  if (!missing || (!missing.notif && !missing.overlay)) return null;

  const keys: Array<"notif" | "overlay"> = [];
  if (missing.notif) keys.push("notif");
  if (missing.overlay) keys.push("overlay");

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="daily-nudge-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center"
        onClick={handleLater}
      >
        <motion.div
          key="daily-nudge-sheet"
          initial={{ y: 60, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md mx-4 mb-5 sm:mb-0 rounded-[28px] overflow-hidden"
          style={{
            background: "linear-gradient(180deg, hsl(225 38% 13%) 0%, hsl(228 42% 7%) 100%)",
            border: "1px solid rgba(232,195,107,0.22)",
            boxShadow:
              "0 30px 80px -20px rgba(0,0,0,0.75), 0 0 70px -20px rgba(232,195,107,0.25)",
          }}
        >
          {/* Soft gold glow halo */}
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(232,195,107,0.38) 0%, transparent 70%)",
              filter: "blur(24px)",
            }}
          />

          <div className="relative px-7 pt-9 pb-7">
            {/* Hero icon — praying hands w/ heart, not a sparkle */}
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.55, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.08, type: "spring", stiffness: 240 }}
                className="mx-auto mb-5 w-[68px] h-[68px] rounded-[22px] flex items-center justify-center relative"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(232,195,107,0.28), rgba(232,195,107,0.06))",
                  border: "1px solid rgba(232,195,107,0.45)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                <HandHeart className="w-8 h-8" style={{ color: "#F0D78C" }} />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.4 }}
                className="text-[21px] font-semibold tracking-tight text-white leading-snug"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                {t("ov.perm.title")}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.4 }}
                className="mt-2.5 text-[13.5px] leading-relaxed text-white/65 max-w-[18rem] mx-auto"
              >
                {t("ov.perm.body")}
              </motion.p>
            </div>

            {/* Permission cards — each themed differently */}
            <div className="mt-7 space-y-3">
              {keys.map((k, idx) => {
                const th = THEMES[k];
                const Icon = th.icon;
                const onClick = k === "notif" ? handleNotif : handleOverlay;
                return (
                  <motion.div
                    key={k}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28 + idx * 0.09, duration: 0.4 }}
                    className="relative rounded-2xl p-4 overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                      border: `1px solid ${th.chipBorder}`,
                    }}
                  >
                    {/* per-card accent wash */}
                    <div
                      className="absolute -right-10 -top-10 w-32 h-32 rounded-full pointer-events-none"
                      style={{
                        background: `radial-gradient(circle, ${th.glow} 0%, transparent 70%)`,
                        filter: "blur(8px)",
                      }}
                    />

                    <div className="relative flex items-start gap-3.5">
                      <div
                        className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
                        style={{
                          background: th.chipBg,
                          border: `1px solid ${th.chipBorder}`,
                        }}
                      >
                        <Icon className="w-[22px] h-[22px]" style={{ color: th.accent }} />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="text-[14.5px] font-semibold text-white leading-tight">
                          {t(`ov.perm.${k}.title`)}
                        </div>
                        <div className="mt-1 text-[12.5px] text-white/60 leading-relaxed">
                          {t(`ov.perm.${k}.body`)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={onClick}
                      disabled={busy === k}
                      className="relative mt-3.5 w-full py-2.5 rounded-xl text-[13px] font-semibold tracking-wide transition-transform active:scale-[0.98] disabled:opacity-60"
                      style={{
                        background: `linear-gradient(135deg, ${th.accent} 0%, ${th.accentDeep} 100%)`,
                        color: th.btnText,
                        boxShadow: `0 8px 22px -10px ${th.glow}`,
                      }}
                    >
                      {busy === k ? t("ov.perm.opening") : t(`ov.perm.${k}.cta`)}
                    </button>
                  </motion.div>
                );
              })}
            </div>

            <button
              onClick={handleLater}
              className="mt-5 w-full py-3 rounded-2xl text-[13px] font-medium text-white/55 hover:text-white/75 transition-colors"
            >
              {t("ov.perm.notToday")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
