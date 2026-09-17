import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ReorderDialog } from "@/components/ReorderDialog";
import { useReorderQueue } from "@/hooks/useReorderQueue";
import { useAndroidBack } from "@/hooks/useAndroidBack";
import { useT } from "@/i18n";

interface SearchResult {
  id: string;
  title: string;
  image_url?: string;
  thumbnail_url?: string;
  type: "static" | "live";
  category?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: Props) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [reorderTarget, setReorderTarget] = useState<{ result: SearchResult; pos: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { enqueue } = useReorderQueue(() => setSaving(false));

  // Hardware back closes the overlay (instead of triggering exit prompt)
  useAndroidBack(open ? onClose : undefined);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const searchTerm = `%${query.trim()}%`;
        const [staticRes, liveRes] = await Promise.all([
          supabase.from("wallpapers").select("id, title, image_url").ilike("title", searchTerm).limit(10),
          supabase.from("live_wallpapers").select("id, title, thumbnail_url, category").ilike("title", searchTerm).limit(10),
        ]);

        const statics: SearchResult[] = (staticRes.data || []).map((w) => ({
          id: w.id, title: w.title, image_url: w.image_url, type: "static" as const,
        }));
        const lives: SearchResult[] = (liveRes.data || []).map((w) => ({
          id: w.id, title: w.title, thumbnail_url: w.thumbnail_url, type: "live" as const, category: w.category,
        }));
        setResults([...lives, ...statics]);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const getThumbUrl = useCallback((r: SearchResult) => {
    const url = r.type === "live" ? r.thumbnail_url : r.image_url;
    if (!url) return null;
    const r2Host = "https://pub-de6e465d65ed4e5bbc4515e0da940246.r2.dev/";
    if (url.startsWith(r2Host)) {
      return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy/${url.slice(r2Host.length)}`;
    }
    return url;
  }, []);

  const handleReorderConfirm = async (newPos: number) => {
    if (!reorderTarget) return;
    const { result } = reorderTarget;
    setReorderTarget(null);
    setSaving(true);
    enqueue({
      id: result.id,
      title: result.title,
      position: newPos,
      table: result.type === "live" ? "live" : "static",
    });
  };

  if (!open) return null;

  return (
    <motion.div
      data-back-consumer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[80] bg-background flex flex-col"
    >
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-3 safe-top">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full glass-surface golden-border flex items-center justify-center text-foreground/80 shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("wp.search.placeholder")}
            className="w-full h-11 rounded-xl bg-secondary/60 border border-primary/10 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        {saving && <div className="w-5 h-5 border-2 border-primary/40 border-t-primary rounded-full animate-spin shrink-0" />}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto scroll-container px-4 pb-28">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Search className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("wp.search.noResultsFor", { query })}</p>
          </div>
        )}

        {!loading && query.length < 2 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Search className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/60">{t("wp.search.typeToSearch")}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {results.map((r, i) => (
              <SearchTile
                key={r.id}
                result={r}
                index={i}
                getThumbUrl={getThumbUrl}
                onClick={() => setReorderTarget({ result: r, pos: 1 })}
              />
            ))}
          </div>
        )}
      </div>

      <ReorderDialog
        open={!!reorderTarget}
        title={reorderTarget?.result.title || ""}
        currentPos={reorderTarget?.pos || 0}
        onConfirm={handleReorderConfirm}
        onCancel={() => setReorderTarget(null)}
      />
    </motion.div>
  );
}

interface SearchTileProps {
  result: SearchResult;
  index: number;
  getThumbUrl: (r: SearchResult) => string | null;
  onClick: () => void;
}

function SearchTile({ result, index, getThumbUrl, onClick }: SearchTileProps) {
  const { t } = useT();
  const proxiedUrl = getThumbUrl(result);
  const directUrl = result.type === "live" ? result.thumbnail_url : result.image_url;

  const [src, setSrc] = useState<string | null>(proxiedUrl);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [triedDirect, setTriedDirect] = useState(false);

  if (failed) return null; // Hide tiles that ultimately can't load

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      className="relative aspect-[3/5] rounded-2xl overflow-hidden bg-secondary cursor-pointer group"
      onClick={onClick}
    >
      {!loaded && (
        <div className="absolute inset-0 shimmer-skeleton" />
      )}
      {src && (
        <img
          src={src}
          alt={result.title}
          crossOrigin="anonymous"
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!triedDirect && directUrl && directUrl !== src) {
              setTriedDirect(true);
              setSrc(directUrl);
            } else {
              setFailed(true);
            }
          }}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {loaded && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
              result.type === "live" ? "bg-primary/20 text-primary" : "bg-foreground/10 text-foreground/70"
            }`}>
              {result.type === "live" ? t("wp.search.liveBadge") : t("wp.search.staticBadge")}
            </span>
            <p className="text-white text-xs font-semibold mt-1.5 line-clamp-2">{result.title}</p>
          </div>
        </>
      )}
    </motion.div>
  );
}
