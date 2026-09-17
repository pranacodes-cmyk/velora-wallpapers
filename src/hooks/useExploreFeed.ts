import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";
import type { StaticWallpaperDB } from "@/hooks/useHomeFeed";
import type { LiveWallpaperDB } from "@/hooks/useLiveWallpapers";
import { useIsOnboardingActive } from "@/contexts/OnboardingContext";

export type FeedItem =
  | { type: "static"; data: StaticWallpaperDB }
  | { type: "live"; data: LiveWallpaperDB };

const PAGE_SIZE = 10; // per type per page

/**
 * Maps a static category slug to its corresponding live_wallpapers.category value.
 * Most match 1:1 except: "space" → "cosmic"
 */
function toLiveCategory(slug: string): string[] {
  const map: Record<string, string[]> = {
    space: ["cosmic"],
    "post-apocalyptic": ["post-apocalyptic"],
  };
  return map[slug] || [slug];
}

export function useExploreFeed(categorySlug?: string) {
  const isOnboardingActive = useIsOnboardingActive();
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["explore-feed", categorySlug],
    enabled: !isOnboardingActive,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam = 0 }) => {
      const offset = pageParam * PAGE_SIZE;

      // Fetch statics
      let staticQuery = supabase
        .from("wallpapers")
        .select("id, title, image_url, is_premium, category_id, sort_order, categories!inner(slug)")
        .order("sort_order", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (categorySlug && categorySlug !== "all") {
        staticQuery = supabase
          .from("wallpapers")
          .select("id, title, image_url, is_premium, category_id, sort_order, categories!inner(slug)")
          .eq("categories.slug", categorySlug)
          .order("sort_order", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
      }

      // Fetch lives
      let liveQuery = supabase
        .from("live_wallpapers")
        .select("*")
        .order("sort_order", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (categorySlug && categorySlug !== "all") {
        const liveCats = toLiveCategory(categorySlug);
        if (liveCats.length === 1) {
          liveQuery = liveQuery.eq("category", liveCats[0]);
        } else {
          liveQuery = liveQuery.in("category", liveCats);
        }
      }

      const [staticRes, liveRes] = await Promise.all([
        staticQuery,
        liveQuery,
      ]);

      const statics = ((staticRes.data || []) as any[]).map((w) => ({
        id: w.id,
        title: w.title,
        image_url: w.image_url,
        is_premium: w.is_premium,
        category_id: w.category_id,
        sort_order: w.sort_order,
      })) as StaticWallpaperDB[];

      const lives = (liveRes.data || []) as LiveWallpaperDB[];

      return { statics, lives, page: pageParam };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.statics.length === 0 && lastPage.lives.length === 0) {
        return undefined;
      }
      return lastPage.page + 1;
    },
    initialPageParam: 0,
  });

  // Interleave 1 static : 1 live
  const feed: FeedItem[] = [];
  if (data) {
    for (const page of data.pages) {
      const { statics, lives } = page;
      const maxLen = Math.max(statics.length, lives.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < statics.length) feed.push({ type: "static", data: statics[i] });
        if (i < lives.length) feed.push({ type: "live", data: lives[i] });
      }
    }
  }

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    feed,
    loading: isLoading,
    loadingMore: isFetchingNextPage,
    hasMore: !!hasNextPage,
    loadMore,
  };
}
