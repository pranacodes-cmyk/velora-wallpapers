import { useState } from "react";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { haptic } from "@/utils/haptics";
import { useCategories } from "@/hooks/useWallpapers";
import { useExitOnBack } from "@/hooks/useAndroidBack";
import { ExitConfirmDialog } from "@/components/ExitConfirmDialog";
import { SearchOverlay } from "@/components/SearchOverlay";
import { useT } from "@/i18n";

export default function Categories() {
  const { t } = useT();
  const navigate = useNavigate();
  const { categories, loading } = useCategories();
  const { showExit, closeExit } = useExitOnBack();
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="h-full flex flex-col bg-background relative overflow-hidden">
      {/* Glass Header */}
      <div
        className="flex-shrink-0 relative z-30 px-5 pt-4 pb-4 safe-top flex items-center justify-between"
        style={{
          background: "hsl(var(--glass))",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          borderBottom: "1px solid hsl(var(--glass-border))",
        }}
      >
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">{t("wp.header.explore")}</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t("wp.header.browse")}</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowSearch(true)}
          className="w-9 h-9 rounded-2xl glass-surface golden-border flex items-center justify-center text-foreground"
        >
          <Search className="w-4 h-4" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-container pb-24">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5 px-3 pt-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-full aspect-[3/4] rounded-[20px] shimmer-skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 px-3 pt-4">
            {categories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                whileTap={{ scale: 0.95 }}
                className="relative cursor-pointer overflow-hidden rounded-[20px] bg-secondary aspect-[3/4] group"
                style={{ boxShadow: "0 8px 24px -6px rgba(0,0,0,0.3)" }}
                onClick={() => { haptic("light"); navigate(`/categories/${cat.slug}`); }}
              >
                {cat.thumbnail_url ? (
                  <img
                    src={cat.thumbnail_url}
                    alt={cat.name}
                    crossOrigin="anonymous"
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full bg-secondary" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-base font-bold text-white leading-tight">{cat.name}</h3>
                  <p className="text-[10px] font-medium text-white/60 mt-0.5">{t("wp.category.items", { count: cat.count })}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <ExitConfirmDialog open={showExit} onClose={closeExit} />
      <SearchOverlay open={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}
