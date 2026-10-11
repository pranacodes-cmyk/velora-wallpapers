import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, Flame, Shield, Leaf, Palette, Shapes, Swords, Building2, Flower2, Bird, Minimize2, Dumbbell, Stars, Drama, Heart, Sun, Star, ListOrdered, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";
const ShieldAlt = Shield;
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { StaticWallpaperTile } from "@/components/StaticWallpaperTile";
import { WallpaperDetail } from "@/components/WallpaperDetail";
import type { StaticWallpaperDB } from "@/hooks/useHomeFeed";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { usePremium } from "@/hooks/usePremium";
import { PremiumSheet } from "@/components/PremiumSheet";
import { PremiumCrossLogo } from "@/components/PremiumCrossLogo";
import { toast } from "sonner";
import { useStaticFeed } from "@/hooks/useStaticFeed";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAdmin } from "@/hooks/useAdmin";
import { ReorderDialog } from "@/components/ReorderDialog";
import { SearchOverlay } from "@/components/SearchOverlay";
import { haptic } from "@/utils/haptics";
import { useFavorites } from "@/hooks/useFavorites";
import { recordSwipeAndMaybeShowAd } from "@/services/swipe-ad-counter";
import { DailyVerseCard } from "@/components/DailyVerseCard";

const categoryPills = [
  { id: "all", label: "All", Icon: Flame },
  { id: "jesus-christ", label: "Jesus", Icon: Sun },
  { id: "cross", label: "Cross", Icon: Shield },
  { id: "prayer", label: "Prayer", Icon: Heart },
  { id: "daily-verse", label: "Daily", Icon: Leaf },
  { id: "church", label: "Church", Icon: Building2 },
  { id: "holy-spirit", label: "Spirit", Icon: Shapes },
  { id: "good-friday", label: "Friday", Icon: ShieldAlt },
  { id: "nature-creation", label: "Creation", Icon: Leaf },
  { id: "aesthetic-christian", label: "Aesthetic", Icon: Flower2 },
];

interface StaticWallpapersProps {
  modeControl?: React.ReactNode;
}

