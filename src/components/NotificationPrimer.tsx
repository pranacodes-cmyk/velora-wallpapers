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
import { POST_ONBOARDING_FLOW_COMPLETE_EVENT } from "@/components/onboarding/OnboardingFlow";

const HOME_PROMPTED_KEY = "jw_notif_home_prompted";
const REPROMPT_DISMISSED_KEY = "jw_notif_reprompt_dismissed_at";
const REPROMPT_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const POST_PAYWALL_SHOWN_KEY = "cw_post_onboarding_premium_shown";

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
 *   4. OR explicitly triggered after post-onboarding paywall
 * If denied, shows a beautiful sheet inviting them to enable.
 */
export function NotificationPrimer() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const releaseRef = useRef<(() => void) | null>(null);

  const releaseLock = () => {
    if (releaseRef.current) { releaseRef.current(); releaseRef.current = null; }
  };

  const tryAsk = async (isManualTrigger = false) => {
    if (window.location.pathname !== "/") return;
    if (!isManualTrigger && document.querySelector("[data-splash]")) return;

    try {
      const status = await getNotificationPermissionStatus();
      addAppLog("info", "[Primer] status", { status });

      if (status === "granted" || status === "unavailable") return;
      
      // If manually triggered (after paywall), we always try to ask.
      // If automatic, respect the cooldown.
      if (!isManualTrigger && isNotificationPromptCoolingDown()) return;

      // Acquire the overlay lock so other overlays wait.
      const release = await acquireOverlay("notification_primer");
      releaseRef.current = release;

      if (status === "denied") {
        setPhase("reprompt");
        return;
      }

      // status === "prompt" — fire native dialog
      setPhase("asking");
      localStorage.setItem(HOME_PROMPTED_KEY, String(Date.now()));
      addAppLog("info", "[Primer] requesting native permission");
      const granted = await requestNotificationPermission();
      addAppLog("info", "[Primer] result", { granted });
      
      if (granted) {
        await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
        setPhase("idle");
        releaseLock();
      } else {
        markNotificationPromptCooldown();
        setPhase("reprompt");
      }
    } catch (err) {
      addAppLog("error", "[Primer] failed", err);
      setPhase("idle");
      releaseLock();
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let triggered = false;
    const onTrigger = () => {
      triggered = true;
      setTimeout(() => void tryAsk(true), 1000);
    };

    window.addEventListener(POST_ONBOARDING_FLOW_COMPLETE_EVENT, onTrigger);

    const interval = setInterval(() => {
      if (triggered) {
        clearInterval(interval);
        return;
      }
      let postPaywallDone = false;
      try { postPaywallDone = localStorage.getItem(POST_PAYWALL_SHOWN_KEY) === "1"; } catch {}
      if (
        postPaywallDone &&
        window.location.pathname === "/" &&
        !document.querySelector("[data-splash]")
      ) {
        triggered = true;
        clearInterval(interval);
        setTimeout(() => void tryAsk(), 800);
      }
    }, 300);

    return () => {
      window.removeEventListener(POST_ONBOARDING_FLOW_COMPLETE_EVENT, onTrigger);
      clearInterval(interval);
      releaseLock();
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => void } | undefined;
    (async () => {
      const sub = await CapacitorApp.addListener("appStateChange", async (state) => {
        if (!state.isActive) return;
        try {
          const status = await getNotificationPermissionStatus();
          if (status === "granted") {
            await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
            setPhase("idle");
          }
        } catch (err) {
          addAppLog("error", "[Primer] resume check failed", err);
        }
      });
      handle = sub;
    })();
    return () => {
      handle?.remove();
    };
  }, []);

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    haptic("medium");
    setPhase("idle");

    try {
      const before = await getNotificationPermissionStatus();
      if (before === "granted") {
        await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
        return;
      }

      await requestNotificationPermission();

      let after = await getNotificationPermissionStatus();
      for (let i = 0; i < 5 && after !== "granted"; i++) {
        await new Promise((r) => setTimeout(r, 300));
        after = await getNotificationPermissionStatus();
      }

      if (after === "granted") {
        await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
        return;
      }

      markNotificationPromptCooldown();
      if (before !== "prompt") {
        try {
          await NotificationPermission.openSettings();
        } catch (err) {
          addAppLog("error", "[Primer] openSettings failed", err);
        }
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
          <div
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(212,168,69,0.35) 0%, transparent 70%)",
              filter: "blur(20px)",
            }}
          />

          <div className="relative px-7 pt-9 pb-7 text-center">
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
              {t("ov.notif.retry.title")}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.45 }}
              className="mt-3 text-[14px] leading-relaxed text-white/65 max-w-xs mx-auto"
            >
              {t("ov.notif.retry.body")}
            </motion.p>

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
                {busy ? t("ov.notif.opening") : t("ov.notif.retry.cta")}
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
