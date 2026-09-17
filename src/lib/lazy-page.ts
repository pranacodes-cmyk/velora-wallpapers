import { lazy, type ComponentType } from "react";

/**
 * lazy() with stale-chunk recovery.
 *
 * After an OTA/web deploy the HTML in memory still points at the OLD hashed
 * chunk names. Navigating to a code-split route then throws
 * "Failed to fetch dynamically imported module" and the whole route dies.
 * Here we retry once (bypassing cache) and, if that fails too, hard-reload
 * so the app picks up the fresh manifest.
 */
export function lazyPage<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>
) {
  return lazy(() =>
    loader().catch(async () => {
      try {
        return await loader();
      } catch {
        const key = "chunk-reload-at";
        const last = Number(sessionStorage.getItem(key) || 0);
        // Only reload once per minute so we can never loop.
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
        // Keep Suspense pending while the reload happens.
        return new Promise<{ default: T }>(() => {});
      }
    })
  );
}

/** Fire-and-forget warm-up; a failed prefetch must never surface as an error. */
export function prefetch(loader: () => Promise<unknown>) {
  void loader().catch(() => {});
}
