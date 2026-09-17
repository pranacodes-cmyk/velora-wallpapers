import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Download, ChevronDown } from "lucide-react";

import { useExploreFeed, type FeedItem } from "@/hooks/useExploreFeed";
import { useProxyImage, preloadImages } from "@/hooks/useProxyImage";
import { haptic } from "@/utils/haptics";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { usePremium } from "@/hooks/usePremium";
import { PremiumSheet } from "@/components/PremiumSheet";
import { applyLiveWallpaperWithDiagnostics } from "@/services/live-wallpaper-apply";
import { getDirectImageUrl } from "@/utils/imageUrl";
import { showRewardedAd } from "@/services/ads";
import { useT } from "@/i18n";

/**
 * TikTok / Reels style full-screen vertical feed.
 * Pattern: 3 live → 1 static → repeat
 */

function isImageAssetUrl(url: string) {
  return /\.(avif|webp|png|jpe?g|gif)(\?|$)/i.test(url);
}

function useReelsFeed(categorySlug?: string) {
  const { feed: raw, loading, loadingMore, hasMore, loadMore } = useExploreFeed(categorySlug);

  // Re-interleave: 3 live, 1 static, repeat
  const reelsFeed: FeedItem[] = [];
  const statics = raw.filter((i) => i.type === "static");
  const lives = raw.filter((i) => i.type === "live");

  let si = 0, li = 0;
  while (si < statics.length || li < lives.length) {
    // 3 live
    for (let k = 0; k < 3 && li < lives.length; k++) {
      reelsFeed.push(lives[li++]);
    }
    // 1 static
    if (si < statics.length) {
      reelsFeed.push(statics[si++]);
    }
  }

  return { feed: reelsFeed, loading, loadingMore, hasMore, loadMore };
}


