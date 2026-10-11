import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useMemo } from "react";
import type { LiveWallpaperDB } from "@/hooks/useLiveWallpapers";
import { bumpVisit, personalizeFeed, scheduleMarkSeen } from "@/lib/personalFeedShuffle";

const PER_CAT = 2;

const LIVE_CATEGORIES = [
  "jesus-christ", "quotes", "cross", "prayer", "church",
  "holy-spirit", "good-friday", "nature-creation",
  "aesthetic-christian",
];

export function useLiveFeed(categorySlug?: string) {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["live-feed-rr", categorySlug],
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam = 0 }) => {
      const PAGE_SIZE = 20;
      const offset = pageParam * PAGE_SIZE;

      if (categorySlug && categorySlug !== "all") {
        const { data: items } = await supabase
          .from("live_wallpapers")
          .select("*")
          .eq("category", categorySlug)
          .order("sort_order", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        return { items: (items || []) as LiveWallpaperDB[], page: pageParam };
      }

      const TOP_COUNT = 29;

      if (pageParam === 0) {
        const { data: items } = await supabase
          .from("live_wallpapers")
          .select("*")
          .order("sort_order", { ascending: true })
          .limit(TOP_COUNT);
        return { items: (items || []) as LiveWallpaperDB[], page: pageParam };
      }

      const { data: topRows } = await supabase
        .from("live_wallpapers")
        .select("id")
        .order("sort_order", { ascending: true })
        .limit(TOP_COUNT);
      const excludeIds = (topRows || []).map((r) => r.id);

      const catOffset = (pageParam - 1) * PER_CAT;
      const catFetches = LIVE_CATEGORIES.map((cat) =>
        supabase
          .from("live_wallpapers")
          .select("*")
          .eq("category", cat)
          .not("id", "in", `(${excludeIds.join(",")})`)
          .order("sort_order", { ascending: true })
          .range(catOffset, catOffset + PER_CAT - 1)
          .then(({ data }) => (data || []) as LiveWallpaperDB[])
      );
      const catResults = await Promise.all(catFetches);

      const items: LiveWallpaperDB[] = [];
      const maxLen = Math.max(...catResults.map((r) => r.length), 0);
      for (let i = 0; i < maxLen; i++) {
        for (const catItems of catResults) {
          if (i < catItems.length) {
            items.push(catItems[i]);
          }
        }
      }

      return { items, page: pageParam };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.items.length === 0) return undefined;
      return lastPage.page + 1;
    },
    initialPageParam: 0,
  });

  const rawFeed = data?.pages.flatMap((p) => p.items) ?? [];

  // Only personalise the GLOBAL live feed; in-category browsing keeps
  // the admin's sort_order untouched.
  const isGlobal = !categorySlug || categorySlug === "all";
  const feed = useMemo(
    () => (isGlobal ? personalizeFeed(rawFeed, "live") : rawFeed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGlobal, rawFeed.length, rawFeed[0]?.id],
  );

  // Bump visit counter once when this hook mounts in global mode.
  useEffect(() => {
    if (isGlobal) bumpVisit("live");
  }, [isGlobal]);

  // After the feed has been on screen for a few seconds, mark items as seen.
  useEffect(() => {
    if (!isGlobal || feed.length === 0) return;
    return scheduleMarkSeen("live", feed.map((it) => it.id));
  }, [isGlobal, feed]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { feed, loading: isLoading, loadingMore: isFetchingNextPage, hasMore: !!hasNextPage, loadMore };
}
