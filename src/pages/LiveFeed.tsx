import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Search, Flame, Quote, Heart, Crown, Star, Sun, Moon, Flower2, Swords, Bird, Shield, Eye, Drama, Palette, Zap, FlaskConical, ChevronDown } from "lucide-react";
import { DailyVerseTicker } from "@/components/DailyVerseTicker";

import { PremiumCrossLogo } from "@/components/PremiumCrossLogo";
import { MorningDevotional } from "@/components/MorningDevotional";
import { DailyVerseCard } from "@/components/DailyVerseCard";

import { getDirectImageUrl } from "@/utils/imageUrl";
import { motion, AnimatePresence } from "framer-motion";
import { LivePreviewOverlay } from "@/components/LivePreviewOverlay";
import type { LiveWallpaperDB } from "@/hooks/useLiveWallpapers";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { ExitConfirmDialog } from "@/components/ExitConfirmDialog";
import { usePremium } from "@/hooks/usePremium";
import { PremiumSheet } from "@/components/PremiumSheet";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";
import { useLiveFeed } from "@/hooks/useLiveFeed";
import { applyLiveWallpaperWithDiagnostics } from "@/services/live-wallpaper-apply";
import { supabase } from "@/integrations/supabase/client";
import { recordSwipeAndMaybeShowAd } from "@/services/swipe-ad-counter";
import { useAdmin } from "@/hooks/useAdmin";
import { useQueryClient } from "@tanstack/react-query";
import { ReorderDialog } from "@/components/ReorderDialog";
import { SearchOverlay } from "@/components/SearchOverlay";

import { Diamond, Play, Trash2 } from "lucide-react";
import { LiveWallpaperTile } from "@/components/LiveWallpaperTile";
import { useFavorites } from "@/hooks/useFavorites";
import { NewTodayBanner } from "@/components/NewTodayBanner";

const categoryPills = [
  { id: "all", label: "All", Icon: Flame },
  { id: "jesus-christ", label: "Jesus", Icon: Sun },
  { id: "quotes", label: "Quotes", Icon: Quote },
  { id: "cross", label: "Cross", Icon: Shield },
  { id: "prayer", label: "Prayer", Icon: Heart },
  { id: "church", label: "Church", Icon: Moon },
  { id: "holy-spirit", label: "Spirit", Icon: Zap },
  { id: "good-friday", label: "Friday", Icon: Swords },
  { id: "nature-creation", label: "Creation", Icon: Drama },
  { id: "aesthetic-christian", label: "Aesthetic", Icon: Star },
];

interface LiveFeedPageProps {
  modeControl?: React.ReactNode;
}

