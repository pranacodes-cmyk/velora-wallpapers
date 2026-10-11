import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Star } from "lucide-react";
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  scheduleDailyPrayerNotifications,
} from "@/services/prayer-notifications";
import { NotificationPermission } from "@/lib/notificationPermissionPlugin";
import { addAppLog } from "@/services/app-logs";
import { haptic } from "@/utils/haptics";
import { acquireOverlay } from "@/lib/overlayQueue";
import { t } from "@/i18n";

const HOME_PROMPTED_KEY = "jw_notif_home_prompted";
const REPROMPT_DISMISSED_KEY = "jw_notif_reprompt_dismissed_at";
const REPROMPT_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

type Phase = "idle" | "asking" | "reprompt";

const isNotificationPromptCoolingDown = () => {
  try {
    const dismissedAt = Number(localStorage.getItem(REPROMPT_DISMISSED_KEY) || 0);
    const promptedAt = Number(localStorage.getItem(HOME_PROMPTED_KEY) || 0);
    const lastTouchAt = Math.max(dismissedAt, promptedAt);
    return Boolean(lastTouchAt && Date.now() - lastTouchAt < REPROMPT_COOLDOWN_MS);
  } catch {
    return false;
  }
};

const markNotificationPromptCooldown = () => {
  try {
    const now = String(Date.now());
    localStorage.setItem(REPROMPT_DISMISSED_KEY, now);
    localStorage.setItem(HOME_PROMPTED_KEY, now);
  } catch {}
};

/**
 * Asks for notification permission AFTER:
 *   1. Native platform
 *   2. Splash overlay is fully gone
 *   3. User is on the homepage ("/")
 * If denied, shows a beautiful sheet inviting them to enable.
 */
