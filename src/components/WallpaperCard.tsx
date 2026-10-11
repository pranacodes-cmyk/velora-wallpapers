import { Diamond, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import type { Wallpaper } from "@/data/wallpapers";
import { useState, forwardRef, useEffect } from "react";
import { useProxyImage } from "@/hooks/useProxyImage";

import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";


interface WallpaperCardProps {
  wallpaper: Wallpaper;
  index: number;
  onClick: (wallpaper: Wallpaper) => void;
  isAdmin?: boolean;
}

export const WallpaperCard = forwardRef<HTMLDivElement, WallpaperCardProps>(
  function WallpaperCard({ wallpaper, index, onClick, isAdmin }, ref) {
    const { t } = useT();
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [minDelayDone, setMinDelayDone] = useState(false);
    const { blobUrl, error: proxyError } = useProxyImage(wallpaper.src);
    const showError = imgError || proxyError;

    useEffect(() => {
      const t = setTimeout(() => setMinDelayDone(true), 1000);
      return () => clearTimeout(t);
    }, []);

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
        whileTap={{ scale: 0.97 }}
        className="relative cursor-pointer overflow-hidden rounded-[1.25rem] bg-secondary/30 group active:brightness-95 transition-all will-change-transform"
        onClick={() => { if (!showError) { haptic("light"); onClick(wallpaper); } }}
      >
        {(!imgLoaded || !minDelayDone) && !showError && (
          <div
            className="w-full shimmer-skeleton"
            style={{ aspectRatio: "3/5" }}
          />
        )}
        {showError ? (
          <div
            className="w-full flex flex-col items-center justify-center gap-2 bg-secondary/50 text-muted-foreground/40"
            style={{ aspectRatio: "3/5" }}
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-[10px] text-muted-foreground/50">{t("wp.common.failedToLoad")}</span>
          </div>
        ) : blobUrl ? (
          <img
            src={blobUrl}
            alt={wallpaper.title}
            className={`w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-105 ${imgLoaded && minDelayDone ? "opacity-100" : "opacity-0 absolute inset-0"}`}
            style={{ aspectRatio: "3/5" }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        ) : null}
        
        {wallpaper.isPremium && imgLoaded && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-primary/20 shadow-lg golden-glow">
            <Diamond className="w-3 h-3 text-premium fill-premium" />
          </div>
        )}



      </motion.div>
    );
  }
);
