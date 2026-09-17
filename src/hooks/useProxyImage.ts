import { useState, useEffect, useRef } from "react";

/**
 * Global in-memory cache: URL → blob URL.
 * Survives component re-mounts so images don't re-fetch.
 * LRU eviction keeps memory bounded.
 */
const MAX_CACHE_SIZE = 48;
const blobCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();
const failedUrls = new Map<string, number>();
const FAILURE_COOLDOWN_MS = 30_000;

/** Evict oldest entries when cache exceeds limit */
function evictIfNeeded() {
  while (blobCache.size > MAX_CACHE_SIZE) {
    const oldest = blobCache.keys().next().value;
    if (!oldest) break;
    const url = blobCache.get(oldest);
    if (url) URL.revokeObjectURL(url);
    blobCache.delete(oldest);
  }
}

/**
 * Public R2/CDN image URLs should be used directly in <img> tags.
 * Fetching them with mode:cors fails when CDN doesn't send ACAO headers.
 */
function shouldUseDirectUrl(src: string) {
  return /^https?:\/\//i.test(src) && !src.includes("/functions/v1/image-proxy/");
}

/** Concurrency limiter — max 8 fetches at a time */
let activeCount = 0;
const MAX_CONCURRENT = 8;
const queue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(() => {
    activeCount++;
    resolve();
  }));
}

function releaseSlot() {
  activeCount--;
  if (queue.length > 0) {
    const next = queue.shift();
    if (next) next();
  }
}

/**
 * Fetches a cross-origin image via fetch() (CORS mode) and returns a
 * same-origin blob URL. This is only needed for function-proxied URLs.
 */
export function useProxyImage(src: string | undefined | null) {
  const initial = src
    ? shouldUseDirectUrl(src)
      ? src
      : (blobCache.get(src) ?? null)
    : null;

  const [blobUrl, setBlobUrl] = useState<string | null>(initial);
  const [loading, setLoading] = useState(!initial && !!src);
  const [error, setError] = useState(false);
  const srcRef = useRef(src);

  useEffect(() => {
    srcRef.current = src;

    if (!src) {
      setBlobUrl(null);
      setLoading(false);
      setError(false);
      return;
    }

    if (shouldUseDirectUrl(src)) {
      setBlobUrl(src);
      setLoading(false);
      setError(false);
      return;
    }

    const cached = blobCache.get(src);
    if (cached) {
      setBlobUrl(cached);
      setLoading(false);
      setError(false);
      return;
    }

    const failedAt = failedUrls.get(src);
    if (failedAt) {
      const stillCoolingDown = Date.now() - failedAt < FAILURE_COOLDOWN_MS;
      if (stillCoolingDown) {
        setError(true);
        setLoading(false);
        return;
      }
      failedUrls.delete(src);
    }

    setLoading(true);
    setError(false);

    let request = inflightRequests.get(src);
    if (!request) {
      request = startFetch(src);
      inflightRequests.set(src, request);
    }

    request
      .then((url) => {
        if (srcRef.current === src) {
          setBlobUrl(url);
          setLoading(false);
          setError(false);
        }
      })
      .catch(() => {
        if (srcRef.current === src) {
          setError(true);
          setLoading(false);
        }
      });
  }, [src]);

  return { blobUrl, loading, error };
}

/**
 * Acquire one slot, attempt fetch with retries, release slot exactly once.
 */
async function startFetch(src: string): Promise<string> {
  await acquireSlot();
  try {
    return await doFetch(src, 2);
  } finally {
    releaseSlot();
  }
}

async function doFetch(src: string, retries: number): Promise<string> {
  try {
    const resp = await fetch(src, { mode: "cors", cache: "force-cache" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    if (blob.size === 0) throw new Error("Empty blob");

    const url = URL.createObjectURL(blob);
    blobCache.set(src, url);
    evictIfNeeded();
    inflightRequests.delete(src);
    failedUrls.delete(src);
    return url;
  } catch (e) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 500));
      return doFetch(src, retries - 1);
    }

    inflightRequests.delete(src);
    failedUrls.set(src, Date.now());
    throw e;
  }
}

/**
 * Preload multiple images into the blob cache without rendering.
 */
export function preloadImages(urls: string[]) {
  urls.forEach((url) => {
    if (shouldUseDirectUrl(url)) return;

    if (!blobCache.has(url) && !inflightRequests.has(url)) {
      const req = startFetch(url);
      inflightRequests.set(url, req);
    }
  });
}

/** Manual cache reset hook for debug/settings actions. */
export function clearProxyImageCache() {
  for (const objectUrl of blobCache.values()) {
    URL.revokeObjectURL(objectUrl);
  }
  blobCache.clear();
  inflightRequests.clear();
  failedUrls.clear();
}