export function NotificationPrimer() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const releaseRef = useRef<(() => void) | null>(null);

  const releaseLock = () => {
    if (releaseRef.current) { releaseRef.current(); releaseRef.current = null; }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let triggered = false;

    const tryAsk = async () => {
      if (cancelled || triggered) return;
      if (window.location.pathname !== "/") return;
      if (document.querySelector("[data-splash]")) return;

      triggered = true;
      try {
        const status = await getNotificationPermissionStatus();
        addAppLog("info", "[Primer] status", { status });

        if (status === "granted" || status === "unavailable") return;
        if (isNotificationPromptCoolingDown()) return;

        // Acquire the overlay lock so the premium paywall waits for our
        // native dialog / reprompt sheet to finish before opening.
        const release = await acquireOverlay("notification_primer");
        if (cancelled) { release(); return; }
        releaseRef.current = release;

        if (status === "denied") {
          // Reprompt sheet — lock is released in handleEnable/handleLater.
          setPhase("reprompt");
          return;
        }

        // status === "prompt" — fire native dialog
        setPhase("asking");
        localStorage.setItem(HOME_PROMPTED_KEY, String(Date.now()));
        addAppLog("info", "[Primer] requesting native permission");
        const granted = await requestNotificationPermission();
        addAppLog("info", "[Primer] result", { granted });
        if (cancelled) { releaseLock(); return; }
        if (granted) {
          await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
          setPhase("idle");
          releaseLock();
        } else {
          markNotificationPromptCooldown();
          // Show reprompt sheet — lock stays held until user dismisses it.
          setPhase("reprompt");
        }
      } catch (err) {
        addAppLog("error", "[Primer] failed", err);
        setPhase("idle");
        releaseLock();
      }
    };

    // Poll until splash is gone & we're on home, then ask
    const interval = setInterval(() => {
      if (triggered || cancelled) {
        clearInterval(interval);
        return;
      }
      if (
        window.location.pathname === "/" &&
        !document.querySelector("[data-splash]")
      ) {
        clearInterval(interval);
        // small breathing room for the home UI to settle
        setTimeout(() => void tryAsk(), 800);
      }
    }, 300);

    // Safety stop after 30s
    const stopT = setTimeout(() => clearInterval(interval), 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(stopT);
      releaseLock();
    };
  }, []);

  // When the user returns from system Settings, re-check permission and
  // dismiss the sheet / schedule notifications if they enabled it.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => void } | undefined;
    let cancelled = false;
    (async () => {
      const sub = await CapacitorApp.addListener("appStateChange", async (state) => {
        if (!state.isActive) return;
        try {
          const status = await getNotificationPermissionStatus();
          if (status === "granted") {
            await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
            if (!cancelled) setPhase("idle");
          }
        } catch (err) {
          addAppLog("error", "[Primer] resume check failed", err);
        }
      });
      handle = sub;
    })();
    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, []);

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    haptic("medium");

    // Never keep the convincing sheet visible while Android is handling the
    // system permission dialog. Some OEMs do not resolve the permission call
    // immediately after the user taps Allow/Deny, which left this button stuck
    // on "Opening…" until the backdrop was tapped. The user's intent is clear:
    // open the permission flow, then get this sheet out of the way.
    setPhase("idle");

    try {
      const before = await getNotificationPermissionStatus();
      addAppLog("info", "[Primer] handleEnable status", { before });

      if (before === "granted") {
        await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
        return;
      }

      // Fire the native request. Some Android OEMs return a stale `false`
      // even when the user tapped Allow, so we ignore it and trust a
      // post-call status re-check instead.
      let requestResult = false;
      try {
        requestResult = await requestNotificationPermission();
      } catch (err) {
        addAppLog("error", "[Primer] request threw", err);
      }
      addAppLog("info", "[Primer] request result", { requestResult });

      // Poll for up to ~1.5s — gives the OS time to commit the new state.
      let after = await getNotificationPermissionStatus();
      for (let i = 0; i < 5 && after !== "granted"; i++) {
        await new Promise((r) => setTimeout(r, 300));
        after = await getNotificationPermissionStatus();
      }
      addAppLog("info", "[Primer] post-request status", { after });

      if (after === "granted") {
        await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
        return;
      }

      // User denied (either at the native dialog or it was already blocked).
      // Record the dismissal so we don't pester them again until the cooldown
      // (5 days) has elapsed — even across app restarts.
      markNotificationPromptCooldown();

      // If the OS dialog actually appeared (i.e. status was "prompt" before),
      // and the user dismissed/denied it, just close the sheet — do NOT shove
      // them into system settings. They'll see the reprompt again after cooldown.
      if (before === "prompt") {
        return;
      }

      // Status was already "denied" before AND the request didn't move it →
      // permanently blocked. Open settings as a last resort, then dismiss.
      try {
        await NotificationPermission.openSettings();
      } catch (err) {
        addAppLog("error", "[Primer] openSettings failed", err);
      }
    } finally {
      setBusy(false);
      releaseLock();
    }
  };

  const handleLater = () => {
    haptic("soft");
    markNotificationPromptCooldown();
    setPhase("idle");
    releaseLock();
  };

  if (phase !== "reprompt") return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="primer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center"
        onClick={handleLater}
      >
        <motion.div
          key="primer-sheet"
          initial={{ y: 60, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md mx-4 mb-6 sm:mb-0 rounded-3xl overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, hsl(225 35% 12%) 0%, hsl(228 40% 8%) 100%)",
            border: "1px solid rgba(212, 168, 69, 0.25)",
            boxShadow:
              "0 30px 80px -20px rgba(0,0,0,0.7), 0 0 60px -20px rgba(212,168,69,0.25)",
          }}
        >
          {/* Glow accent */}
          <div
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(212,168,69,0.35) 0%, transparent 70%)",
              filter: "blur(20px)",
            }}
          />

          <div className="relative px-7 pt-9 pb-7 text-center">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 260 }}
              className="mx-auto mb-5 w-16 h-16 rounded-2xl flex items-center justify-center relative"
              style={{
                background:
                  "linear-gradient(135deg, rgba(212,168,69,0.25), rgba(212,168,69,0.08))",
                border: "1px solid rgba(212,168,69,0.4)",
              }}
            >
              <Bell className="w-7 h-7" style={{ color: "#d4a845" }} />
              <Star
                className="absolute -top-1.5 -right-1.5 w-4 h-4"
                style={{ color: "#d4a845" }}
              />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.45 }}
              className="text-[20px] font-semibold tracking-tight text-white"
              style={{ fontFamily: "'Georgia', serif" }}
            >
              {t("ov.notif.title")}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.45 }}
              className="mt-3 text-[14px] leading-relaxed text-white/65 max-w-xs mx-auto"
            >
              {t("ov.notif.body")}
            </motion.p>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34, duration: 0.45 }}
              className="mt-7 flex flex-col gap-2.5"
            >
              <button
                onClick={handleEnable}
                disabled={busy}
                className="w-full py-3.5 rounded-2xl text-[15px] font-semibold tracking-wide transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(135deg, #d4a845 0%, #b8862a 100%)",
                  color: "#1a1408",
                  boxShadow: "0 10px 30px -10px rgba(212,168,69,0.6)",
                }}
              >
                {busy ? t("ov.notif.opening") : t("ov.notif.enable")}
              </button>
              <button
                onClick={handleLater}
                className="w-full py-3 rounded-2xl text-[13px] font-medium text-white/55 hover:text-white/75 transition-colors"
              >
                {t("ov.notif.later")}
              </button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
