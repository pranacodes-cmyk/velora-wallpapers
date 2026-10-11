import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, FlaskConical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

import { PremiumCrossLogo } from "@/components/PremiumCrossLogo";

import { DailyVerseCard } from "@/components/DailyVerseCard";
import { LiveWallpaperTile } from "@/components/LiveWallpaperTile";
import { StaticWallpaperTile } from "@/components/StaticWallpaperTile";
import { LivePreviewOverlay } from "@/components/LivePreviewOverlay";
import { WallpaperDetail } from "@/components/WallpaperDetail";
import { PremiumSheet } from "@/components/PremiumSheet";
import { SearchOverlay } from "@/components/SearchOverlay";

import { useLiveFeed } from "@/hooks/useLiveFeed";
import { useStaticFeed } from "@/hooks/useStaticFeed";
import { usePremium } from "@/hooks/usePremium";
import { useAdmin } from "@/hooks/useAdmin";
import { useFavorites } from "@/hooks/useFavorites";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";
import { applyLiveWallpaperWithDiagnostics } from "@/services/live-wallpaper-apply";
import { getDirectImageUrl } from "@/utils/imageUrl";
import type { LiveWallpaperDB } from "@/hooks/useLiveWallpapers";
import type { StaticWallpaperDB } from "@/hooks/useHomeFeed";

type Item =
  | { kind: "live"; data: LiveWallpaperDB; key: string }
  | { kind: "static"; data: StaticWallpaperDB; key: string };

// Interleave: 3 lives then 1 static, repeat. Flush remainder when one runs out.
function interleave(lives: LiveWallpaperDB[], statics: StaticWallpaperDB[]): Item[] {
  const out: Item[] = [];
  let li = 0;
  let si = 0;
  while (li < lives.length || si < statics.length) {
    for (let k = 0; k < 3 && li < lives.length; k++, li++) {
      out.push({ kind: "live", data: lives[li], key: `l-${lives[li].id}` });
    }
    if (si < statics.length) {
      out.push({ kind: "static", data: statics[si], key: `s-${statics[si].id}` });
      si++;
    }
  }
  return out;
}

interface Props {
  modeControl?: React.ReactNode;
}

