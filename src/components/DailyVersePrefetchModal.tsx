import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cross, Check, Sun, Loader2, WifiOff } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import DailyVerseWallpaper, {
  type PrefetchProgress,
  type PrefetchResult,
} from "@/plugins/daily-verse-wallpaper";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: (result: PrefetchResult) => void;
  /** Force re-download even if cache exists (for manual "Refresh" tap). */
  force?: boolean;
  /** Download only today's background (used for free users — no full pack). */
  single?: boolean;
}

/**
 * Full-screen modal that downloads the 10 R2 backgrounds + 365 verses to the
 * device so the live wallpaper service can render fully offline. Apple-grade
 * polish — animated progress bar, golden cross, real-time file callouts.
 */
export function DailyVersePrefetchModal({ open, onClose, onComplete, force, single }: Props) {
  const { t } = useT();
  const [phase, setPhase] = useState<"idle" | "downloading" | "done" | "error">("idle");
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(single ? 1 : 10);
  const [errorMsg, setErrorMsg] = useState("");
  const startedRef = useRef(false);
  const listenerRef = useRef<PluginListenerHandle | null>(null);

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setPhase("idle");
      setCurrent(0);
      setErrorMsg("");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    const run = async () => {
      if (!Capacitor.isNativePlatform()) {
        setPhase("error");
        setErrorMsg(t("px.prefetch.errorAndroidOnly"));
        return;
      }

      setPhase("downloading");
      try {
        const handle = await DailyVerseWallpaper.addListener("progress", (p: PrefetchProgress) => {
          if (cancelled) return;
          setCurrent(p.current);
          setTotal(p.total);
          if (p.ok) haptic("soft");
        });
        listenerRef.current = handle;

        const result = await DailyVerseWallpaper.prefetchAssets({ force, single });
        if (cancelled) return;

        if (result.success && result.downloaded + (result.total - result.downloaded) >= result.total) {
          setCurrent(result.total);
          setPhase("done");
          haptic("heavy");
          // brief celebration before handing back to caller
          setTimeout(() => {
            if (!cancelled) onComplete(result);
          }, 900);
        } else {
          setPhase("error");
          setErrorMsg(t("px.prefetch.errorIncomplete"));
        }
      } catch (err: any) {
        if (cancelled) return;
        setPhase("error");
        setErrorMsg(err?.message || t("px.prefetch.errorDownloadFailed"));
      } finally {
        listenerRef.current?.remove().catch(() => {});
        listenerRef.current = null;
      }
    };

    run();
    return () => {
      cancelled = true;
      listenerRef.current?.remove().catch(() => {});
      listenerRef.current = null;
    };
  }, [open, force, onComplete]);

  const pct = phase === "done" ? 100 : Math.round((current / Math.max(1, total)) * 100);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dv-prefetch"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(var(--background) / 0.98), hsl(var(--background)))",
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
          }}
        >
          <motion.div
            initial={{ scale: 0.92, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[360px] rounded-[28px] p-7 text-center"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--glass-border))",
              boxShadow:
                "0 30px 80px -20px hsl(var(--primary) / 0.45), 0 0 0 1px hsl(var(--primary) / 0.08)",
            }}
          >
            {/* Animated golden cross */}
            <div className="relative mx-auto mb-5 w-16 h-16 flex items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, hsl(var(--premium-gold-glow) / 0.45), transparent 70%)",
                }}
                animate={{ scale: phase === "done" ? [1, 1.4, 1] : [1, 1.18, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: phase === "done" ? 0.7 : 2.2, repeat: phase === "done" ? 0 : Infinity }}
              />
              <motion.div
                animate={
                  phase === "done"
                    ? { rotate: [0, -6, 6, 0], scale: [1, 1.15, 1] }
                    : { rotate: phase === "downloading" ? [0, 0, 0] : 0 }
                }
                transition={{ duration: 0.6 }}
                className="relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--premium-gold)), hsl(var(--premium-gold-glow)))",
                  boxShadow: "0 8px 24px hsl(var(--premium-gold) / 0.4)",
                }}
              >
                {phase === "done" ? (
                  <Check className="w-6 h-6 text-white" strokeWidth={3} />
                ) : phase === "error" ? (
                  <WifiOff className="w-6 h-6 text-white" />
                ) : (
                  <Cross className="w-6 h-6 text-white" strokeWidth={2.5} />
                )}
              </motion.div>
            </div>

            <h2 className="text-[18px] font-black tracking-tight text-foreground mb-1.5">
              {phase === "done"
                ? t("px.prefetch.readyTitle")
                : phase === "error"
                ? t("px.prefetch.errorTitle")
                : single
                ? t("px.prefetch.singleTitle")
                : t("px.prefetch.multiTitle")}
            </h2>
            <p className="text-[12px] text-foreground/65 leading-relaxed mb-6 px-2">
              {phase === "done"
                ? single
                  ? t("px.prefetch.doneSingleBody")
                  : t("px.prefetch.doneMultiBody")
                : phase === "error"
                ? errorMsg
                : single
                ? t("px.prefetch.singleDownloadingBody")
                : t("px.prefetch.multiDownloadingBody")}
            </p>


            {/* Progress bar */}
            {phase !== "error" && (
              <>
                <div
                  className="relative h-2 rounded-full overflow-hidden mb-3"
                  style={{ background: "hsl(var(--foreground) / 0.08)" }}
                >
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, hsl(var(--premium-gold)), hsl(var(--premium-gold-glow)))",
                      boxShadow: "0 0 16px hsl(var(--premium-gold-glow) / 0.6)",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold tracking-wide">
                  <span className="text-foreground/60 uppercase">
                    {phase === "done"
                      ? t("px.prefetch.complete")
                      : single
                      ? t("px.prefetch.todaysWallpaper")
                      : t("px.prefetch.wallpaperOfTotal", { current, total })}
                  </span>
                  <span style={{ color: "hsl(var(--premium-gold))" }}>{pct}%</span>
                </div>

                {/* Verse-pack confirmation row */}
                <div className="mt-5 pt-4 border-t border-foreground/5 flex items-center justify-center gap-2 text-[11px] text-foreground/70 font-semibold">
                  {phase === "done" ? (
                    <>
                      <Check className="w-3.5 h-3.5" style={{ color: "hsl(142 71% 45%)" }} />
                      <span>{single ? t("px.prefetch.todaysVerseReady") : t("px.prefetch.versesBundled")}</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{single ? t("px.prefetch.almostThere") : t("px.prefetch.bundling365")}</span>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Footer actions */}
            {phase === "error" && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    haptic("medium");
                    onClose();
                  }}
                  className="flex-1 py-3 rounded-2xl text-[12px] font-bold text-foreground/80"
                  style={{
                    background: "hsl(var(--foreground) / 0.06)",
                    border: "1px solid hsl(var(--foreground) / 0.1)",
                  }}
                >
                  {t("px.close")}
                </button>
                <button
                  onClick={() => {
                    startedRef.current = false;
                    setPhase("idle");
                    // re-trigger by closing then re-opening from caller; simpler: nudge effect
                    setTimeout(() => {
                      startedRef.current = false;
                      setCurrent(0);
                      // Force re-run by toggling a small state trick
                      setPhase("downloading");
                      DailyVerseWallpaper.prefetchAssets({ force: true })
                        .then((r) => {
                          if (r.success) {
                            setPhase("done");
                            setTimeout(() => onComplete(r), 700);
                          } else {
                            setPhase("error");
                            setErrorMsg(t("px.prefetch.errorStillFailing"));
                          }
                        })
                        .catch((e) => {
                          setPhase("error");
                          setErrorMsg(e?.message || t("px.prefetch.errorRetryFailed"));
                        });
                    }, 50);
                  }}
                  className="flex-1 py-3 rounded-2xl text-[12px] font-black text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--premium-gold)), hsl(var(--premium-gold-glow)))",
                    boxShadow: "0 8px 22px hsl(var(--premium-gold) / 0.4)",
                  }}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Sun className="w-3.5 h-3.5" />
                    {t("px.prefetch.retry")}
                  </span>
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
