import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useMemo } from "react";
import type { StaticWallpaperDB } from "@/hooks/useHomeFeed";
import { bumpVisit, personalizeFeed, scheduleMarkSeen } from "@/lib/personalFeedShuffle";

const PER_CAT = 2;

/**
 * Fetches static wallpapers round-robin style: 2 per category per page.
 * Optionally filters to a single category.
 */
export function useStaticFeed(categorySlug?: string) {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["static-feed-rr", categorySlug],
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam = 0 }) => {
      const PAGE_SIZE = 20;
      const offset = pageParam * PAGE_SIZE;

      if (categorySlug && categorySlug !== "all") {
        const { data: items } = await supabase
          .from("wallpapers")
          .select("id, title, image_url, is_premium, category_id, sort_order, categories!inner(slug)")
          .eq("categories.slug", categorySlug)
          .order("sort_order", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        const mapped = ((items || []) as any[]).map((w) => ({
          id: w.id, title: w.title, image_url: w.image_url,
          is_premium: w.is_premium, category_id: w.category_id, sort_order: w.sort_order,
        })) as StaticWallpaperDB[];

        return { items: mapped, page: pageParam };
      }

      // Global feed: simple sort_order ascending
      const { data: items } = await supabase
        .from("wallpapers")
        .select("id, title, image_url, is_premium, category_id, sort_order")
        .order("sort_order", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      return { items: (items || []) as StaticWallpaperDB[], page: pageParam };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.items.length === 0) return undefined;
      return lastPage.page + 1;
    },
    initialPageParam: 0,
  });

  const rawFeed = data?.pages.flatMap((p) => p.items) ?? [];

  const isGlobal = !categorySlug || categorySlug === "all";
  const feed = useMemo(
    () => (isGlobal ? personalizeFeed(rawFeed, "static") : rawFeed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGlobal, rawFeed.length, rawFeed[0]?.id],
  );

  useEffect(() => {
    if (isGlobal) bumpVisit("static");
  }, [isGlobal]);

  useEffect(() => {
    if (!isGlobal || feed.length === 0) return;
    return scheduleMarkSeen("static", feed.map((it) => it.id));
  }, [isGlobal, feed]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { feed, loading: isLoading, loadingMore: isFetchingNextPage, hasMore: !!hasNextPage, loadMore };
}