export default function BothFeed({ modeControl }: Props = {}) {
  const { t } = useT();
  const navigate = useNavigate();
  const { isPremium, unlock } = usePremium();
  const { isAdmin } = useAdmin();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [showSearch, setShowSearch] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [selectedLive, setSelectedLive] = useState<LiveWallpaperDB | null>(null);
  const [selectedStatic, setSelectedStatic] = useState<StaticWallpaperDB | null>(null);
  const [applyingLive, setApplyingLive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Both feeds — kept simple, category = all.
  const {
    feed: liveFeed,
    loading: liveLoading,
    loadingMore: liveLoadingMore,
    hasMore: liveHasMore,
    loadMore: liveLoadMore,
  } = useLiveFeed(undefined);
  const {
    feed: staticFeed,
    loading: staticLoading,
    loadingMore: staticLoadingMore,
    hasMore: staticHasMore,
    loadMore: staticLoadMore,
  } = useStaticFeed(undefined);

  const items = useMemo(() => interleave(liveFeed, staticFeed), [liveFeed, staticFeed]);
  const loading = liveLoading && staticLoading;
  const loadingMore = liveLoadingMore || staticLoadingMore;
  const hasMore = liveHasMore || staticHasMore;

  // Infinite scroll — top up whichever side still has data.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = root;
      if (scrollHeight - scrollTop - clientHeight < 800) {
        if (liveHasMore && !liveLoadingMore) liveLoadMore();
        if (staticHasMore && !staticLoadingMore) staticLoadMore();
      }
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [liveHasMore, liveLoadingMore, liveLoadMore, staticHasMore, staticLoadingMore, staticLoadMore]);

  // Live apply pipeline (mirrors LiveFeed.tsx for consistency).
  const doApplyLive = async (wallpaper: LiveWallpaperDB) => {
    if (!Capacitor.isNativePlatform()) {
      setApplyingLive(true);
      await new Promise((r) => setTimeout(r, 600));
      haptic("heavy");
      toast.success(t("wp.applied.preview"));
      setApplyingLive(false);
      import("@/services/rating").then((m) => {
        setTimeout(() => m.maybeRequestRating(), 3500);
      }).catch(() => {});
      return;
    }
    setApplyingLive(true);
    const directVideoUrl = getDirectImageUrl(wallpaper.video_url);
    const videoId = directVideoUrl.split("/").pop()?.replace(".mp4", "") || "";
    const r = await applyLiveWallpaperWithDiagnostics({ videoUrl: directVideoUrl, videoId, forceRefresh: true });
    if (r.applied) {
      haptic("heavy");
      toast.success(t("wp.applied"));
      import("@/services/rating").then((m) => {
        setTimeout(() => m.maybeRequestRating(), 3500);
      }).catch(() => {});
    } else if (r.error) {
      toast.error(r.error);
    } else {
      toast.info(t("wp.notApplied"), { duration: 1500 });
    }
    setApplyingLive(false);
  };

  const handleApplyLive = async (w: LiveWallpaperDB) => {
    if (applyingLive) return;
    if (w.is_premium && !isPremium) { setShowPremium(true); return; }
    doApplyLive(w);
  };

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      {/* Header */}
      <div
        className="flex-shrink-0 relative z-30"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px), 0.5rem)",
          background: "linear-gradient(180deg, hsl(var(--background)), hsl(var(--background) / 0.92))",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderBottom: "1px solid hsl(var(--glass-border))",
        }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-3">
          <div className="flex items-center gap-2.5">
            <PremiumCrossLogo size={32} />
            <div className="leading-none min-w-0">
              <h1 className="text-[16px] font-black tracking-[-0.02em] leading-tight">
                <span style={{ color: "hsl(var(--primary))" }}>Prayly</span>
              </h1>
              <p className="text-[8px] font-bold tracking-[0.18em] uppercase mt-0.5" style={{ color: "hsl(var(--muted-foreground) / 0.65)" }}>
                Bible Prayer & Verse
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            {modeControl}
            {isAdmin && (
              <Link to="/test">
                <motion.button whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--foreground) / 0.06)", border: "1px solid hsl(var(--glass-border))" }}>
                  <FlaskConical className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              </Link>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { haptic("soft"); setShowSearch(true); }}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "hsl(var(--foreground) / 0.06)", border: "1px solid hsl(var(--glass-border))" }}
            >
              <Search className="w-4 h-4 text-foreground/60" strokeWidth={2.2} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-container pb-24">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 px-3 pt-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[9/16] rounded-[20px] shimmer-skeleton" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="w-full h-[60dvh] flex flex-col items-center justify-center text-muted-foreground gap-2">
            <span className="text-4xl">🕊️</span>
            <p className="text-sm font-medium">{t("wp.feed.noResults")}</p>
          </div>
        ) : (
          <>
            <div className="pt-3"><DailyVerseCard /></div>
            <div className="grid grid-cols-2 gap-2.5 px-3">
              {items.map((it, i) =>
                it.kind === "live" ? (
                  <LiveWallpaperTile
                    key={it.key}
                    wallpaper={it.data}
                    index={i}
                    onClick={(w) => setSelectedLive(w)}
                    isFavorite={isFavorite(it.data.id)}
                    onToggleFavorite={() => toggleFavorite(it.data.id, "live")}
                  />
                ) : (
                  <StaticWallpaperTile
                    key={it.key}
                    wallpaper={it.data}
                    index={i}
                    onClick={(w) => setSelectedStatic(w)}
                    isFavorite={isFavorite(it.data.id)}
                    onToggleFavorite={() => toggleFavorite(it.data.id, "static")}
                  />
                )
              )}
            </div>
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="golden-pulse-dots"><span /><span /><span /></div>
              </div>
            )}
            {!hasMore && items.length > 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">You've seen them all ✨</p>
            )}
          </>
        )}
      </div>

      {/* Live preview overlay */}
      <AnimatePresence>
        {selectedLive && (
          <LivePreviewOverlay
            wallpaper={selectedLive}
            onClose={() => setSelectedLive(null)}
            onApply={() => handleApplyLive(selectedLive)}
            applying={applyingLive}
            isPremiumUser={isPremium}
            isPremiumWallpaper={selectedLive.is_premium && !isPremium}
            onPremium={() => setShowPremium(true)}
          />
        )}
      </AnimatePresence>

      {/* Static apply overlay */}
      {selectedStatic && (
        <WallpaperDetail
          wallpaper={{
            id: selectedStatic.id,
            src: selectedStatic.image_url,
            title: selectedStatic.title,
            category: "",
            isPremium: selectedStatic.is_premium,
          }}
          onClose={() => setSelectedStatic(null)}
        />
      )}

      <PremiumSheet isOpen={showPremium} onClose={() => setShowPremium(false)} onUnlock={unlock} trigger="both_feed" />
      <SearchOverlay open={showSearch} onClose={() => setShowSearch(false)} />

      {/* Blocking overlay while applying live */}
      <AnimatePresence>
        {applyingLive && (
          <motion.div
            key="live-applying-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md"
          >
            <div className="w-16 h-16 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
            <p className="mt-5 text-base font-semibold text-foreground">{t("wp.feed.applyingLive")}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">{t("wp.feed.dontClose")}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
