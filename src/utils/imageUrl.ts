/**
 * Returns a wallpaper URL safe to download from native code (Android Java HTTP).
 *
 * Previously this rewrote Supabase image-proxy URLs to a hardcoded R2 public
 * domain. That domain was incorrect / not publicly accessible, which caused
 * "Download failed: Server returned HTTP 404" on real devices.
 *
 * The Supabase `image-proxy` edge function is deployed publicly (no JWT
 * required) and serves the underlying R2 bytes with proper content-type and
 * CORS headers, so the native HTTP client can fetch it directly without any
 * Supabase auth header. We simply pass the URL through.
 */
export function getDirectImageUrl(url: string): string {
  return url || "";
}
