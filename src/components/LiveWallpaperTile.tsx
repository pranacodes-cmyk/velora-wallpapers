import { useRef, useEffect, useState, forwardRef, useMemo, memo } from "react";
import { Diamond, Play, Pause, Heart, X } from "lucide-react";
import { motion } from "framer-motion";
import type { LiveWallpaperDB } from "@/hooks/useLiveWallpapers";
import { useProxyImage } from "@/hooks/useProxyImage";

import { haptic } from "@/utils/haptics";
import { toast } from "sonner";
import { isAndroidPerfMode } from "@/lib/androidPerf";
import { useT } from "@/i18n";


// ── Global concurrent video limiter (manual preview only) ──
const MAX_CONCURRENT_PLAY = 2;
const playingSet = new Set<HTMLVideoElement>();
function requestPlay(video: HTMLVideoElement) {
  if (playingSet.has(video)) return;
  if (playingSet.size < MAX_CONCURRENT_PLAY) { playingSet.add(video); video.play().catch(() => {}); }
}
function releasePlay(video: HTMLVideoElement) { playingSet.delete(video); video.pause(); }

// ── Global limiter for auto-preview clips ──
const MAX_CONCURRENT_PREVIEW = isAndroidPerfMode() ? 1 : 4;
const previewSet = new Set<HTMLVideoElement>();
const waitingQueue = new Set<HTMLVideoElement>();

function requestPreviewPlay(video: HTMLVideoElement) {
  if (previewSet.has(video)) return;
  if (previewSet.size < MAX_CONCURRENT_PREVIEW) {
    waitingQueue.delete(video);
    previewSet.add(video);
    video.play().catch(() => {});
  } else {
    waitingQueue.add(video);
  }
}

function releasePreviewPlay(video: HTMLVideoElement) {
  previewSet.delete(video);
  waitingQueue.delete(video);
  video.pause();
  for (const queued of waitingQueue) {
    waitingQueue.delete(queued);
    if (queued.src && document.body.contains(queued)) {
      previewSet.add(queued);
      queued.play().catch(() => {});
      break;
    }
  }
}

/** Remove slug prefixes and duplicate words from titles */
function cleanTitle(title: string): string {
  // Strip common slug prefixes like "Viral 07 ", "Nolan 03 "
  let cleaned = title.replace(/^[A-Za-z]+ \d{1,3}\s+/, "");
  const words = cleaned.split(/\s+/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const word of words) {
    const lower = word.toLowerCase();
    if (!seen.has(lower)) { seen.add(lower); result.push(word); }
  }
  return result.join(" ") || title;
}

interface Props {
  wallpaper: LiveWallpaperDB;
  index: number;
  onClick: (w: LiveWallpaperDB) => void;
  autoPlay?: boolean;
  canLoad?: boolean;
  onLoaded?: () => void;
  tag?: "trending" | "hot" | "new" | null;
  isAdmin?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onReorder?: (wallpaper: LiveWallpaperDB, currentPos: number) => void;
  rank?: number;
  onDelete?: (id: string) => void;
  /** Live wallpapers are Pro-only: show the Pro badge on every tile for free users. */
  lockAll?: boolean;
}

