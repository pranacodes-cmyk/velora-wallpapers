import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Trash2 } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { supabase } from "@/integrations/supabase/client";
import { StaticWallpaperTile } from "@/components/StaticWallpaperTile";
import { LiveWallpaperTile } from "@/components/LiveWallpaperTile";
import { WallpaperDetail } from "@/components/WallpaperDetail";
import type { StaticWallpaperDB } from "@/hooks/useHomeFeed";
import type { LiveWallpaperDB } from "@/hooks/useLiveWallpapers";
import { haptic } from "@/utils/haptics";
import { toast } from "sonner";
import { useT } from "@/i18n";

export default function FavoritesPage() {
  const { t } = useT();
  const { favorites, isFavorite, toggleFavorite, clearFavorites, count } = useFavorites();
  const [staticWalls, setStaticWalls] = useState<StaticWallpaperDB[]>([]);
  const [liveWalls, setLiveWalls] = useState<LiveWallpaperDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatic, setSelectedStatic] = useState<StaticWallpaperDB | null>(null);
  const [tab, setTab] = useState<"all" | "static" | "live">("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const staticIds = favorites.filter((f) => f.type === "static").map((f) => f.id);
      const liveIds = favorites.filter((f) => f.type === "live").map((f) => f.id);

      const [staticRes, liveRes] = await Promise.all([
        staticIds.length > 0
          ? supabase.from("wallpapers").select("*").in("id", staticIds)
          : Promise.resolve({ data: [] }),
        liveIds.length > 0
          ? supabase.from("live_wallpapers").select("*").in("id", liveIds)
          : Promise.resolve({ data: [] }),
      ]);

      setStaticWalls((staticRes.data as StaticWallpaperDB[]) || []);
      setLiveWalls((liveRes.data as LiveWallpaperDB[]) || []);
      setLoading(false);
    }
    load();
  }, [favorites]);

  const filteredStatic = tab === "live" ? [] : staticWalls;
  const filteredLive = tab === "static" ? [] : liveWalls;
  const totalCount = filteredStatic.length + filteredLive.length;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Glass Header */}
      <div
        className="flex-shrink-0 relative z-30 px-5 pt-4 pb-3 safe-top"
        style={{
          background: "hsl(var(--glass))",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          borderBottom: "1px solid hsl(var(--glass-border))",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">{t("fav.title")}</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t("fav.subtitle", { count })}</p>
          </div>
          {count > 0 && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                haptic("medium");
                clearFavorites();
                toast.success(t("fav.toast.cleared"));
              }}
              className="w-9 h-9 rounded-2xl glass-surface golden-border flex items-center justify-center text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mt-3">
          {(["all", "live", "static"] as const).map((tabId) => (
            <button
              key={tabId}
              onClick={() => { haptic("soft"); setTab(tabId); }}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 ${
                tab === tabId
                  ? "premium-gradient text-white shadow-lg shadow-primary/25"
                  : "glass-surface text-muted-foreground"
              }`}
            >
              {tabId === "all" ? t("fav.tab.all") : tabId === "live" ? t("fav.tab.live") : t("fav.tab.photos")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-container pb-24">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 px-3 pt-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[9/16] rounded-[20px] shimmer-skeleton" />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60dvh] text-center px-8">
            <div
              className="w-20 h-20 rounded-[28px] flex items-center justify-center mb-4"
              style={{
                background: "hsl(var(--primary) / 0.08)",
                border: "1px solid hsl(var(--primary) / 0.1)",
              }}
            >
              <Heart className="w-8 h-8 text-primary/40" />
            </div>
            <p className="text-lg font-bold text-foreground">{t("fav.empty.title")}</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {t("fav.empty.subtitle")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 px-3 pt-3">
            {filteredLive.map((lw, i) => (
              <LiveWallpaperTile
                key={lw.id}
                wallpaper={lw}
                index={i}
                onClick={() => {}}
                isFavorite={isFavorite(lw.id)}
                onToggleFavorite={() => toggleFavorite(lw.id, "live")}
              />
            ))}
            {filteredStatic.map((sw, i) => (
              <StaticWallpaperTile
                key={sw.id}
                wallpaper={sw}
                index={filteredLive.length + i}
                onClick={() => setSelectedStatic(sw)}
                isFavorite={isFavorite(sw.id)}
                onToggleFavorite={() => toggleFavorite(sw.id, "static")}
              />
            ))}
          </div>
        )}
      </div>

      {selectedStatic && (() => {
        const idx = filteredStatic.findIndex((w) => w.id === selectedStatic.id);
        const prev = idx > 0 ? filteredStatic[idx - 1] : null;
        const next = idx >= 0 && idx < filteredStatic.length - 1 ? filteredStatic[idx + 1] : null;
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
    </div>
  );
}
