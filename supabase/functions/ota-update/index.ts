/**
 * Self-hosted OTA (live-update) endpoint for @capgo/capacitor-updater.
 *
 * The native plugin POSTs device/app info here on every app start (and on
 * resume) and expects EITHER:
 *   { version, url, checksum }   -> download this bundle
 *   { message: "..." }           -> nothing to do
 *
 * Public by design (no JWT): the plugin calls it before any user session
 * exists. It only ever reads from the ota_bundles table.
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

type Info = {
  platform?: string;
  device_id?: string;
  app_id?: string;
  version_build?: string;
  version_name?: string;
  version_code?: string;
  defaultChannel?: string;
  is_emulator?: boolean;
  is_prod?: boolean;
};

/** Numeric semver compare. Returns >0 when a is newer than b. */
function cmpVersion(a: string, b: string): number {
  const pa = String(a).replace(/^v/, '').split(/[.\-+]/);
  const pb = String(b).replace(/^v/, '').split(/[.\-+]/);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i] ?? '0', 10);
    const nb = parseInt(pb[i] ?? '0', 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      const sa = pa[i] ?? '';
      const sb = pb[i] ?? '';
      if (sa !== sb) return sa > sb ? 1 : -1;
      continue;
    }
    if (na !== nb) return na - nb;
  }
  return 0;
}

/** Stable 0-99 bucket per device so a partial rollout is sticky. */
function bucketOf(deviceId: string): number {
  let h = 2166136261;
  for (let i = 0; i < deviceId.length; i++) {
    h ^= deviceId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 100;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let info: Info = {};
  try {
    info = (await req.json()) as Info;
  } catch {
    return json({ message: 'Invalid body', error: 'invalid_body' }, 400);
  }

  const platform = info.platform === 'ios' ? 'ios' : 'android';
  const channel =
    typeof info.defaultChannel === 'string' && info.defaultChannel.trim()
      ? info.defaultChannel.trim()
      : 'production';
  // version_name = the JS bundle currently running. On a fresh install some
  // devices report "builtin", others report the native versionCode (e.g.
  // "29785304") which would compare as newer than any x.y.z bundle. Treat
  // anything that isn't a proper semver as "no bundle yet".
  const current = (info.version_name ?? '').trim();
  const currentVersion = /^\d+\.\d+\.\d+$/.test(current) ? current : '0.0.0';
  const nativeBuild = (info.version_build ?? '').trim();
  const deviceId = (info.device_id ?? '').trim() || 'unknown';

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ message: 'Update server not configured', error: 'misconfigured' }, 200);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('ota_bundles')
    .select('version, url, checksum, rollout, native_version, min_native_version, urgent')
    .eq('platform', platform)
    .eq('channel', channel)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return json({ message: 'Update lookup failed', error: 'server_error' }, 200);
  }

  // NO-DOWNGRADE BASELINE.
  // OTA bundle versions live on the SAME number line as the native
  // versionName (1.0.NNNN), so the JS shipped inside build 1.0.1150 is by
  // definition "1.0.1150". A bundle is only newer JS if it is above BOTH the
  // running bundle and the native build. Without this, a fresh install
  // (version_name = "builtin" -> 0.0.0) would happily download an older
  // bundle and silently downgrade the app's JS against its native layer.
  const baseline =
    nativeBuild && /^\d+\.\d+\.\d+$/.test(nativeBuild) && cmpVersion(nativeBuild, currentVersion) > 0
      ? nativeBuild
      : currentVersion;

  const candidate = (data ?? []).find((b) => {
    if (cmpVersion(b.version, baseline) <= 0) return false;
    // Hard pin: bundle only valid for one native versionName.
    if (b.native_version && nativeBuild && b.native_version !== nativeBuild) return false;
    // Floor: bundle needs at least this native versionName.
    if (b.min_native_version && nativeBuild && cmpVersion(nativeBuild, b.min_native_version) < 0) {
      return false;
    }
    const rollout = typeof b.rollout === 'number' ? b.rollout : 100;
    if (rollout >= 100) return true;
    if (rollout <= 0) return false;
    return bucketOf(deviceId) < rollout;
  });

  if (!candidate) {
    return json({ message: 'No update available', version: baseline });
  }

  return json({
    version: candidate.version,
    url: candidate.url,
    checksum: candidate.checksum,
    // Extra field: the capgo plugin ignores it, but our own boot check reads it
    // and applies an urgent bundle immediately (during splash) instead of
    // waiting for the next cold start.
    urgent: candidate.urgent === true,
  });
});