export const LiveWallpaperTile = memo(forwardRef<HTMLDivElement, Props>(
  function LiveWallpaperTile({ wallpaper, index, onClick, canLoad = true, onLoaded, tag, isAdmin, isFavorite, onToggleFavorite, onReorder, rank, onDelete, lockAll }, _ref) {
    const { t } = useT();
    const [deleting, setDeleting] = useState(false);
    const androidPerf = isAndroidPerfMode();

    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (deleting) return;
      if (!confirm(t("wp.admin.deleteConfirm", { title: wallpaper.title }))) return;
      setDeleting(true);
      haptic("medium");
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-manager?action=delete-wallpaper`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: wallpaper.id, table: "live" }),
          }
        );
        const data = await res.json();
        if (data.success) {
          toast.success(t("wp.admin.deleted", { title: wallpaper.title }));
          onDelete?.(wallpaper.id);
        } else {
          toast.error(data.error || t("wp.admin.deleteFailed"));
        }
      } catch {
        toast.error(t("wp.admin.deleteFailed"));
      }
      setDeleting(false);
    };
    const playVideoRef = useRef<HTMLVideoElement>(null);
    const previewClipRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPreviewActive, setIsPreviewActive] = useState(false);
    const [previewClipBroken, setPreviewClipBroken] = useState(false);
    const [playVideoLoaded, setPlayVideoLoaded] = useState(false);
    const [previewClipReady, setPreviewClipReady] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [isPlayable, setIsPlayable] = useState(false); // tight viewport check for playback
    const prevIdRef = useRef(wallpaper.id);

    // Reset video states when wallpaper changes (e.g. category switch)
    useEffect(() => {
      if (prevIdRef.current !== wallpaper.id) {
        prevIdRef.current = wallpaper.id;
        setPreviewClipReady(false);
        setPlayVideoLoaded(false);
        setIsPreviewActive(false);
        setVideoThumbReady(false);
        reportedRef.current = false;
      }
    }, [wallpaper.id]);
    const reportedRef = useRef(false);
    const [minDelayDone, setMinDelayDone] = useState(false);
    const cleanupRef = useRef<(() => void) | null>(null);

    // Minimum shimmer duration (1s)
    useEffect(() => {
      let cancelled = false;
      requestAnimationFrame(() => {
        if (cancelled) return;
        const t = setTimeout(() => { if (!cancelled) setMinDelayDone(true); }, 1000);
        cleanupRef.current = () => clearTimeout(t);
      });
      return () => { cancelled = true; cleanupRef.current?.(); };
    }, []);

    const isPreviewClip = useMemo(
      () => !!wallpaper.thumbnail_url?.includes("/previews/"),
      [wallpaper.thumbnail_url]
    );

    const isSprite = useMemo(
      () => !!wallpaper.thumbnail_url?.includes("/sprites/"),
      [wallpaper.thumbnail_url]
    );

    // Thumbnail/preview URL
    const rawThumbUrl = wallpaper.thumbnail_url || null;
    const proxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy`;
    const r2Host = "https://pub-de6e465d65ed4e5bbc4515e0da940246.r2.dev/";
    const thumbUrl = rawThumbUrl
      ? rawThumbUrl.startsWith(r2Host)
        ? `${proxyBase}/${rawThumbUrl.slice(r2Host.length)}`
        : rawThumbUrl
      : null;

    const { blobUrl: thumbBlob, loading: thumbLoading, error: thumbError } = useProxyImage(
      canLoad && isInView && !isPreviewClip ? thumbUrl : null
    );
    const thumbReady = isPreviewClip ? false : (!!thumbBlob && !thumbLoading);

    // ── Direct video preview fallback for wallpapers without thumbnail ──
    const needsVideoFallback = canLoad && isInView && (!thumbUrl || previewClipBroken);
    const thumbVideoRef = useRef<HTMLVideoElement>(null);
    const [videoThumbReady, setVideoThumbReady] = useState(false);

    const showThumb = minDelayDone && (isPreviewClip ? previewClipReady : (thumbUrl ? (thumbReady || thumbError) : videoThumbReady));

    // Report loaded
    useEffect(() => {
      if (showThumb && !reportedRef.current) { reportedRef.current = true; onLoaded?.(); }
    }, [showThumb, onLoaded]);

    // Fallback timeout
    useEffect(() => {
      if (!canLoad) return;
      const t = setTimeout(() => { if (!reportedRef.current) { reportedRef.current = true; onLoaded?.(); } }, 3000);
      return () => clearTimeout(t);
    }, [canLoad, onLoaded]);

    // Wide observer — for preloading (large rootMargin)
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => setIsInView(entry.isIntersecting),
        { threshold: 0.01, rootMargin: "400px" }
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // Tight observer — for playback decisions (only truly visible tiles)
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => setIsPlayable(entry.isIntersecting),
        { threshold: 0.1, rootMargin: "50px" }
      );
      observer.observe(el);
      return () => {
        observer.disconnect();
        if (playVideoRef.current) releasePlay(playVideoRef.current);
        if (previewClipRef.current) releasePreviewPlay(previewClipRef.current);
      };
    }, []);

    // Manage preview clip playback — use tight viewport check
    useEffect(() => {
      const video = previewClipRef.current;
      if (!video || !isPreviewClip || !canLoad) return;
      if (isPlayable && !isPreviewActive && previewClipReady) {
        requestPreviewPlay(video);
      } else {
        releasePreviewPlay(video);
      }
      return () => { if (video) releasePreviewPlay(video); };
    }, [isPlayable, isPreviewActive, previewClipReady, isPreviewClip, canLoad]);

    useEffect(() => {
      const fallbackVideo = thumbVideoRef.current;
      if (fallbackVideo && needsVideoFallback) {
        if (isPlayable && !isPreviewActive) requestPreviewPlay(fallbackVideo);
        else releasePreviewPlay(fallbackVideo);
      }

      const playVideo = playVideoRef.current;
      if (playVideo && playVideoLoaded) {
        if (isPreviewActive && isPlayable) requestPlay(playVideo);
        else releasePlay(playVideo);
      }

      return () => {
        if (fallbackVideo) releasePreviewPlay(fallbackVideo);
        if (playVideo) releasePlay(playVideo);
      };
    }, [needsVideoFallback, isPlayable, isPreviewActive, wallpaper.video_url, playVideoLoaded]);

    const handlePlayToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsPreviewActive((prev) => !prev);
      if (!isPreviewActive) setPlayVideoLoaded(false);
    };

    // When tile is NOT in view, render a lightweight placeholder
    // This is the key optimization: off-screen tiles have minimal DOM
    if (!isInView && !canLoad) {
      return (
        <div
          ref={containerRef}
          className="rounded-[22px] bg-secondary shimmer-skeleton ring-1 ring-white/[0.04]"
          style={{ aspectRatio: "9/16" }}
        />
      );
    }

    return (
      <div
        ref={containerRef}
        className="relative rounded-[22px] overflow-hidden cursor-pointer group bg-secondary shadow-xl shadow-black/40 ring-1 ring-white/[0.04] active:scale-[0.96] transition-transform duration-150"
        style={{
          aspectRatio: "9/16",
          contain: "layout paint style",
          contentVisibility: "auto",
          containIntrinsicSize: "0 300px",
        }}
        onClick={() => { if (canLoad) { haptic("light"); onClick(wallpaper); } }}
      >
        {!canLoad ? (
          <div className="absolute inset-0 shimmer-skeleton rounded-[20px]" />
        ) : (
          <>
            <div className="absolute inset-0 bg-secondary" />

            {!showThumb && <div className="absolute inset-0 shimmer-skeleton rounded-[20px]" />}
            {showThumb && !thumbError && <div className="absolute inset-0 tile-reveal-glow rounded-[20px] z-[5] pointer-events-none" />}

            {/* PREVIEW CLIP */}
            {isPreviewClip && !previewClipBroken && thumbUrl && isInView && (
              <video
                key={`preview-${wallpaper.id}`}
                ref={previewClipRef}
                src={!isPreviewActive ? thumbUrl : undefined}
                muted
                loop
                playsInline
                preload={androidPerf ? "metadata" : "auto"}
                onLoadedData={(e) => {
                  const v = e.currentTarget;
                  // Detect broken/empty preview clips (< 1s or 0 dimensions)
                  if (v.duration < 0.3 || (v.videoWidth === 0 && v.videoHeight === 0)) {
                    setPreviewClipBroken(true);
                    return;
                  }
                  if (v.duration > 0.5) v.currentTime = 0.4;
                  setPreviewClipReady(true);
                }}
                onError={() => setPreviewClipBroken(true)}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                  showThumb && !isPreviewActive ? "opacity-100" : "opacity-0"
                }`}
                style={{ filter: "contrast(1.14) saturate(1.3) brightness(1.06)", willChange: "transform", transform: "translateZ(0)" }}
              />
            )}

            {/* SPRITE SHEET (legacy) */}
            {isSprite && thumbBlob && (
              <div
                className={`absolute inset-0 transition-opacity duration-500 ${
                  thumbReady && !isPreviewActive ? "opacity-100" : "opacity-0"
                }`}
                style={{
                  backgroundImage: `url(${thumbBlob})`,
                  backgroundSize: `100% ${8 * 100}%`,
                  backgroundRepeat: "no-repeat",
                  animation: isInView && !isPreviewActive
                    ? `sprite-play 1.6s steps(8) infinite`
                    : "none",
                }}
              />
            )}

            {/* STATIC THUMBNAIL */}
            {!isSprite && !isPreviewClip && thumbUrl && thumbBlob && (
              <img
                src={thumbBlob}
                alt={wallpaper.title}
                loading="lazy"
                decoding="async"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                  thumbReady && !isPreviewActive ? "opacity-100" : "opacity-0"
                }`}
                style={{ filter: "contrast(1.1) saturate(1.2) brightness(1.03)", transform: "translateZ(0)" }}
              />
            )}

            {/* Inline live preview when thumbnail is missing */}
            {needsVideoFallback && (
              <video
                key={`fallback-${wallpaper.id}`}
                ref={thumbVideoRef}
                src={wallpaper.video_url}
                muted
                loop
                playsInline
                preload="metadata"
                onLoadedData={() => setVideoThumbReady(true)}
                onCanPlay={() => setVideoThumbReady(true)}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                  videoThumbReady && !isPreviewActive ? "opacity-100" : "opacity-0"
                }`}
                style={{ filter: "contrast(1.08) saturate(1.15) brightness(1.02)", transform: "translateZ(0)" }}
              />
            )}

            {/* Manual full-quality preview video — only mount when active */}
            {isPreviewActive && (
              <video
                ref={playVideoRef}
                src={wallpaper.video_url}
                muted
                loop
                playsInline
                preload={androidPerf ? "metadata" : "auto"}
                onLoadedData={() => setPlayVideoLoaded(true)}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                  playVideoLoaded ? "opacity-100" : "opacity-0"
                }`}
                style={{ filter: "contrast(1.06) saturate(1.1) brightness(1.02)", transform: "translateZ(0)" }}
              />
            )}

            {isPreviewActive && !playVideoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="golden-pulse-dots"><span /><span /><span /></div>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/15 pointer-events-none" />
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 30px 5px rgba(0,0,0,0.25)" }} />

            {/* Top row: Play left, Premium toggle + category right */}
            <div className={`absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 transition-opacity duration-500 ${
              showThumb ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}>
              <button
                onClick={handlePlayToggle}
                className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center active:scale-90"
                aria-label={isPreviewActive ? t("wp.tile.pausePreview") : t("wp.tile.playPreview")}
              >
                {isPreviewActive ? (
                  <Pause className="w-3 h-3 text-white/90 fill-white/90" />
                ) : (
                  <Play className="w-3 h-3 text-white/90 fill-white/90 ml-px" />
                )}
              </button>
              <div className="flex items-center gap-1.5">
                {isAdmin && (
                  <>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                      style={{
                        background: deleting ? "hsl(0 50% 30%)" : "hsl(0 70% 45%)",
                        border: "1.5px solid hsl(0 60% 60%)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                      }}
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </>
                )}
                {!isAdmin && (lockAll || wallpaper.is_premium) && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xl border border-primary/15">
                    <Diamond className="w-2.5 h-2.5 text-premium fill-premium" />
                  </div>
                )}
              </div>
            </div>

            {/* Admin rank badge — bottom left */}
            {isAdmin && rank != null && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  haptic("soft");
                  onReorder?.(wallpaper, rank);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute bottom-12 left-2 z-30 min-w-12 h-12 px-3 rounded-full flex items-center justify-center text-base font-black active:scale-90 transition-transform"
                style={{
                  background: "hsl(var(--primary) / 0.95)",
                  border: "2.5px solid hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  boxShadow: "0 4px 14px hsl(var(--primary) / 0.55), 0 0 0 3px hsl(var(--background) / 0.4)",
                }}
              >
                #{rank}
              </button>
            )}


            {/* Favorite heart button */}
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  haptic("soft");
                  onToggleFavorite(wallpaper.id);
                }}
                className={`absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center z-20 active:scale-90 transition-all duration-300 ${
                  showThumb ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                style={{
                  background: isFavorite ? "hsl(0 80% 55%)" : "hsl(0 0% 0% / 0.5)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid hsl(0 0% 100% / 0.1)",
                }}
              >
                <Heart
                  className={`w-3.5 h-3.5 transition-all duration-300 ${isFavorite ? "text-white fill-white scale-110" : "text-white/80"}`}
                />
              </button>
            )}

            <div className="absolute bottom-0 inset-x-0 p-3 pt-8 pr-12">
              <p className="text-white text-[15px] font-bold truncate leading-tight tracking-tight drop-shadow-sm">{cleanTitle(wallpaper.title)}</p>
            </div>
          </>
        )}
      </div>
    );
  }
));
