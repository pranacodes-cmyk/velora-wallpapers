import type { QueryClient } from "@tanstack/react-query";

const WALLPAPER_QUERY_PREFIXES = new Set([
  "home-feed-v2",
  "explore-feed",
  "live-wallpapers-db",
  "live-feed-rr",
  "static-feed-rr",
  "category-wallpapers",
]);

export function invalidateWallpaperQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === "string" && WALLPAPER_QUERY_PREFIXES.has(key);
    },
  });
}