export default function StaticWallpapers({ modeControl }: StaticWallpapersProps = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedStatic, setSelectedStatic] = useState<StaticWallpaperDB | null>(null);
  const { isPremium, unlock } = usePremium();
  const { isAdmin } = useAdmin();
  const [showPremium, setShowPremium] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();

  const { feed, loading, loadingMore, hasMore, loadMore } = useStaticFeed(
    activeCategory === "all" ? undefined : activeCategory
  );

  const [reorderMode, setReorderMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reorderTarget, setReorderTarget] = useState<{ wallpaper: StaticWallpaperDB; pos: number } | null>(null);

  const handleExitReorder = useCallback(async () => {
    setReorderMode(false);
    await queryClient.invalidateQueries({ queryKey: ["static-feed-rr"] });
  }, [queryClient]);

  useAndroidBack(useCallback(() => {
    if (showPremium) { setShowPremium(false); return; }
    if (reorderMode) { handleExitReorder(); return; }
    if (selectedStatic) { setSelectedStatic(null); return; }
    navigate(-1);
  }, [showPremium, selectedStatic, reorderMode, handleExitReorder, navigate]));

  const handleReorderConfirm = async (newPos: number) => {
    if (!reorderTarget) return;
    const { wallpaper } = reorderTarget;
    setReorderTarget(null);
    setSaving(true);
    // Save scroll position before refetch
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    try {
      const { data, error } = await supabase.functions.invoke("rank-live-wallpapers", {
        body: { rankings: [{ id: wallpaper.id, position: newPos }], table: "static" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Moved to #${newPos}!`, { duration: 1500 });
      await queryClient.invalidateQueries({ queryKey: ["static-feed-rr"] });
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

  const pillsRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swiping = useRef(false);

  const scrollPillIntoView = useCallback((idx: number) => {
    const container = pillsRef.current;
    if (!container) return;
    const pill = container.children[idx] as HTMLElement;
    if (pill) pill.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, []);

  const swipeToCategory = useCallback((direction: "left" | "right") => {
    const currentIdx = categoryPills.findIndex((c) => c.id === activeCategory);
    const nextIdx = direction === "left"
      ? Math.min(currentIdx + 1, categoryPills.length - 1)
      : Math.max(currentIdx - 1, 0);
    if (nextIdx !== currentIdx) {
      haptic("soft");
      setActiveCategory(categoryPills[nextIdx].id);
      scrollPillIntoView(nextIdx);
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      recordSwipeAndMaybeShowAd(isPremium);
    }
  }, [activeCategory, scrollPillIntoView, isPremium]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      swiping.current = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;
      // Lock into horizontal swipe if horizontal movement dominates
      if (!swiping.current && Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swiping.current = true;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!swiping.current || touchStartX.current === null) {
        touchStartX.current = null;
        touchStartY.current = null;
        return;
      }
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) > 50) {
        swipeToCategory(dx < 0 ? "left" : "right");
      }
      touchStartX.current = null;
      touchStartY.current = null;
      swiping.current = false;
    };

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: true });
    root.addEventListener("touchend", onTouchEnd, { passive: true });

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = root;
      if (scrollHeight - scrollTop - clientHeight < 800) loadMore();
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("scroll", onScroll);
    };
  }, [loadMore, swipeToCategory]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* ── Glass Header ── */}
      <div
        className="flex-shrink-0 relative z-30"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px), 0.75rem)",
          background: "hsl(var(--glass))",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          borderBottom: "1px solid hsl(var(--glass-border))",
        }}
      >
        <div className="flex items-center justify-between px-4 pt-2 pb-1.5">
          <div className="flex items-center gap-3">
            <PremiumCrossLogo size={32} />
            <div className="flex flex-col min-w-0">
              <h1 className="text-[16px] font-black tracking-[-0.02em] font-display leading-tight">
                <span className="text-premium">{reorderMode ? "Reorder" : "Prayly"}</span>
                <span className="text-foreground/90">{reorderMode ? " Mode" : ""}</span>
              </h1>
              <p className="text-[8px] text-muted-foreground/70 font-bold mt-0.5 tracking-[0.18em] uppercase">
                {reorderMode ? "Tap number to move" : "Bible Prayer & Verse"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {modeControl}
            {isAdmin && (
              <Link to="/test">
                <motion.div whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-[14px] flex items-center justify-center text-foreground/80" style={{ background: "hsl(var(--foreground) / 0.06)", border: "1px solid hsl(var(--foreground) / 0.08)" }}>
                  <FlaskConical className="w-[18px] h-[18px]" strokeWidth={1.8} />
                </motion.div>
              </Link>
            )}
            {isAdmin && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setReorderMode(!reorderMode)} className="w-9 h-9 rounded-[14px] flex items-center justify-center text-foreground/80" style={{ background: "hsl(var(--foreground) / 0.06)", border: "1px solid hsl(var(--foreground) / 0.08)" }}>
                <ListOrdered className="w-[18px] h-[18px]" strokeWidth={1.8} />
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { haptic("soft"); setShowSearch(true); }}
              className="w-9 h-9 rounded-[14px] flex items-center justify-center text-foreground/80"
              style={{
                background: "hsl(var(--foreground) / 0.06)",
                border: "1px solid hsl(var(--foreground) / 0.08)",
              }}
            >
              <Search className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </motion.button>
          </div>
        </div>

        {/* Category pills */}
        {!reorderMode && (
          <div className="px-2 pb-2.5">
            <div ref={pillsRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide px-1 py-1 items-center">
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
                        ? "premium-gradient text-white shadow-lg shadow-primary/25"
                        : "glass-surface text-muted-foreground"
                    }`}
                  >
                    <cat.Icon className="w-3 h-3" strokeWidth={active ? 2.5 : 1.8} />
                    {cat.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 2x2 Tile Grid ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-container pb-24">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 px-3 pt-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[3/5] rounded-[20px] shimmer-skeleton" />
            ))}
          </div>
        ) : (
          <>
            {activeCategory === "all" && <div className="pt-3"><DailyVerseCard /></div>}
            <div className="grid grid-cols-2 gap-2.5 px-3 pt-3">

              {feed.map((sw, i) => (
                <div key={sw.id} className="relative">
                  <StaticWallpaperTile
                    wallpaper={sw}
                    index={i}
                    onClick={reorderMode ? () => setReorderTarget({ wallpaper: sw, pos: i + 1 }) : () => setSelectedStatic(sw)}
                    isAdmin={isAdmin}
                    isFavorite={isFavorite(sw.id)}
                    onToggleFavorite={() => toggleFavorite(sw.id, "static")}
                    onDelete={isAdmin ? () => queryClient.invalidateQueries({ queryKey: ["static-feed-rr"] }) : undefined}
                    rank={isAdmin && !reorderMode ? i + 1 : undefined}
                    onReorder={isAdmin && !reorderMode ? (w, pos) => setReorderTarget({ wallpaper: w, pos }) : undefined}
                  />
                  {reorderMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setReorderTarget({ wallpaper: sw, pos: i + 1 }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute bottom-12 left-2 z-30 min-w-12 h-12 px-3 rounded-full flex items-center justify-center text-base font-black active:scale-90 transition-transform"
                      style={{
                        background: "hsl(0 0% 0% / 0.85)",
                        color: "hsl(var(--primary))",
                        border: "2.5px solid hsl(var(--primary))",
                        boxShadow: "0 4px 14px hsl(0 0% 0% / 0.5), 0 0 0 3px hsl(var(--background) / 0.4)",
                      }}
                    >
                      #{i + 1}
                    </button>
                  )}
                </div>
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

      {/* Overlays */}
      {selectedStatic && !reorderMode && (() => {
        const idx = feed.findIndex((w) => w.id === selectedStatic.id);
        const prev = idx > 0 ? feed[idx - 1] : null;
        const next = idx >= 0 && idx < feed.length - 1 ? feed[idx + 1] : null;
        // Auto-load more when nearing end
        if (idx >= 0 && idx >= feed.length - 3 && hasMore && !loadingMore) {
          loadMore();
        }
        return (
          <WallpaperDetail
            wallpaper={{
              id: selectedStatic.id,
              src: selectedStatic.image_url,
              title: selectedStatic.title,
              category: "",
              isPremium: selectedStatic.is_premium,
            }}
            onClose={() => setSelectedStatic(null)}
            onPrev={prev ? () => setSelectedStatic(prev) : undefined}
            onNext={next ? () => setSelectedStatic(next) : undefined}
          />
        );
      })()}

      <PremiumSheet isOpen={showPremium} onClose={() => setShowPremium(false)} onUnlock={unlock} trigger="static_wallpapers" />
      <ReorderDialog
        open={!!reorderTarget}
        title={reorderTarget?.wallpaper.title || ""}
        currentPos={reorderTarget?.pos || 0}
        onConfirm={handleReorderConfirm}
        onCancel={() => setReorderTarget(null)}
      />
      <SearchOverlay open={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}
