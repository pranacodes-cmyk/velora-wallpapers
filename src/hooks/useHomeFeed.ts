import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";
import type { LiveWallpaperDB } from "@/hooks/useLiveWallpapers";
import { useIsOnboardingActive } from "@/contexts/OnboardingContext";

export interface StaticWallpaperDB {
  id: string;
  title: string;
  image_url: string;
  is_premium: boolean;
  category_id: string | null;
  sort_order: number;
}

export type FeedItem =
  | { type: "static"; data: StaticWallpaperDB }
  | { type: "live"; data: LiveWallpaperDB };

const PER_CATEGORY = 2;
const LIVE_PAGE = 8;

/**
 * Fetches statics by picking top items from EACH category (round-robin diversity),
 * then interleaves with live wallpapers (1 static : 1 live).
 */
export function useHomeFeed() {
  const isOnboardingActive = useIsOnboardingActive();
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["home-feed-v2"],
    enabled: !isOnboardingActive,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam = 0 }) => {
      // Step 1: Get all category IDs
      const { data: cats } = await supabase
        .from("categories")
        .select("id, slug")
        .order("sort_order", { ascending: true });

      const categoryIds = (cats || []).map((c) => c.id);

      // Step 2: Fetch PER_CATEGORY items from each category, offset by page
      const offset = pageParam * PER_CATEGORY;
      const categoryFetches = categoryIds.map((catId) =>
        supabase
          .from("wallpapers")
          .select("id, title, image_url, is_premium, category_id, sort_order")
          .eq("category_id", catId)
          .order("sort_order", { ascending: true })
          .range(offset, offset + PER_CATEGORY - 1)
          .then(({ data }) => (data || []) as StaticWallpaperDB[])
      );

      const categoryResults = await Promise.all(categoryFetches);

      // Step 3: Round-robin across categories for max diversity
      const diversified: StaticWallpaperDB[] = [];
      const maxLen = Math.max(...categoryResults.map((r) => r.length), 0);
      for (let i = 0; i < maxLen; i++) {
        for (const catItems of categoryResults) {
          if (i < catItems.length) {
            diversified.push(catItems[i]);
          }
        }
      }

      // Step 4: Fetch live wallpapers
      let lives: LiveWallpaperDB[] = [];
      const liveOffset = pageParam * LIVE_PAGE;
      const { data: pageLives } = await supabase
        .from("live_wallpapers")
        .select("*")
        .order("sort_order", { ascending: true })
        .range(liveOffset, liveOffset + LIVE_PAGE - 1);
      lives = (pageLives || []) as LiveWallpaperDB[];

      return { statics: diversified, lives, page: pageParam };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.statics.length === 0 && lastPage.lives.length === 0) {
        return undefined;
      }
      return lastPage.page + 1;
    },
    initialPageParam: 0,
  });

  // Interleave: strict 1 static : 1 live alternation
  const feed: FeedItem[] = [];
  if (data) {
    for (const page of data.pages) {
      const { statics, lives } = page;
      const maxLen = Math.max(statics.length, lives.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < statics.length) {
          feed.push({ type: "static", data: statics[i] });
        }
        if (i < lives.length) {
          feed.push({ type: "live", data: lives[i] });
        }
      }
    }
  }

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    feed,
    loading: isLoading,
    loadingMore: isFetchingNextPage,
    hasMore: !!hasNextPage,
    loadMore,
  };
}