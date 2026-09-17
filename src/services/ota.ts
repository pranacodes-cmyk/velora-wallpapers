/**
 * OTA (live update) boot service — self-hosted @capgo/capacitor-updater.
 *
 * How it works end to end:
 *  1. On app start the native plugin POSTs device info to our `ota-update`
 *     edge function and, if a newer bundle exists for this native build,
 *     downloads the zip in the background (never blocks the UI).
 *  2. The bundle is applied on the NEXT cold start (directUpdate: false).
 *  3. This module MUST call notifyAppReady() once the web app has booted.
 *     If it doesn't within `appReadyTimeout`, the native layer treats the
 *     bundle as broken and automatically rolls back to the previous one —
 *     that's our safety net against shipping a white screen.
 *
 * Nothing here runs on web/preview; it is a no-op outside the native app.
 */
import { Capacitor } from '@capacitor/core';

let initialized = false;
let currentBundleVersion: string | null = null;

/** Version of the JS bundle actually running ("builtin" = shipped with the APK). */
export function getOtaVersion(): string | null {
  return currentBundleVersion;
}

/** Compare native versionName with the running JS bundle and report it. */
async function reportVersionStatus(): Promise<void> {
  try {
    const [{ App }, analytics] = await Promise.all([
      import('@capacitor/app'),
      import('./analytics'),
    ]);
    const info = await App.getInfo().catch(() => null);
    const nativeVersion = info?.version ?? null;
    const nativeBuild = info?.build ?? null;
    const ota = currentBundleVersion;

    const semver = (v: string | null) => (v && /^\d+\.\d+\.\d+$/.test(v) ? v : null);
    const cmp = (a: string, b: string) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
      return 0;
    };

    // 'builtin'  = running exactly the JS that shipped inside this native build
    // 'ota'       = running a newer JS bundle delivered over the air
    // 'mismatch'  = running JS OLDER than the native build (a real problem)
    let status: 'builtin' | 'ota' | 'mismatch' | 'unknown' = 'unknown';
    const nv = semver(nativeVersion);
    const ov = semver(ota);
    if (!nv) status = 'unknown';
    else if (!ov) status = 'builtin';
    else {
      const d = cmp(ov, nv);
      status = d > 0 ? 'ota' : d === 0 ? 'builtin' : 'mismatch';
    }

    if (status === 'mismatch') {
      console.warn('[ota] version mismatch — bundle', ota, 'is not newer than native', nativeVersion);
    }

    analytics.setVersionContext({
      native_version: nativeVersion,
      native_build: nativeBuild,
      ota_version: ota,
      version_status: status,
    });
  } catch {
    // Never let reporting break OTA or app start.
  }
}

const UPDATE_URL = 'https://jbwhlogvldhsnxtpxwih.supabase.co/functions/v1/ota-update';

/**
 * URGENT bundles: applied during splash on this very launch.
 *
 * Normal bundles download in the background and land on the next cold start.
 * When a release is published with `urgent: true` we instead download it right
 * away and call set() while the splash screen is still up, so a critical fix
 * reaches users in one launch. Everything is wrapped in try/catch and bounded
 * by a timeout — on any failure we silently fall back to the normal flow.
 */
async function applyUrgentBundleIfAny(): Promise<boolean> {
  try {
    const [{ App }, { CapacitorUpdater }] = await Promise.all([
      import('@capacitor/app'),
      import('@capgo/capacitor-updater'),
    ]);
    const info = await App.getInfo().catch(() => null);
    // Stable per-install id so partial rollouts stay sticky for urgent checks too.
    let deviceId = 'unknown';
    try {
      deviceId = localStorage.getItem('cw_ota_device_id') ?? '';
      if (!deviceId) {
        deviceId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('cw_ota_device_id', deviceId);
      }
    } catch {}

    const ctrl = new AbortController();
    const timer = globalThis.setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(UPDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        platform: 'android',
        channel: 'production',
        defaultChannel: 'production',
        device_id: deviceId,
        app_id: info?.id ?? '',
        version_name: currentBundleVersion ?? 'builtin',
        version_build: info?.version ?? '',
        version_code: info?.build ?? '',
      }),
    }).finally(() => globalThis.clearTimeout(timer));

    const data = (await res.json().catch(() => null)) as
      | { version?: string; url?: string; checksum?: string; urgent?: boolean }
      | null;
    if (!data?.urgent || !data.version || !data.url) return false;

    console.log('[ota] urgent bundle', data.version, '— applying now');
    const bundle = await CapacitorUpdater.download({
      url: data.url,
      version: data.version,
      checksum: data.checksum,
    });
    await CapacitorUpdater.set(bundle);
    return true;
  } catch {
    return false;
  }
}

export async function initOta(): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

    // Tell native the bundle booted fine. Must happen every launch.
    const ready = await CapacitorUpdater.notifyAppReady().catch(() => null);
    currentBundleVersion = ready?.bundle?.version ?? null;

    // Lightweight observability so a bad rollout is visible in logs.
    CapacitorUpdater.addListener('updateAvailable', (info) => {
      console.log('[ota] update available', info?.bundle?.version);
    });
    CapacitorUpdater.addListener('downloadComplete', (info) => {
      console.log('[ota] downloaded, applies on next launch', info?.bundle?.version);
    });
    CapacitorUpdater.addListener('updateFailed', (info) => {
      console.warn('[ota] update failed, rolling back', info?.bundle?.version);
    });
    CapacitorUpdater.addListener('majorAvailable', (info) => {
      console.log('[ota] major bundle available', info?.version);
    });

    // Release-health check: report native build vs running JS bundle to
    // analytics so any version mismatch shows up as data, not guesswork.
    void reportVersionStatus();

    // Urgent bundle? Apply it right now (splash is still up) instead of
    // waiting for the next cold start. Normal releases are unaffected.
    void applyUrgentBundleIfAny();
  } catch (e) {
    // Never let OTA plumbing break app start.
    console.warn('[ota] init skipped', e);
  }
}

/**
 * Manual update check for testing / "Check for updates" in Settings.
 * Unlike the background flow, this downloads AND applies immediately
 * (reloads the webview) so a tester can verify a bundle in seconds.
 */
export async function checkOtaUpdateNow(): Promise<
  | { status: 'not-native' }
  | { status: 'up-to-date'; current: string | null }
  | { status: 'applying'; version: string }
  | { status: 'error'; message: string }
> {
  if (!Capacitor.isNativePlatform()) return { status: 'not-native' };
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const latest = await CapacitorUpdater.getLatest();
    const version = (latest as { version?: string })?.version;
    if (!version || (latest as { message?: string })?.message) {
      return { status: 'up-to-date', current: currentBundleVersion };
    }
    const url = (latest as { url?: string })?.url;
    if (!url) return { status: 'up-to-date', current: currentBundleVersion };
    const bundle = await CapacitorUpdater.download({ url, version });
    await CapacitorUpdater.set(bundle);
    return { status: 'applying', version };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
