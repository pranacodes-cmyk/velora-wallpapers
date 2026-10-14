import { useCallback, useEffect, useState } from "react";
import {
  CIRCLE_EVENT, CircleError, fetchOverview, getCachedOverview, getIdentity,
  type CircleIdentity, type CircleOverview,
} from "@/services/challengeCircle";

export function circleErrorKey(err: unknown): string {
  const code = err instanceof CircleError ? err.code : "generic";
  const known = ["circle_not_found", "circle_full", "too_many_circles", "bad_code", "network"];
  return `ch.circle.err.${known.includes(code) ? code : "generic"}`;
}

/** Circles overview with an offline cache; refreshes on mount and on resume. */
export function useCircles(autoRefresh = true) {
  const [identity, setIdentity] = useState<CircleIdentity | null>(() => getIdentity());
  const [overview, setOverview] = useState<CircleOverview | null>(() => getCachedOverview());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!getIdentity()) return;
    setLoading(true);
    try {
      setOverview(await fetchOverview());
      setError(null);
    } catch (err) {
      setError(circleErrorKey(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sync = () => { setIdentity(getIdentity()); setOverview(getCachedOverview()); };
    window.addEventListener(CIRCLE_EVENT, sync);
    return () => window.removeEventListener(CIRCLE_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    void refresh();
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [autoRefresh, refresh]);

  return { identity, overview, loading, error, refresh, setOverview };
}
