import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Wallpaper {
  id: string;
  title: string;
  image_url: string;
  is_premium: boolean;
  category_id: string | null;
  category_slug?: string;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  sort_order: number;
  count?: number;
}

const PAGE_SIZE = 20;

function mapWallpaper(w: any): Wallpaper {
  return {
    id: w.id,
    title: w.title,
    image_url: w.image_url,
    is_premium: w.is_premium,
    category_id: w.category_id,
    category_slug: w.categories?.slug || "",
    sort_order: w.sort_order,
  };
}

export function useWallpapers(categorySlug?: string) {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const categoryIdRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  // Reset when category changes
  useEffect(() => {
    setWallpapers([]);
    pageRef.current = 0;
    setHasMore(true);
    hasMoreRef.current = true;
    setLoading(true);

    async function resolveCategoryAndFetch() {
      let catId: string | null = null;
      if (categorySlug && categorySlug !== "all") {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", categorySlug)
          .single();
        catId = cat?.id || null;
      }
      categoryIdRef.current = catId;

      let query = supabase
        .from("wallpapers")
        .select("*, categories!left(slug)")
        .order("sort_order", { ascending: true })
        .range(0, PAGE_SIZE - 1);

      if (catId) query = query.eq("category_id", catId);

      const { data } = await query;
      if (data) {
        setWallpapers(data.map(mapWallpaper));
        const more = data.length === PAGE_SIZE;
        setHasMore(more);
        hasMoreRef.current = more;
      }
      setLoading(false);
    }

    resolveCategoryAndFetch();
  }, [categorySlug]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    const nextPage = pageRef.current + 1;
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("wallpapers")
      .select("*, categories!left(slug)")
      .order("sort_order", { ascending: true })
      .range(from, to);

    if (categoryIdRef.current) query = query.eq("category_id", categoryIdRef.current);

    const { data } = await query;
    if (data) {
      setWallpapers((prev) => [...prev, ...data.map(mapWallpaper)]);
      const more = data.length === PAGE_SIZE;
      setHasMore(more);
      hasMoreRef.current = more;
      pageRef.current = nextPage;
    }
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, []);

  return { wallpapers, loading, loadingMore, hasMore, loadMore };
}

/** Fetch top N wallpapers across all categories for hero section */
export function useHeroWallpapers(limit = 50) {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      // Fetch top wallpapers ordered by sort_order (best first), spread across categories
      const { data } = await supabase
        .from("wallpapers")
        .select("*, categories!left(slug)")
        .order("sort_order", { ascending: true })
        .limit(limit);

      if (data) {
        // Distribute evenly across categories for variety
        const byCategory: Record<string, Wallpaper[]> = {};
        data.forEach((w: any) => {
          const catId = w.category_id || "uncategorized";
          if (!byCategory[catId]) byCategory[catId] = [];
          byCategory[catId].push(mapWallpaper(w));
        });

        // Round-robin pick from each category
        const result: Wallpaper[] = [];
        const cats = Object.values(byCategory);
        let idx = 0;
        while (result.length < limit && cats.some(c => c.length > 0)) {
          for (const cat of cats) {
            if (cat.length > 0 && result.length < limit) {
              result.push(cat.shift()!);
            }
          }
          idx++;
          if (idx > limit) break; // safety
        }
        setWallpapers(result);
      }
      setLoading(false);
    }
    fetch();
  }, [limit]);

  return { heroWallpapers: wallpapers, heroLoading: loading };
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (cats) {
        // Fetch counts in batches to avoid 1000-row limit
        const counts: Record<string, number> = {};
        let from = 0;
        const batchSize = 1000;
        while (true) {
          const { data: batch } = await supabase
            .from("wallpapers")
            .select("category_id")
            .range(from, from + batchSize - 1);
          if (!batch || batch.length === 0) break;
          batch.forEach((w: any) => {
            if (w.category_id) {
              counts[w.category_id] = (counts[w.category_id] || 0) + 1;
            }
          });
          if (batch.length < batchSize) break;
          from += batchSize;
        }

        setCategories(
          cats.map((c: any) => ({
            ...c,
            count: counts[c.id] || 0,
          }))
        );
      }
      setLoading(false);
    }
    fetch();
  }, []);

  return { categories, loading };
}
