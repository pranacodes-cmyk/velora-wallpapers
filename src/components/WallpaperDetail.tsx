import { ArrowLeft, Home, Lock, Download, Share2, Smartphone, Layers, ChevronLeft, ChevronRight, Play, Crown, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect, useRef } from "react";
import type { Wallpaper } from "@/data/wallpapers";
import { PremiumSheet } from "./PremiumSheet";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { usePremium } from "@/hooks/usePremium";
import WallpaperSetter from "@/plugins/wallpaper-setter";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { useProxyImage } from "@/hooks/useProxyImage";
import { getDirectImageUrl } from "@/utils/imageUrl";
import { haptic } from "@/utils/haptics";
import { showRewardedAd } from "@/services/ads";
import { recordSwipeAndMaybeShowAd } from "@/services/swipe-ad-counter";
import { SwipeMiniCues } from "./SwipeCues";
import { useT } from "@/i18n";

/** Psychological progress: races to ~88% fast, then crawls until image loads */
function useFakeProgress(imageLoaded: boolean) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>();
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      if (!imageLoaded) {
        // Fast phase: 0→88% in ~800ms (ease-out curve)
        const fast = Math.min(88, 88 * (1 - Math.pow(1 - elapsed / 800, 3)));
        // Slow crawl after 88%: +0.5% per second
        const slow = elapsed > 800 ? Math.min(10, (elapsed - 800) / 2000 * 10) : 0;
        setProgress(Math.min(98, fast + slow));
      } else {
        setProgress(100);
        return; // stop loop
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [imageLoaded]);

  return progress;
}

