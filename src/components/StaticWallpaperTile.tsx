import { Diamond, RefreshCw, Heart, X } from "lucide-react";

/** Remove slug prefixes and duplicate words from titles */
function cleanTitle(title: string): string {
  // Strip common slug prefixes like "Viral 07 ", "Nolan 03 "
  let cleaned = title.replace(/^[A-Za-z]+ \d{1,3}\s+/,"");
  // Remove duplicate words
  const words = cleaned.split(/\s+/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const word of words) {
    const lower = word.toLowerCase();
    if (!seen.has(lower)) { seen.add(lower); result.push(word); }
  }
  return result.join(" ") || title;
}
import { motion } from "framer-motion";
import { useState, forwardRef, useRef, useEffect } from "react";
import { useProxyImage } from "@/hooks/useProxyImage";

import { haptic } from "@/utils/haptics";
import { toast } from "sonner";
import type { StaticWallpaperDB } from "@/hooks/useHomeFeed";
import { useT } from "@/i18n";

interface Props {
  wallpaper: StaticWallpaperDB;
  index: number;
  onClick: (w: StaticWallpaperDB) => void;
  isAdmin?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  rank?: number;
  onReorder?: (wallpaper: StaticWallpaperDB, currentPos: number) => void;
}

export const StaticWallpaperTile = forwardRef<HTMLDivElement, Props>(
  function StaticWallpaperTile({ wallpaper, index, onClick, isAdmin, isFavorite, onToggleFavorite, onDelete, rank, onReorder }, _ref) {
    const { t } = useT();
    const [deleting, setDeleting] = useState(false);

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
            body: JSON.stringify({ id: wallpaper.id, table: "static" }),
          }
        );
        const data = await res.json();
        if (data.success) {
          toast.success(t("wp.admin.deleted", { title: wallpaper.title }));
          onDelete?.(wallpaper.id);
        } else {
          toast.error(data.error || t("wp.admin.deleteFailed"));
        }
      } catch (err) {
        toast.error(t("wp.admin.deleteFailed"));
      }
      setDeleting(false);
    };
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const tileRef = useRef<HTMLDivElement>(null);
    const [isNearViewport, setIsNearViewport] = useState(index < 4);
    const [minDelayDone, setMinDelayDone] = useState(false);
    const cleanupRef = useRef<(() => void) | null>(null);

    // Minimum shimmer duration (1.8s) — rAF ensures shimmer paints before timer
    useEffect(() => {
      let cancelled = false;
      requestAnimationFrame(() => {
        if (cancelled) return;
        const t = setTimeout(() => { if (!cancelled) setMinDelayDone(true); }, 0);
        cleanupRef.current = () => clearTimeout(t);
      });
      return () => { cancelled = true; cleanupRef.current?.(); };
    }, []);

    // Only start fetching when tile is within ~400px of the viewport
    useEffect(() => {
      if (isNearViewport) return;
      const el = tileRef.current;
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsNearViewport(true);
            observer.disconnect();
          }
        },
        { rootMargin: "900px" } // warm tiles well before they scroll in
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, [isNearViewport]);

    const { blobUrl, error: proxyError } = useProxyImage(isNearViewport ? wallpaper.image_url : null);
    const showError = imgError || proxyError;

    // Staggered delay based on grid position
    const col = index % 2;
    const row = Math.floor(index / 2);
    const staggerDelay = col * 0.08 + row * 0.04;

    return (
      <motion.div
        ref={tileRef}
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, margin: "-30px" }}
        transition={{
          duration: 0.5,
          delay: staggerDelay,
          ease: [0.16, 1, 0.3, 1],
        }}
        whileTap={{ scale: 0.96 }}
        className="relative cursor-pointer overflow-hidden rounded-2xl bg-secondary/30 group"
        style={{ aspectRatio: "3/5" }}
        onClick={() => { if (!showError) { haptic("light"); onClick(wallpaper); } }}
      >
        {(!imgLoaded || !minDelayDone) && !showError && (
          <div className="absolute inset-0 shimmer-skeleton rounded-2xl" />
        )}
        {imgLoaded && minDelayDone && !showError && (
          <div className="absolute inset-0 tile-reveal-glow rounded-2xl z-10 pointer-events-none" />
        )}
        {showError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-secondary/50 text-muted-foreground/40">
            <RefreshCw className="w-5 h-5" />
            <span className="text-[10px] text-muted-foreground/50">{t("wp.common.failedToLoad")}</span>
          </div>
        ) : blobUrl ? (
          <img
            src={blobUrl}
            alt={wallpaper.title}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-105 ${imgLoaded && minDelayDone ? "opacity-100 scale-100" : "opacity-0 scale-110"}`}
            style={{ filter: "contrast(1.1) saturate(1.2) brightness(1.03)", imageRendering: "auto", WebkitBackfaceVisibility: "hidden", backfaceVisibility: "hidden", transform: "translateZ(0)" }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
        {/* Vignette for depth */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{ boxShadow: "inset 0 0 25px 4px rgba(0,0,0,0.2)" }} />

        {wallpaper.is_premium && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-primary/20 golden-glow">
            <Diamond className="w-3 h-3 text-premium fill-premium" />
          </div>
        )}

        {isAdmin && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="absolute top-3 left-3 w-6 h-6 rounded-full flex items-center justify-center z-30 active:scale-90 transition-transform"
            style={{
              background: deleting ? "hsl(0 50% 30%)" : "hsl(0 70% 45%)",
              border: "1.5px solid hsl(0 60% 60%)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}

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

        {/* Favorite heart */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              haptic("soft");
              onToggleFavorite(wallpaper.id);
            }}
            className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center z-20 active:scale-90 transition-all duration-300"
            style={{
              background: isFavorite ? "hsl(0 80% 55%)" : "hsl(0 0% 0% / 0.5)",
              backdropFilter: "blur(8px)",
              border: "1px solid hsl(0 0% 100% / 0.1)",
            }}
          >
            <Heart className={`w-3 h-3 transition-all ${isFavorite ? "text-white fill-white" : "text-white/80"}`} />
          </button>
        )}

        <div className="absolute bottom-0 inset-x-0 p-3 pr-10">
          <p
            className="text-white text-[13px] font-semibold truncate leading-tight tracking-tight"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}
          >
            {cleanTitle(wallpaper.title)}
          </p>
        </div>
      </motion.div>
    );
  }
);