export default function LiveFeedPage({ modeControl }: LiveFeedPageProps = {}) {
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedLive, setSelectedLive] = useState<LiveWallpaperDB | null>(null);

  // Deep-link open: when navigated here with location.state.previewLive,
  // open the live preview/apply overlay for that wallpaper immediately.
  useEffect(() => {
    const incoming = (location.state as { previewLive?: LiveWallpaperDB } | null)?.previewLive;
    if (incoming) {
      setSelectedLive(incoming);
      // Clear the state so back-navigation / re-renders don't re-open it.
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);
  const { isPremium, unlock } = usePremium();
  const { isAdmin } = useAdmin();
  const [showPremium, setShowPremium] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reorderTarget, setReorderTarget] = useState<{ wallpaper: LiveWallpaperDB; pos: number } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [applyingLive, setApplyingLive] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();

  const { feed, loading, loadingMore, hasMore, loadMore } = useLiveFeed(
    activeCategory === "all" ? undefined : activeCategory
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipingHorizontally = useRef(false);
  const lastSwipeTime = useRef(0);
  const suppressTapUntil = useRef(0);

  // Infinite scroll
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = root;
      if (scrollHeight - scrollTop - clientHeight < 800 && hasMore && !loadingMore) loadMore();
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [loadMore, hasMore, loadingMore]);

  const backHandler = useCallback(() => {
    if (showPremium) { setShowPremium(false); return; }
    if (selectedLive) { setSelectedLive(null); return; }
    setShowExit(true);
  }, [showPremium, selectedLive]);

  useAndroidBack(backHandler);

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
    const applyResult = await applyLiveWallpaperWithDiagnostics({ videoUrl: directVideoUrl, videoId, forceRefresh: true });
    if (applyResult.applied) {
      haptic("heavy");
      toast.success(t("wp.applied"));
      // Most "blessed" moment — fire rating prompt after the celebration settles
      import("@/services/rating").then((m) => {
        setTimeout(() => m.maybeRequestRating(), 3500);
      }).catch(() => {});
    } else if (applyResult.error) {
      toast.error(applyResult.error || "Failed to set live wallpaper");
    } else {
      toast.info(t("wp.notApplied"), { duration: 1500 });
    }
    setApplyingLive(false);
  };

  const handleApplyLive = async (wallpaper: LiveWallpaperDB) => {
    if (applyingLive) return;
    // Live wallpapers are Pro-only (no ad unlock) — every tile needs premium.
    if (!isPremium) { setShowPremium(true); return; }
    doApplyLive(wallpaper);
  };

  const handleGoPremium = () => {
    setShowPremium(true);
  };

  const handleReorderConfirm = async (newPos: number) => {
    if (!reorderTarget) return;
    const { wallpaper } = reorderTarget;
    setReorderTarget(null);
    setSaving(true);
    // Save scroll position before refetch
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    try {
      const { data, error } = await supabase.functions.invoke("rank-live-wallpapers", {
        body: { rankings: [{ id: wallpaper.id, position: newPos }] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Moved to #${newPos}!`, { duration: 1500 });
      await queryClient.invalidateQueries({ queryKey: ["live-feed-rr"] });
      // Restore scroll position after refetch
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollTop, behavior: "instant" as ScrollBehavior });
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const scrollPillIntoView = useCallback((idx: number) => {
    const container = pillsRef.current;
    if (!container) return;
    const pill = container.children[idx] as HTMLElement;
    if (pill) pill.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, []);

  const switchCategory = useCallback((dir: 1 | -1) => {
    const curIdx = categoryPills.findIndex(c => c.id === activeCategory);
    const nextIdx = curIdx + dir;
    if (nextIdx < 0 || nextIdx >= categoryPills.length) return;
    haptic("soft");
    setActiveCategory(categoryPills[nextIdx].id);
    scrollPillIntoView(nextIdx);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    recordSwipeAndMaybeShowAd(isPremium);
  }, [activeCategory, scrollPillIntoView, isPremium]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipingHorizontally.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipingHorizontally.current = true;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastSwipeTime.current < 400) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      lastSwipeTime.current = now;
      suppressTapUntil.current = now + 350;
      switchCategory(dx < 0 ? 1 : -1);
    }
  }, [switchCategory]);

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (Date.now() < suppressTapUntil.current || swipingHorizontally.current) {
      e.preventDefault();
      e.stopPropagation();
      swipingHorizontally.current = false;
    }
  }, []);

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      {/* ── Glass Header ── */}
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
        {/* Title row */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
          <div className="flex items-center gap-2.5">
            {/* App icon */}
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
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/test")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--foreground) / 0.06)", border: "1px solid hsl(var(--glass-border))" }}>
                <FlaskConical className="w-4 h-4 text-muted-foreground" />
              </motion.button>
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

        {/* Category pills */}
        <div className="px-2 pb-2">
          <div ref={pillsRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide px-1 py-0.5 items-center">
            {categoryPills.map((cat, pillIdx) => {
              const active = activeCategory === cat.id;
              return (
                <motion.button
                  key={cat.id}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => {
                    haptic("soft");
                    setActiveCategory(cat.id);
                    scrollPillIntoView(pillIdx);
                    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-300 ${
                    active
                      ? "text-white shadow-lg"
                      : "text-muted-foreground"
                  }`}
                  style={active ? {
                    background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
                    boxShadow: "0 2px 12px hsl(var(--primary) / 0.3)",
                  } : {
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--glass-border))",
                  }}
                >
                  <cat.Icon className="w-3 h-3" strokeWidth={active ? 2.5 : 1.8} />
                  {cat.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-container pb-24" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onClickCapture={handleClickCapture}>

        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 px-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[9/16] rounded-[20px] shimmer-skeleton" />
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="w-full h-[60dvh] flex flex-col items-center justify-center text-muted-foreground gap-2">
            <span className="text-4xl">🕊️</span>
            <p className="text-sm font-medium">{t("wp.feed.noResults")}</p>
          </div>
        ) : (
          <>
             {activeCategory === "all" && <NewTodayBanner />}
             {activeCategory === "all" && <DailyVerseCard />}
             <div className="grid grid-cols-2 gap-2.5 px-3">
               {feed.map((wp, i) => (
                  <LiveWallpaperTile
                    key={wp.id}
                    wallpaper={wp}
                    index={i}
                    onClick={(w) => setSelectedLive(w)}
                    isAdmin={isAdmin}
                    isFavorite={isFavorite(wp.id)}
                    onToggleFavorite={() => toggleFavorite(wp.id, "live")}
                    rank={isAdmin ? i + 1 : undefined}
                    onReorder={isAdmin ? (w, pos) => setReorderTarget({ wallpaper: w, pos }) : undefined}
                    onDelete={isAdmin ? () => queryClient.invalidateQueries({ queryKey: ["live-feed-rr"] }) : undefined}
                    lockAll={!isPremium}
                  />
               ))}
             </div>
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="golden-pulse-dots"><span /><span /><span /></div>
              </div>
            )}
            {!hasMore && feed.length > 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">You've seen them all ✨</p>
            )}
          </>
        )}
      </div>

      {/* ── Overlays & Sheets ── */}
      <AnimatePresence>
        {selectedLive && (() => {
          const idx = feed.findIndex((w) => w.id === selectedLive.id);
          const prev = idx > 0 ? feed[idx - 1] : null;
          const next = idx >= 0 && idx < feed.length - 1 ? feed[idx + 1] : null;
          return (
            <LivePreviewOverlay
              wallpaper={selectedLive}
              onClose={() => setSelectedLive(null)}
              onApply={() => handleApplyLive(selectedLive)}
              applying={applyingLive}
              isPremiumUser={isPremium}
              isPremiumWallpaper={!isPremium}
              onPremium={() => setShowPremium(true)}
              onPrev={prev ? () => setSelectedLive(prev) : undefined}
              onNext={next ? () => setSelectedLive(next) : undefined}
            />
          );
        })()}
      </AnimatePresence>

      <PremiumSheet isOpen={showPremium} onClose={() => setShowPremium(false)} onUnlock={unlock} trigger="live_feed" />

      {/* Dev-only: floating button to preview Premium modal in web preview */}
      {!Capacitor.isNativePlatform() && !isPremium && !showPremium && (
        <button
          onClick={() => { haptic("medium"); setShowPremium(true); }}
          className="fixed bottom-24 right-4 z-[60] flex items-center gap-1.5 px-3 py-2 rounded-full font-extrabold text-[11px] tracking-wide shadow-2xl active:scale-95 transition-transform"
          style={{
            background: "linear-gradient(135deg, hsl(45 85% 55%), hsl(35 80% 42%))",
            color: "hsl(0 0% 0%)",
            boxShadow: "0 8px 24px hsl(45 85% 55% / 0.45), 0 2px 6px hsl(0 0% 0% / 0.5)",
            border: "1px solid hsl(45 90% 70% / 0.4)",
          }}
          aria-label="Preview Premium"
        >
          <Crown className="w-3.5 h-3.5" />
          Preview Premium
        </button>
      )}

      <ExitConfirmDialog open={showExit} onClose={useCallback(() => setShowExit(false), [])} />
      <SearchOverlay open={showSearch} onClose={() => setShowSearch(false)} />

      {/* Blocking overlay while live wallpaper is being applied */}
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
      <ReorderDialog
        open={!!reorderTarget}
        title={reorderTarget?.wallpaper.title || ""}
        currentPos={reorderTarget?.pos || 0}
        onConfirm={handleReorderConfirm}
        onCancel={() => setReorderTarget(null)}
      />
    </div>
  );
}
