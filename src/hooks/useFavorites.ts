import { useState, useCallback, useEffect } from "react";

const FAV_KEY = "cw_favorites";
const PREMIUM_KEY = "cw_premium_unlocked";
export const FREE_FAVORITES_LIMIT = 5;
export const FAVORITES_LIMIT_EVENT = "cw:favorites-limit-reached";

export type FavType = "live" | "static";

export interface FavItem {
  id: string;
  type: FavType;
  addedAt: number;
}

function loadFavs(): FavItem[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveFavs(items: FavItem[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(items));
}

function isPremiumNow(): boolean {
  return localStorage.getItem(PREMIUM_KEY) === "true";
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavItem[]>(loadFavs);

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites]
  );

  const toggleFavorite = useCallback((id: string, type: FavType) => {
    let blocked = false;
    let added = false;
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === id);
      if (exists) {
        const next = prev.filter((f) => f.id !== id);
        saveFavs(next);
        return next;
      }
      // Adding — enforce free-tier limit
      if (!isPremiumNow() && prev.length >= FREE_FAVORITES_LIMIT) {
        blocked = true;
        return prev;
      }
      const next = [...prev, { id, type, addedAt: Date.now() }];
      saveFavs(next);
      added = true;
      return next;
    });
    if (blocked) {
      window.dispatchEvent(new CustomEvent(FAVORITES_LIMIT_EVENT));
      import("@/services/analytics").then((a) => a.track("favorite_limit_reached", { id })).catch(() => {});
    }
    if (added) {
      // Analytics
      import("@/services/analytics").then((a) => a.track("favorite_added", { wallpaper_id: id, type })).catch(() => {});
      import("@/lib/paywallScheduler").then((m) => m.firePaywallTrigger("favorite_added")).catch(() => {});
      // Meta signal — engagement
      import("@/services/meta-events").then((m) => m.logAddToWishlist(id)).catch(() => {});
      // Happy moment — try to ask for a 5-star rating (session/cooldown gated).
      import("@/services/rating").then((m) => {
        setTimeout(() => m.maybeRequestRating(), 1200);
      }).catch(() => {});
    }

  }, []);

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    saveFavs([]);
  }, []);

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    clearFavorites,
    count: favorites.length,
  };
}
