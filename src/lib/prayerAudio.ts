// Prayer audio resolver.
//
// Audio files live on R2 at a predictable path so we can ship the app NOW
// and generate ElevenLabs narrations LATER without any rebuild:
//
//   {R2_PUBLIC_BASE}/prayers/daily-prayer-{index}.mp3
//
// The client probes the URL once per prayer and caches the result in
// localStorage. Available → cached forever. Missing → re-probed after a
// short window so transient network blips on Android WebView don't hide
// the pill for hours.

import { Capacitor } from "@capacitor/core";

export const R2_PUBLIC_BASE = "https://pub-d9ad13d080884ba18697f09f5aa3b7e9.r2.dev";

export function getPrayerAudioUrl(index: number): string {
  return `${R2_PUBLIC_BASE}/prayers/daily-prayer-${index}.mp3`;
}

type CacheEntry = { available: boolean; ts: number };
// v4: switched probe to HEAD fetch + shorter miss TTL. Bumped key to
// invalidate stale `available:false` entries left by the old Audio probe
// that was unreliable inside Android WebView.
const CACHE_KEY = "jw_prayer_audio_manifest_v4";
const MISS_TTL_MS = 15 * 60 * 1000; // re-probe missing after 15 min
const PROBE_TIMEOUT_MS = 6000;

function readCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
  } catch {
    return {};
  }
}

function writeCache(c: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {}
}

async function probeWithFetch(url: string): Promise<boolean | null> {
  // Returns true (file exists), false (definite 404), or null (inconclusive — e.g. network error / CORS).
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    // HEAD first — cheapest. R2 supports it.
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (res.ok) return true;
    if (res.status === 404 || res.status === 403) return false;
    return null;
  } catch {
    clearTimeout(t);
    return null;
  }
}

/**
 * Returns the playable URL if the file exists on R2, otherwise null.
 * On native Android, if the probe is inconclusive we assume the file
 * exists (audio playback itself handles errors gracefully) — this
 * prevents the "Tap to listen" pill from disappearing because of a
 * single flaky WebView probe.
 */
export async function resolvePrayerAudio(index: number): Promise<string | null> {
  const url = getPrayerAudioUrl(index);
  const cache = readCache();
  const hit = cache[String(index)];
  const now = Date.now();
  if (hit) {
    if (hit.available) return url;
    if (now - hit.ts < MISS_TTL_MS) return null;
  }

  const result = await probeWithFetch(url);
  const isNative = Capacitor.isNativePlatform();

  let available: boolean;
  if (result === true) available = true;
  else if (result === false) available = false;
  else {
    // Inconclusive (network blip, CORS quirk in WebView, etc.).
    // On native: optimistically show the pill. The <audio> element will
    // gracefully no-op if the file is truly missing.
    // On web: be conservative to avoid a broken pill.
    available = isNative ? true : false;
  }

  // Only persist conclusive results so an inconclusive probe doesn't
  // poison the cache for the whole TTL window.
  if (result !== null) {
    cache[String(index)] = { available, ts: now };
    writeCache(cache);
  }
  return available ? url : null;
}
