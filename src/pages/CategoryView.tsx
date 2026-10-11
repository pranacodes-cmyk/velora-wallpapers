import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useWallpapers, useCategories, type Wallpaper } from "@/hooks/useWallpapers";
import { WallpaperCard } from "@/components/WallpaperCard";
import { WallpaperDetail } from "@/components/WallpaperDetail";

import { useAndroidBack } from "@/hooks/useAndroidBack";
import { useAdmin } from "@/hooks/useAdmin";
import { useT } from "@/i18n";

export default function CategoryView() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  // Redirect live-wallpaper category to dedicated GPU shader page
  useEffect(() => {
    if (id === "live-wallpaper") {
      navigate("/live-wallpapers", { replace: true });
    }
  }, [id, navigate]);

  const [selected, setSelected] = useState<Wallpaper | null>(null);
  

  useAndroidBack(useCallback(() => {
    if (selected) {
      setSelected(null);
    } else {
      navigate("/categories");
    }
  }, [selected, navigate]));

  const { categories } = useCategories();
  const category = categories.find((c) => c.slug === id);
  const { wallpapers: items, loading, loadingMore, hasMore, loadMore } = useWallpapers(id);

  // Infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = root;
      if (scrollHeight - scrollTop - clientHeight < 800) {
        loadMore();
      }
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => root.removeEventListener("scroll", onScroll);
  }, [loadMore]);

  const left = items.filter((_, i) => i % 2 === 0);
  const right = items.filter((_, i) => i % 2 === 1);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-4 px-6 pt-8 pb-4 safe-top flex-shrink-0 z-10 relative">
        <button
          onClick={() => navigate("/categories")}
          className="w-11 h-11 rounded-full glass-surface flex items-center justify-center active:scale-90 transition-transform text-foreground hover:bg-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold text-foreground font-display tracking-tight"
          >
            {category?.name || t("wp.category.collection")}
          </motion.h1>
          <p className="text-xs font-medium text-muted-foreground">
            {t("wp.category.countWallpapers", { count: category?.count ?? items.length })}
            {hasMore ? t("wp.category.loading") : ""}
          </p>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scroll-container pb-10">
        {loading ? (
          <div className="flex gap-3 px-4 pt-1">
            {[0, 1].map((col) => (
              <div key={col} className="flex-1 flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-full bg-secondary animate-pulse rounded-card" style={{ aspectRatio: "3/4" }} />
                ))}
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <>
            <div className="flex gap-3 px-4 pt-1">
              <div className="flex-1 flex flex-col gap-3">
                {left.map((w, i) => (
                  <WallpaperCard
                    key={w.id}
                    wallpaper={{ id: w.id, src: w.image_url, title: w.title, category: w.category_slug || "", isPremium: w.is_premium }}
                    index={i * 2}
                    onClick={() => setSelected(w)}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
              <div className="flex-1 flex flex-col gap-3 pt-8">
                {right.map((w, i) => (
                  <WallpaperCard
                    key={w.id}
                    wallpaper={{ id: w.id, src: w.image_url, title: w.title, category: w.category_slug || "", isPremium: w.is_premium }}
                    index={i * 2 + 1}
                    onClick={() => setSelected(w)}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </div>
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-muted-foreground text-sm">{t("wp.category.none")}</p>
          </div>
        )}
      </div>

      {selected && (() => {
        const idx = items.findIndex((w) => w.id === selected.id);
        const prev = idx > 0 ? items[idx - 1] : null;
        const next = idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null;
        if (idx >= 0 && idx >= items.length - 3 && hasMore && !loadingMore) {
          loadMore();
        }
        return (
          <WallpaperDetail
            wallpaper={{ id: selected.id, src: selected.image_url, title: selected.title, category: selected.category_slug || "", isPremium: selected.is_premium }}
            onClose={() => setSelected(null)}
            onPrev={prev ? () => setSelected(prev) : undefined}
            onNext={next ? () => setSelected(next) : undefined}
          />
        );
      })()}
    </div>
  );
}
