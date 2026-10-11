/** Absolute origin used when the app runs inside Capacitor (localhost / capacitor://)
 *  or when window.location isn't available (SSR, native downloads). */
export const PUBLIC_ORIGIN = "https://velora-wallpapers.lovable.app";

/** Build an absolute URL from a Lovable asset pointer.
 *  In Capacitor WebViews the origin is https://localhost, which cannot serve
 *  /__l5e/ paths — force the public CDN-backed origin in that case. */
export function toAbsoluteAssetUrl(assetPath: string): string {
  if (!assetPath) return "";
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
    return assetPath;
  }
  const origin =
    typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null"
      ? window.location.origin
      : "";
  const isLocalOrNative =
    !origin ||
    /^https?:\/\/localhost(?::\d+)?$/i.test(origin) ||
    origin.startsWith("capacitor://") ||
    origin.startsWith("file://") ||
    origin.startsWith("ionic://");
  const base = isLocalOrNative ? PUBLIC_ORIGIN : origin;
  try {
    return new URL(assetPath, base).href;
  } catch {
    return PUBLIC_ORIGIN + assetPath;
  }
}
