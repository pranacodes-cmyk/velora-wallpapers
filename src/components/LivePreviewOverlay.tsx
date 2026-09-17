import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, Zap, Crown, Share2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { LiveWallpaperDB } from "@/hooks/useLiveWallpapers";
import { haptic } from "@/utils/haptics";
import { SwipeMiniCues } from "./SwipeCues";
import { useT } from "@/i18n";

interface Props {
  wallpaper: LiveWallpaperDB;
  onClose: () => void;
  onApply: () => void;
  applying?: boolean;
  isPremiumUser?: boolean;
  isPremiumWallpaper?: boolean;
  onPremium: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function LivePreviewOverlay({
  wallpaper,
  onClose,
  onApply,
  applying = false,
  isPremiumUser = false,
  isPremiumWallpaper = false,
  onPremium,
  onPrev,
  onNext,
}: Props) {
  const { t } = useT();
  const [videoReady, setVideoReady] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showApplySheet, setShowApplySheet] = useState(false);
  // Per-open-session counter — resets each time the live preview is opened.
  // Full pill shows for the first 2 swipes; afterwards mini side cues only.
  const swipeCountRef = useRef(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Force play on Android WebView where autoplay may be blocked
  const handleVideoTap = useCallback(() => {
    const v = videoRef.current;
    if (v && v.paused) {
      v.play().catch(() => {});
    }
  }, []);

  const handleShare = useCallback(async () => {
    const { nativeShare, APP_PLAY_STORE_URL } = await import("@/utils/nativeShare");
    await nativeShare({
      title: t("wp.share.appTitle"),
      text: t("wp.share.liveText"),
      url: APP_PLAY_STORE_URL,
      dialogTitle: t("wp.share.dialogLive"),
    });
  }, []);

  // Reset video state on wallpaper change (swipe to next/prev)
  useEffect(() => {
    setVideoReady(false);
    setShowContent(false);
    setShowApplySheet(false);
  }, [wallpaper.id]);

  const handleApplyTap = useCallback(() => {
    if (applying) return;
    haptic("light");
    // Live wallpapers are Pro-only — no ad unlock path.
    if (isPremiumWallpaper || !isPremiumUser) {
      onPremium();
      return;
    }
    setShowApplySheet(true);
  }, [applying, isPremiumWallpaper, isPremiumUser, onPremium]);

  const handleConfirmApply = useCallback(() => {
    if (!isPremiumUser) return;
    setShowApplySheet(false);
    onApply();
  }, [isPremiumUser, onApply]);

  // Try to force play after mount/change (handles Android WebView autoplay restrictions)
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      const tryPlay = () => v.play().catch(() => {});
      tryPlay();
      const t = setTimeout(tryPlay, 300);
      return () => clearTimeout(t);
    }
  }, [wallpaper.id]);

  // Delay showing content slightly after video is ready for smooth transition
  useEffect(() => {
    if (videoReady) {
      const t = setTimeout(() => setShowContent(true), 300);
      return () => clearTimeout(t);
    }
  }, [videoReady]);

  // Reset hint visibility when wallpaper changes — only if user hasn't learned yet
  useEffect(() => {
    if (swipeCountRef.current < 2) {
      setShowSwipeHint(true);
    }
  }, [wallpaper.id]);

  // Show swipe hint only after video is loaded and content is rendered
  useEffect(() => {
    if (!(onPrev || onNext)) return;
    if (!showContent) return;
    if (swipeCountRef.current >= 2) return;
    const t = setTimeout(() => setShowSwipeHint(false), 2000);
    return () => clearTimeout(t);
  }, [showContent, wallpaper.id, onPrev, onNext]);

  // After the user has learned the gesture (>=2 swipes), show small Apple-style
  // side cues briefly after each swipe instead of the full pill.
  const [showMiniCues, setShowMiniCues] = useState(false);

  // Increment per-session swipe count + trigger mini cues after first 2 swipes
  const recordSwipe = useCallback(() => {
    swipeCountRef.current += 1;
    if (swipeCountRef.current >= 2) {
      setShowMiniCues(true);
      window.setTimeout(() => setShowMiniCues(false), 900);
    }
  }, []);

  return (
    <motion.div
      key="live-preview"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black"
    >
      {/* Thumbnail background — visible immediately while video loads */}
      {wallpaper.thumbnail_url && !videoReady && (
        <div
          className="absolute inset-0 z-[1] bg-cover bg-center"
          style={{ backgroundImage: `url(${wallpaper.thumbnail_url})` }}
        />
      )}

      {/* Loading indicator over thumbnail */}
      <AnimatePresence>
        {!videoReady && (
          <motion.div
            key="video-loading"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-[5] flex items-end justify-center pb-52"
          >
            <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-black/70">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-sm text-white/80 font-medium">{t("wp.live.loading")}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video — keyed by wallpaper id so swipe forces a clean reload */}
      <video
        key={wallpaper.id}
        ref={videoRef}
        src={wallpaper.video_url}
        autoPlay
        loop
        muted
        playsInline
        controls={false}
        onCanPlay={() => setVideoReady(true)}
        onClick={handleVideoTap}
        style={{ WebkitMediaPlaybackRequiresUserAction: false } as any}
        className={`absolute inset-0 z-[2] w-full h-full object-cover transition-opacity duration-500 ${
          videoReady ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Gradient overlay — only after video ready */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showContent ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none"
      />

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
            } else if (info.offset.x > SWIPE && onPrev) {
              haptic("light");
              recordSwipe();
              onPrev();
            }
          }}
        />
      )}

      {/* Premium swipe hint — single centered glass pill, auto-dismiss */}
      <AnimatePresence>
        {showSwipeHint && showContent && (onPrev || onNext) && (
          <motion.div
            key="swipe-hint-pill"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 right-0 z-[8] pointer-events-none flex justify-center"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 132px)" }}
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
      <SwipeMiniCues show={showMiniCues} />

      {/* Top bar — only after video ready */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : -20 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="absolute top-0 left-0 right-0 flex items-center justify-between p-6 safe-top z-10"
      >
        <button
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-black/50 border border-white/10 flex items-center justify-center active:scale-90 transition-transform text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <button
          onClick={handleShare}
          aria-label={t("wp.live.shareAria")}
          className="relative h-12 px-4 rounded-full bg-black/50 flex items-center justify-center gap-2 active:scale-95 transition-transform text-primary"
          style={{
            border: "1px solid hsl(42 88% 55% / 0.55)",
            boxShadow: "0 6px 18px -6px hsl(42 88% 46% / 0.5), inset 0 1px 0 hsl(42 95% 75% / 0.25)",
          }}
        >
          <Share2 className="relative w-4 h-4" strokeWidth={2.5} />
          <span className="relative text-[12px] font-extrabold tracking-[0.06em] leading-none">
            {t("wp.detail.share")}
          </span>
        </button>
      </motion.div>

      {/* Bottom — only after video ready */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 30 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="absolute bottom-0 left-0 right-0 p-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] z-10 flex flex-col items-center"
      >
        <motion.button
          whileTap={{ scale: applying ? 1 : 0.95 }}
          onClick={applying ? undefined : handleApplyTap}
          disabled={applying}
          className={`w-full max-w-sm py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-xl transition-all ${
            applying
              ? "bg-white/70 text-black/60 cursor-not-allowed"
              : isPremiumWallpaper
                ? "premium-gradient text-primary-foreground active:scale-95"
                : "bg-white text-black active:scale-95"
          }`}
        >
          {applying ? (
            <>
              <div className="w-5 h-5 border-2 border-black/20 border-t-black/70 rounded-full animate-spin" />
              {t("wp.live.applyingBtn")}
            </>
          ) : (
            <>
              {isPremiumWallpaper ? <Crown className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
              {isPremiumWallpaper ? t("wp.live.unlockPremiumBtn") : t("wp.live.apply")}
            </>
          )}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {showApplySheet && (
          <>
            <motion.div
              key="live-apply-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 z-20"
              onClick={() => { if (!applying) setShowApplySheet(false); }}
            />
            <motion.div
              key="live-apply-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="absolute bottom-0 left-0 right-0 z-30 bg-card rounded-t-3xl px-5 pt-6 pb-8 safe-bottom"
            >
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-5" />
              <>
                  <h3 className="text-xl font-bold text-foreground text-center mb-1">{t("wp.live.setTitle")}</h3>
                  <p className="text-sm text-muted-foreground text-center mb-5">{t("wp.live.setSub")}</p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleConfirmApply}
                    disabled={applying}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-secondary/80 active:bg-secondary transition-colors disabled:opacity-50"
                  >
                    <div className="w-11 h-11 rounded-full premium-gradient flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">{t("wp.live.fallbackTitle")}</p>
                      <p className="text-xs text-muted-foreground">{t("wp.live.setAsAnimated")}</p>
                    </div>
                  </motion.button>
              </>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
