/**
 * Global "Ad loading…" overlay.
 *
 * Shown automatically while a rewarded or interstitial ad is being prepared
 * by `services/ads.ts`. Prevents the dead-time confusion where the user taps
 * a button, nothing visible happens for 1–3s, and they think the app is
 * frozen and navigate away.
 *
 * Triggered via window CustomEvents:
 *   - "jw:ad-loading-start" → show
 *   - "jw:ad-loading-end"   → hide
 *
 * To avoid flashing for instant ads, we delay showing for ~250ms.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useT } from "@/i18n";

export function AdLoadingOverlay() {
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState(() => t("ov.adLoading.default"));

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const onStart = (e: Event) => {
      const detail = (e as CustomEvent).detail as { label?: string } | undefined;
      setLabel(detail?.label || t("ov.adLoading.default"));
      if (showTimer) clearTimeout(showTimer);
      // Only show if it takes longer than ~250ms — avoids flash for warm ads
      showTimer = setTimeout(() => setVisible(true), 250);
      // Safety: never stay open more than 12s even if end event is missed
      if (safetyTimer) clearTimeout(safetyTimer);
      safetyTimer = setTimeout(() => setVisible(false), 12000);
    };
    const onEnd = () => {
      if (showTimer) { clearTimeout(showTimer); showTimer = null; }
      if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
      setVisible(false);
    };

    window.addEventListener("jw:ad-loading-start", onStart);
    window.addEventListener("jw:ad-loading-end", onEnd);
    return () => {
      window.removeEventListener("jw:ad-loading-start", onStart);
      window.removeEventListener("jw:ad-loading-end", onEnd);
      if (showTimer) clearTimeout(showTimer);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{
            background: "hsl(var(--background) / 0.78)",
            backdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="flex flex-col items-center gap-4 px-7 py-6 rounded-2xl"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--glass-border))",
              boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
              minWidth: 220,
            }}
          >
            <div className="relative">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">{label}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t("ov.adLoading.moment")}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