interface WallpaperDetailProps {
  wallpaper: Wallpaper;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

type ApplyTarget = "home" | "lock" | "both";

export function WallpaperDetail({
  wallpaper,
  onClose,
  isFavorite,
  onToggleFavorite,
  onPrev,
  onNext,
}: WallpaperDetailProps) {
  const { t } = useT();
  const [showPremium, setShowPremium] = useState(false);
  const [showApplySheet, setShowApplySheet] = useState(false);
  const [applying, setApplying] = useState(false);
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  // Per-open-session counter — resets every time the detail view is opened
  // from the home/feed. Full pill shows for the first 2 swipes of THIS
  // session; subsequent swipes show the small Apple-style side cues.
  const swipeCountRef = useRef(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [showMiniCues, setShowMiniCues] = useState(false);
  const { isPremium, unlock } = usePremium();
  const progress = useFakeProgress(imageLoaded);
  const { blobUrl } = useProxyImage(wallpaper.src);

  // Re-show the full pill on each new wallpaper — only for the first 2 swipes.
  useEffect(() => {
    if (!(onPrev || onNext)) return;
    if (swipeCountRef.current >= 2) return;
    setShowSwipeHint(true);
    const t = setTimeout(() => setShowSwipeHint(false), 1800);
    return () => clearTimeout(t);
  }, [wallpaper.id, onPrev, onNext]);

  const recordSwipe = useCallback(() => {
    swipeCountRef.current += 1;
    if (swipeCountRef.current >= 2) {
      setShowMiniCues(true);
      window.setTimeout(() => setShowMiniCues(false), 900);
    }
  }, []);

  // Reset loading state when wallpaper changes (swipe to next/prev)
  useEffect(() => {
    setImageLoaded(false);
    // Meta signal — content view (high-intent for ads optimization)
    import("@/services/meta-events").then((m) => m.logContentView(wallpaper.id)).catch(() => {});
  }, [wallpaper.id]);

  // Android back button closes detail (but is blocked while applying)
  useAndroidBack(useCallback(() => {
    if (applying) {
      // Hard block — user must wait for the apply to finish
      return;
    }
    if (showPremium) {
      setShowPremium(false);
    } else if (showApplySheet) {
      setShowApplySheet(false);
    } else {
      onClose();
    }
  }, [applying, showPremium, showApplySheet, onClose]));

  const [pendingTarget, setPendingTarget] = useState<ApplyTarget | null>(null);
  const [adUnlocked, setAdUnlocked] = useState(false);

  // Reset ad-unlock when wallpaper changes
  useEffect(() => { setAdUnlocked(false); }, [wallpaper.id]);

  const handleApplyWallpaper = async (target: ApplyTarget, skipAd = false) => {
    if (applying) return;

    setApplying(true);

    try {
      if (Capacitor.isNativePlatform()) {
        // Use direct R2 URL to avoid proxy auth issues on native
        const directUrl = getDirectImageUrl(wallpaper.src);
        await WallpaperSetter.setWallpaper({
          url: directUrl,
          target,
        });
        haptic("heavy");
        const label = target === "home" ? t("wp.detail.home") : target === "lock" ? t("wp.detail.lock") : t("wp.detail.targetBoth");
        toast.success(t("wp.detail.setSuccess", { label }));
        // Analytics: north-star event for static wallpapers
        import("@/services/analytics").then((a) => a.track("wallpaper_applied", {
          wallpaper_id: wallpaper.id,
          type: "static",
          target,
          is_premium_wallpaper: !!wallpaper.isPremium,
        })).catch(() => {});
        // Fire rating prompt after a successful apply (the most "blessed" moment)
        import("@/services/rating").then((m) => {
          setTimeout(() => m.maybeRequestRating(), 3500);
        }).catch(() => {});
      } else {
        // Web preview — simulate the native apply flow (no download)
        await new Promise((r) => setTimeout(r, 600));
        haptic("heavy");
        const label = target === "home" ? t("wp.detail.home") : target === "lock" ? t("wp.detail.lock") : t("wp.detail.targetBoth");
        toast.success(t("wp.detail.setSuccessPreview", { label }));
        import("@/services/analytics").then((a) => a.track("wallpaper_applied", {
          wallpaper_id: wallpaper.id,
          type: "static",
          target,
          preview: true,
        })).catch(() => {});
        import("@/services/rating").then((m) => {
          setTimeout(() => m.maybeRequestRating(), 3500);
        }).catch(() => {});
      }
    } catch (err: any) {
      toast.error(err?.message || t("wp.detail.setFailed"));
      import("@/services/analytics").then((a) => a.track("wallpaper_apply_failed", {
        wallpaper_id: wallpaper.id,
        type: "static",
        target,
        reason: err?.message || "unknown",
      })).catch(() => {});
    } finally {
      setApplying(false);
      setShowApplySheet(false);
      setPendingTarget(null);
      if (!isPremium) {
        import("@/lib/paywallScheduler").then((m) => m.firePaywallTrigger("wallpaper_applied")).catch(() => {});
      }
    }
  };


  const [watchingAd, setWatchingAd] = useState(false);

  const handleWatchAd = async () => {
    if (applying || watchingAd) return;
    setWatchingAd(true);
    const earned = await showRewardedAd(t("wp.reel.preparingAd"));
    setWatchingAd(false);
    if (!earned) {
      toast.error(t("wp.live.adNotCompleted"));
      return;
    }
    // Ad earned → reveal the Home/Lock/Both picker
    setAdUnlocked(true);
  };

  const handleAction = (action: string) => {
    if (action === "apply") {
      haptic("light");
      if (wallpaper.isPremium && !isPremium) {
        setShowPremium(true);
      } else if (!wallpaper.isPremium && !isPremium) {
        setShowApplySheet(true);
      } else {
        setShowApplySheet(true);
      }
      return;
    }

    if (action === "save") {
      haptic("medium");
      setActionDone("save");
      setTimeout(() => setActionDone(null), 1800);
      return;
    }
  };

  const handleGoPremium = () => {
    setShowPremium(true);
  };

  const handleShare = async () => {
    const { nativeShare, APP_PLAY_STORE_URL } = await import("@/utils/nativeShare");
    await nativeShare({
      title: t("wp.share.appTitle"),
      text: t("wp.share.staticText"),
      url: APP_PLAY_STORE_URL,
      dialogTitle: t("wp.share.dialogStatic"),
    });
  };

  const actions = [
    { id: "apply", icon: Smartphone, label: t("wp.reel.apply") },
  ];

  const applyOptions: { target: ApplyTarget; icon: typeof Home; label: string; sub: string }[] = [
    { target: "home", icon: Home, label: t("wp.detail.home"), sub: t("wp.detail.homeSub") },
    { target: "lock", icon: Lock, label: t("wp.detail.lock"), sub: t("wp.detail.lockSub") },
    { target: "both", icon: Layers, label: t("wp.detail.both"), sub: t("wp.detail.bothSub") },
  ];

  const showLoading = !imageLoaded;

  return (
    <AnimatePresence>
      <motion.div
        key="detail-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[60] bg-black"
      >
        {/* Loading state with shimmer skeleton + progress bar */}
        <AnimatePresence>
          {showLoading && (
            <motion.div
              key="loading-skeleton"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 z-[5] flex flex-col items-center justify-end"
            >
              {/* Shimmer skeleton background */}
              <div className="absolute inset-0 bg-secondary/30 overflow-hidden">
                <div className="absolute inset-0 shimmer-skeleton" />
              </div>

              {/* Progress bar at bottom */}
              <div className="w-full px-12 pb-32 z-10">
                <div className="w-full h-[3px] rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-accent"
                    style={{ width: `${progress}%` }}
                    transition={{ duration: 0.1, ease: "linear" }}
                  />
                </div>
                <p className="text-center text-[10px] text-white/30 mt-2 font-medium tracking-wide">
                  {t("wp.detail.loading")}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen image (animated key for swipe transition) */}
        <AnimatePresence mode="popLayout" initial={false} custom={1}>
          <motion.div
            key={wallpaper.id}
            initial={{ scale: 1.05, opacity: 0 }}
            animate={{ scale: 1, opacity: imageLoaded ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 w-full h-full"
          >
            <img
              src={blobUrl || wallpaper.src}
              alt={wallpaper.title}
              className="w-full h-full object-cover"
              onLoad={() => setImageLoaded(true)}
            />
            {/* Subtle vignette — only at the very edges so wallpaper stays vibrant */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/55 pointer-events-none" />
          </motion.div>
        </AnimatePresence>

        {/* Swipe zone — middle of screen, between top bar (~96px) and bottom actions (~280px) */}
        {(onPrev || onNext) && (
          <motion.div
            key={`swipe-${wallpaper.id}`}
            className="absolute left-0 right-0 z-[7]"
            style={{ top: 96, bottom: 280 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.4}
            dragMomentum={false}
            onDragStart={() => {
              if (showSwipeHint) setShowSwipeHint(false);
            }}
            onDragEnd={(_, info) => {
              const SWIPE = 70;
              if (info.offset.x < -SWIPE && onNext) {
                haptic("light");
                recordSwipe();
                onNext();
                recordSwipeAndMaybeShowAd(isPremium);
              } else if (info.offset.x > SWIPE && onPrev) {
                haptic("light");
                recordSwipe();
                onPrev();
                recordSwipeAndMaybeShowAd(isPremium);
              }
            }}
          />
        )}

        {/* Premium swipe hint — single centered glass pill, auto-dismiss */}
        <AnimatePresence>
          {showSwipeHint && (onPrev || onNext) && (
            <motion.div
              key="swipe-hint-pill"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-0 right-0 z-[8] pointer-events-none flex justify-center"
              style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 290px)" }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase text-white whitespace-nowrap"
                style={{
                  background: "rgba(10, 10, 14, 0.78)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
                }}
              >
                <motion.span
                  animate={{ x: [0, -3, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  className="flex"
                >
                  <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.6} />
                </motion.span>
                <span>{t("wp.detail.swipeHint")}</span>
                <motion.span
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  className="flex"
                >
                  <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.6} />
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini side cues — flash briefly after each swipe once learned */}
        <SwipeMiniCues show={showMiniCues} topOffset={96} bottomOffset={280} />


        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="absolute top-0 left-0 right-0 flex items-center justify-between p-6 safe-top z-10"
        >
          <button
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 flex items-center justify-center active:scale-90 transition-transform hover:bg-black/30 text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleShare}
            aria-label={t("wp.detail.shareAria")}
            className="relative h-12 px-4 rounded-full flex items-center justify-center gap-2 active:opacity-90"
            style={{
              background: "rgba(0,0,0,0.28)",
              border: "1px solid hsl(42 88% 55% / 0.55)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              boxShadow: "0 6px 18px -6px hsl(42 88% 46% / 0.55), inset 0 1px 0 hsl(42 95% 75% / 0.25)",
            }}
          >
            <span
              className="pointer-events-none absolute -inset-1 rounded-full blur-md opacity-50"
              style={{ background: "hsl(42 90% 55% / 0.35)" }}
              aria-hidden="true"
            />
            <Share2 className="relative w-4 h-4 text-primary" strokeWidth={2.5} />
            <span className="relative text-[12px] font-extrabold tracking-[0.06em] text-primary leading-none">
              {t("wp.detail.share")}
            </span>
          </motion.button>
        </motion.div>

        {/* Content & Actions — minimal, premium feel. No title clutter. */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] z-10 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: imageLoaded ? 1 : 0, y: imageLoaded ? 0 : 24 }}
            transition={{ delay: 0.25, type: "spring", bounce: 0.25 }}
            className="w-full max-w-sm"
          >
            {/* Share moved to top header — keeps the CTA area uncluttered */}

            {actions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-full font-semibold text-[15px] tracking-tight bg-white text-black shadow-lg shadow-black/30 active:scale-[0.97] transition-transform"
              >
                <action.icon className="w-[18px] h-[18px]" strokeWidth={2.2} />
                <span>{actionDone === action.id ? t("wp.detail.doneCheck") : action.label}</span>
              </button>
            ))}
          </motion.div>
        </div>

        {/* Apply Wallpaper Sheet */}
        <AnimatePresence>
          {showApplySheet && (
            <>
              <motion.div
                key="apply-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 z-20"
                onClick={() => { if (!applying && !watchingAd) { setShowApplySheet(false); setPendingTarget(null); setAdUnlocked(false); } }}
              />
              <motion.div
                key="apply-sheet"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 350, damping: 32 }}
                className="absolute bottom-0 left-0 right-0 z-30 bg-card rounded-t-3xl px-5 pt-6 pb-8 safe-bottom"
              >
                {/* Handle bar */}
                <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-5" />

                {!isPremium && !adUnlocked ? (
                  <>
                    <h3 className="text-2xl font-bold text-foreground text-center mb-1">
                      {t("wp.detail.unlockTitle")}
                    </h3>
                    <p className="text-sm text-muted-foreground text-center mb-6">
                      "{wallpaper.title}"
                    </p>

                    {/* Free with Ad card */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleWatchAd}
                      disabled={watchingAd}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-secondary/60 border border-white/5 active:bg-secondary transition-colors disabled:opacity-60 mb-3"
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: "rgba(34,197,94,0.15)",
                          border: "1px solid rgba(34,197,94,0.3)",
                        }}
                      >
                        <Play className="w-5 h-5 text-green-400 fill-green-400/30" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-base font-bold text-foreground">{t("wp.live.freeAd")}</p>
                        <p className="text-xs text-muted-foreground">{t("wp.live.freeAdSub")}</p>
                      </div>
                      {watchingAd ? (
                        <div className="w-5 h-5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
                      ) : null}
                    </motion.button>

                    {/* Premium card */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { setShowApplySheet(false); setPendingTarget(null); setShowPremium(true); }}
                      disabled={applying}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-secondary/60 border border-amber-500/20 active:bg-secondary transition-colors disabled:opacity-60"
                      style={{
                        background: "linear-gradient(135deg, rgba(255,193,7,0.06) 0%, rgba(255,180,50,0.03) 100%)",
                      }}
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: "linear-gradient(135deg, rgba(255,193,7,0.95) 0%, rgba(255,160,30,0.95) 100%)",
                          boxShadow: "0 4px 14px rgba(255,180,30,0.35)",
                        }}
                      >
                        <Crown className="w-5 h-5" style={{ color: "#3a2000" }} />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-base font-bold text-foreground">{t("wp.live.premiumTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("wp.live.premiumSub")}</p>
                      </div>
                      <Zap className="w-5 h-5 text-blue-400 fill-blue-400/30" />
                    </motion.button>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-foreground text-center mb-1">
                      {t("wp.detail.setTitle")}
                    </h3>
                    <p className="text-sm text-muted-foreground text-center mb-5">
                      {t("wp.detail.chooseWhere")}
                    </p>

                    <div className="flex flex-col gap-2.5">
                      {applyOptions.map((opt) => (
                        <motion.button
                          key={opt.target}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleApplyWallpaper(opt.target)}
                          disabled={applying}
                          className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/80 active:bg-secondary transition-colors disabled:opacity-50"
                        >
                          <div className="w-11 h-11 rounded-full premium-gradient flex items-center justify-center flex-shrink-0">
                            <opt.icon className="w-5 h-5 text-primary-foreground" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.sub}</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>

                    {applying && (
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-muted-foreground">{t("wp.detail.applying")}</span>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Full-screen Applying overlay — blocks back/close while download finishes */}
        <AnimatePresence>
          {applying && (
            <motion.div
              key="applying-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
              <p className="mt-5 text-base font-semibold text-foreground">{t("wp.detail.preparingOverlay")}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{t("wp.feed.dontClose")}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Premium Sheet */}
        <PremiumSheet
          isOpen={showPremium}
          onClose={() => setShowPremium(false)}
          onUnlock={unlock}
          trigger="wallpaper_detail"
        />
      </motion.div>
    </AnimatePresence>
  );
}