function ReelCard({
  item,
  isActive,
  activeIndex,
  index,
}: {
  item: FeedItem;
  isActive: boolean;
  activeIndex: number;
  index: number;
}) {
  const { t } = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [applying, setApplying] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [staticFailed, setStaticFailed] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const { isPremium } = usePremium();

  const isLive = item.type === "live";
  const title = item.data.title;
  const isPremiumWp = item.data.is_premium;

  // For static wallpapers
  const imageUrl = isLive ? null : (item.data as any).image_url;
  const { blobUrl: proxyUrl } = useProxyImage(imageUrl);

  // For live wallpapers (always prioritize real video stream)
  const videoUrl = isLive ? (item.data as any).video_url : null;
  const thumbnailUrl = isLive ? (item.data as any).thumbnail_url : null;
  const isImageThumb = !!thumbnailUrl && isImageAssetUrl(thumbnailUrl);
  const { blobUrl: thumbProxy } = useProxyImage(isImageThumb ? thumbnailUrl : null);

  const staticSrc = staticFailed ? null : (proxyUrl || imageUrl || null);
  const posterSrc = posterFailed ? null : (thumbProxy || (isImageThumb ? thumbnailUrl : null));
  const distFromActive = Math.abs(index - activeIndex);
  const connection = typeof navigator !== "undefined"
    ? (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection
    : undefined;
  const effectiveType = connection?.effectiveType ?? "4g";
  const saveData = connection?.saveData ?? false;
  const preloadRadius = saveData || effectiveType.includes("2g") ? 1 : effectiveType === "3g" ? 2 : 3;
  const shouldAttachVideoSrc = isLive && distFromActive <= preloadRadius;
  const videoPreload = distFromActive === 0 ? "auto" : distFromActive <= preloadRadius ? "metadata" : "none";

  // Reset failed states when source changes
  useEffect(() => {
    setPosterFailed(false);
  }, [thumbnailUrl, thumbProxy]);

  useEffect(() => {
    setStaticFailed(false);
  }, [imageUrl, proxyUrl]);

  useEffect(() => {
    setVideoReady(false);
    setIsBuffering(isLive);
  }, [item.data.id, isLive]);

  // Play/pause video based on visibility
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isLive) return;

    if (isActive) {
      setIsBuffering(true);
      if (v.readyState >= 2) {
        setVideoReady(true);
        setIsBuffering(false);
      }
      v.play().catch(() => {
        // Browser autoplay policy may block playback in some environments.
        // Keep first frame/loader visible until user interaction.
      });
    } else {
      v.pause();
      v.currentTime = 0;
      setIsBuffering(false);
    }
  }, [isActive, isLive]);

  const handleTap = useCallback(() => {
    // Single tap — no action needed now
  }, []);

  const handleShare = useCallback(async () => {
    haptic("soft");
    const { nativeShare, APP_PLAY_STORE_URL } = await import("@/utils/nativeShare");
    await nativeShare({
      title: t("wp.share.appTitle"),
      text: t("wp.share.liveText"),
      url: APP_PLAY_STORE_URL,
      dialogTitle: t("wp.share.dialogLive"),
    });
  }, []);

  const handleApply = useCallback(async () => {
    if (applying) return;
    haptic("medium");

    if (isLive) {
      if (!Capacitor.isNativePlatform()) {
        // On web, download the video file
        const wp = item.data as any;
        const directVideoUrl = getDirectImageUrl(wp.video_url);
        const link = document.createElement("a");
        link.href = directVideoUrl;
        link.target = "_blank";
        link.download = `${wp.title || "live-wallpaper"}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(t("wp.reel.downloading"));
        return;
      }

      // Free users watch a rewarded ad before applying.
      if (!isPremium && !isPremiumWp) {
        setApplying(true);
        const earned = await showRewardedAd(t("wp.reel.preparingAd"));
        if (!earned) {
          setApplying(false);
          toast.error(t("wp.live.adNotCompleted"));
          return;
        }
      }

      setApplying(true);
      toast.loading(t("wp.reel.downloadingLong"), { id: "apply-live", duration: 30000 });
      const wp = item.data as any;
      const directVideoUrl = getDirectImageUrl(wp.video_url);
      const videoId = directVideoUrl.split("/").pop()?.replace(".mp4", "") || "";
      const result = await applyLiveWallpaperWithDiagnostics({
        videoUrl: directVideoUrl,
        videoId,
        forceRefresh: true,
      });
      toast.dismiss("apply-live");
      if (result.applied) {
        haptic("heavy");
        toast.success(t("wp.reel.applied"));
        // Fire rating prompt after the most "blessed" moment
        import("@/services/rating").then((m) => {
          setTimeout(() => m.maybeRequestRating(), 3500);
        }).catch(() => {});
      } else {
        toast.error(result.error || t("wp.reel.failed"));
      }
      setApplying(false);
    } else {
      // Static wallpaper — download
      if (!Capacitor.isNativePlatform()) {
        window.open(imageUrl || "", "_blank");
        return;
      }
      toast.info(t("wp.reel.downloadSoon"), { duration: 1500 });
    }
  }, [applying, isLive, item.data, imageUrl, isPremium, isPremiumWp]);

  return (
    <div
      data-reel-id={item.data.id}
      className="relative w-full h-full snap-start snap-always flex-shrink-0"
      onClick={handleTap}
    >
      {/* Background media */}
      {isLive ? (
        <>
          {/* Optional image poster until first video frame is decoded */}
          {posterSrc && (
            <img
              src={posterSrc}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
              style={{ opacity: videoReady ? 0 : 1 }}
              loading="eager"
              onError={() => setPosterFailed(true)}
            />
          )}

          <video
            ref={videoRef}
            src={shouldAttachVideoSrc ? videoUrl! : undefined}
            poster={posterSrc || undefined}
            loop
            muted
            playsInline
            preload={shouldAttachVideoSrc ? videoPreload : "none"}
            onLoadedData={() => {
              setVideoReady(true);
              if (isActive) setIsBuffering(false);
            }}
            onCanPlay={() => {
              setVideoReady(true);
              if (isActive) setIsBuffering(false);
            }}
            onPlaying={() => {
              setVideoReady(true);
              if (isActive) setIsBuffering(false);
            }}
            onWaiting={() => {
              if (isActive) setIsBuffering(true);
            }}
            onStalled={() => {
              if (isActive) setIsBuffering(true);
            }}
            onSeeking={() => {
              if (isActive) setIsBuffering(true);
            }}
            onSeeked={() => {
              if (isActive) setIsBuffering(false);
            }}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {(!videoReady || (isActive && isBuffering)) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[9]">
              <div className="golden-pulse-dots"><span /><span /><span /></div>
            </div>
          )}
        </>
      ) : staticSrc ? (
        <img
          src={staticSrc}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={() => setStaticFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      {/* Bottom gradient */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{
          background: "linear-gradient(to top, hsl(0 0% 0% / 0.8) 0%, transparent 100%)",
        }}
      />


      {/* Bottom info */}
      <div
        className="absolute left-4 right-20 z-10"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)" }}
      >
        <p className="text-white text-lg font-bold drop-shadow-lg leading-tight">{title}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {/* Type badge — always shown, visually distinct */}
          {isLive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                color: "hsl(var(--primary-foreground))",
                boxShadow: "0 0 12px hsl(var(--primary) / 0.4)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {t("wp.reel.live")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "hsl(0 0% 100% / 0.15)",
                color: "hsl(0 0% 100% / 0.9)",
                backdropFilter: "blur(8px)",
              }}
            >
              {t("wp.reel.static")}
            </span>
          )}
          {isPremiumWp && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "hsl(45 90% 55% / 0.2)", color: "hsl(45 90% 65%)", backdropFilter: "blur(8px)" }}
            >
              {t("wp.reel.premium")}
            </span>
          )}
        </div>
      </div>

      {/* Right action bar — TikTok style */}
      <div
        className="absolute right-3 z-10 flex flex-col items-center gap-5"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)" }}
      >

        {/* Share */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleShare();
          }}
          className="flex flex-col items-center gap-0.5"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: "hsl(0 0% 100% / 0.12)", backdropFilter: "blur(12px)" }}
          >
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-[10px] text-white/70 font-medium">{t("wp.reel.share")}</span>
        </button>

        {/* Apply / Download */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleApply();
          }}
          className="flex flex-col items-center gap-0.5"
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
            }}
          >
            <Download className={`w-5 h-5 text-background ${applying ? "animate-pulse" : ""}`} />
          </div>
          <span className="text-[10px] text-white/70 font-medium">
            {isLive ? t("wp.reel.apply") : t("wp.reel.save")}
          </span>
        </button>
      </div>

      {/* Scroll hint on first card */}
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: [1, 0.4, 1], y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: 3, ease: "easeInOut" }}
        className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 52px)" }}
      >
        <ChevronDown className="w-5 h-5 text-white/40" />
      </motion.div>
    </div>
  );
}

export default function ExploreFeed() {
  const { t } = useT();
  const { feed, loading, loadMore, hasMore } = useReelsFeed();
  
  const { isPremium, unlock } = usePremium();
  const [showPremium, setShowPremium] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const effectiveActiveIndex = activeIndex >= 0 && activeIndex < feed.length ? activeIndex : 0;
  const containerRef = useRef<HTMLDivElement>(null);

  // Snap scroll observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.reelIndex);
            if (!isNaN(idx)) setActiveIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );

    const children = container.querySelectorAll("[data-reel-index]");
    children.forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [feed.length]);

  // Keep active index valid when feed size changes (prevents no-video attach state)
  useEffect(() => {
    if (feed.length === 0) return;
    if (activeIndex > feed.length - 1) {
      setActiveIndex(0);
    }
  }, [feed.length, activeIndex]);

  // Load more when near end
  useEffect(() => {
    if (effectiveActiveIndex >= feed.length - 4 && hasMore) loadMore();
  }, [effectiveActiveIndex, feed.length, hasMore, loadMore]);

  // Preload media for upcoming cards to avoid blank next-card flashes
  useEffect(() => {
    if (feed.length === 0) return;
    const urls = feed
      .slice(effectiveActiveIndex, effectiveActiveIndex + 5)
      .map((item) =>
        item.type === "live"
          ? (item.data as any).thumbnail_url
          : (item.data as any).image_url
      )
      .filter((u): u is string => !!u && isImageAssetUrl(u));

    if (urls.length) preloadImages(urls);
  }, [feed, effectiveActiveIndex]);

  if (loading && feed.length === 0) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="golden-pulse-dots"><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="w-screen bg-black relative" style={{ height: "calc(100dvh - 56px)" }}>
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory scroll-smooth"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {feed.map((item, i) => (
          <div
            key={`${item.data.id}-${i}`}
            data-reel-index={i}
            className="w-full"
            style={{ scrollSnapAlign: "start", height: "calc(100dvh - 56px)" }}
          >
            <ReelCard
              item={item}
              index={i}
              activeIndex={effectiveActiveIndex}
              isActive={i === effectiveActiveIndex}
            />
          </div>
        ))}

        {feed.length === 0 && (
          <div className="h-screen flex items-center justify-center">
            <p className="text-muted-foreground">{t("wp.reel.none")}</p>
          </div>
        )}
      </div>

      <PremiumSheet isOpen={showPremium} onClose={() => setShowPremium(false)} onUnlock={unlock} trigger="explore_feed" />
    </div>
  );
}