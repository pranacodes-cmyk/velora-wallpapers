/**
 * Google Play Console diagnostics.
 *
 * Uses a service-account JSON (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) to talk to:
 *  - Play Developer Reporting API  (ANR / crash vitals vs bad-behaviour thresholds)
 *  - Android Publisher API         (subscriptions catalog, voided purchases,
 *                                   individual purchase state lookups)
 *
 * Admin-only: caller must send the service-role key as a bearer token, or a
 * signed-in user JWT belonging to a user with the `admin` role.
 *
 * POST body: { action, ...params }
 *   action: "permissions" | "vitals" | "subscriptions" | "voided" | "purchase" | "diagnose"
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { LISTINGS, validateListings } from './listings.ts';
import { STORE_ASSETS } from './storeAssets.ts';

const PACKAGE_NAME = Deno.env.get('PLAY_PACKAGE_NAME') ?? 'com.jesuswallpaperbible.app';
const SA_JSON = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SCOPES = [
  'https://www.googleapis.com/auth/androidpublisher',
  'https://www.googleapis.com/auth/playdeveloperreporting',
].join(' ');

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() / 1000 + 60) return cachedToken.token;
  if (!SA_JSON) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not configured');

  const sa = JSON.parse(SA_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = new TextEncoder();
  const signingInput = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(claims)))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(String(sa.private_key).replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput)));
  const assertion = `${signingInput}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${JSON.stringify(json)}`);
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.token;
}

async function gapi(url: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

function ymd(d: Date) {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

async function vitals(days: number) {
  // Reporting API data lags several days and Play rejects any end date past the
  // published freshness. Read the DAILY freshness first and clamp to it.
  async function freshEnd(name: string): Promise<Date> {
    const fallback = new Date(Date.now() - 4 * 86400000);
    try {
      const r = await gapi(
        `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${PACKAGE_NAME}/${name}`,
      );
      const list = (r.body as any)?.freshnessInfo?.freshnesses ?? [];
      const daily = list.find((f: any) => f.aggregationPeriod === 'DAILY') ?? list[0];
      const t = daily?.latestEndTime;
      if (t?.year) {
        // latestEndTime is exclusive-ish; step back one day to stay inside range.
        return new Date(Date.UTC(t.year, (t.month ?? 1) - 1, (t.day ?? 1)) - 86400000);
      }
    } catch { /* ignore */ }
    return fallback;
  }

  async function metricSet(name: string, metrics: string[]) {
    const end = await freshEnd(name);
    const start = new Date(end.getTime() - days * 86400000);
    const query = await gapi(
      `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${PACKAGE_NAME}/${name}:query`,
      {
        method: 'POST',
        body: JSON.stringify({
          timelineSpec: {
            aggregationPeriod: 'DAILY',
            startTime: { ...ymd(start), timeZone: { id: 'America/Los_Angeles' } },
            endTime: { ...ymd(end), timeZone: { id: 'America/Los_Angeles' } },
          },
          metrics,
          pageSize: 200,
        }),
      },
    );
    return { window: { start: ymd(start), end: ymd(end) }, query: query.body, ok: query.ok, status: query.status };
  }

  const [anr, crash] = await Promise.all([
    metricSet('anrRateMetricSet', ['anrRate', 'userPerceivedAnrRate', 'distinctUsers']),
    metricSet('crashRateMetricSet', ['crashRate', 'userPerceivedCrashRate', 'distinctUsers']),
  ]);
  return { anr, crash, thresholds: { badBehaviourUserPerceivedAnrRate: 0.008, badBehaviourUserPerceivedCrashRate: 0.0109 } };
}

async function subscriptions() {
  return (await gapi(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/subscriptions?pageSize=50`,
  )).body;
}

/**
 * Lists every subscription offer (free trial / intro price) per base plan.
 * Offers are a separate resource from the subscription, so the `subscriptions`
 * action alone cannot tell us whether a free trial actually exists on Play.
 */
async function offers() {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
  const subs = (await gapi(`${base}/subscriptions?pageSize=50`)).body as {
    subscriptions?: Array<{ productId?: string; basePlans?: Array<{ basePlanId?: string }> }>;
  };
  const out: Array<Record<string, unknown>> = [];
  for (const s of subs?.subscriptions ?? []) {
    for (const bp of s.basePlans ?? []) {
      const r = await gapi(
        `${base}/subscriptions/${s.productId}/basePlans/${bp.basePlanId}/offers?pageSize=50`,
      );
      const list = (r.body as { subscriptionOffers?: Array<Record<string, unknown>> })?.subscriptionOffers ?? [];
      out.push({
        productId: s.productId,
        basePlanId: bp.basePlanId,
        ok: r.ok,
        offerCount: list.length,
        offers: list.map((o) => ({
          offerId: o.offerId,
          state: o.state,
          phases: (o.phases as Array<Record<string, unknown>> | undefined)?.map((p) => ({
            duration: p.duration,
            recurrenceCount: p.recurrenceCount,
            free: Boolean(p.free),
            hasPrice: Boolean(p.regionalConfigs),
          })),
        })),
        raw: list,
        error: r.ok ? null : r.body,
      });
    }
  }
  return { basePlans: out };
}

async function voided(days: number) {
  const startTime = Date.now() - days * 86400000;
  return (await gapi(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/voidedpurchases?startTime=${startTime}&type=1&maxResults=1000`,
  )).body;
}

async function purchase(token: string) {
  return (await gapi(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`,
  )).body;
}

/**
 * Reads the LIVE store listing text (app name, short + full description) for
 * every localisation, plus app details (default language, contact info).
 * Uses a throwaway edit which we never commit, then deletes it.
 */
async function listing() {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
  const edit = await gapi(`${base}/edits`, { method: 'POST', body: '{}' });
  if (!edit.ok) return { ok: false, status: edit.status, error: edit.body };
  const editId = (edit.body as { id?: string })?.id;
  if (!editId) return { ok: false, error: 'no edit id', raw: edit.body };

  try {
    const [details, listings] = await Promise.all([
      gapi(`${base}/edits/${editId}/details`),
      gapi(`${base}/edits/${editId}/listings`),
    ]);
    return {
      ok: true,
      details: details.body,
      listings: listings.body,
    };
  } finally {
    await gapi(`${base}/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
  }
}

/**
 * Push the keyword-optimised store listings (all languages) to Play.
 *
 * Text-only: title, short description, full description. Never touches the
 * icon, screenshots, feature graphic, APKs/AABs or release tracks.
 * With dryRun=true it writes to a draft edit, reads it back, then discards it.
 */
async function pushListing(dryRun: boolean, only?: string[]) {
  const violations = validateListings(LISTINGS);
  if (violations.length) return { ok: false, error: 'listing validation failed', violations };

  const targets = only?.length
    ? LISTINGS.filter((l) => only.includes(l.language))
    : LISTINGS;
  if (!targets.length) return { ok: false, error: 'no matching languages', only };

  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
  const edit = await gapi(`${base}/edits`, { method: 'POST', body: '{}' });
  if (!edit.ok) return { ok: false, stage: 'createEdit', status: edit.status, error: edit.body };
  const editId = (edit.body as { id?: string })?.id;
  if (!editId) return { ok: false, stage: 'createEdit', error: 'no edit id', raw: edit.body };

  const applied: Record<string, unknown> = {};
  let failed: unknown = null;

  for (const l of targets) {
    const res = await gapi(`${base}/edits/${editId}/listings/${l.language}`, {
      method: 'PUT',
      body: JSON.stringify({
        language: l.language,
        title: l.title,
        shortDescription: l.shortDescription,
        fullDescription: l.fullDescription,
      }),
    });
    if (!res.ok) {
      failed = { language: l.language, status: res.status, error: res.body };
      break;
    }
    applied[l.language] = {
      title: l.title,
      shortLen: [...l.shortDescription].length,
      fullLen: [...l.fullDescription].length,
    };
  }

  if (failed) {
    await gapi(`${base}/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
    return { ok: false, stage: 'updateListing', failed, appliedBeforeFailure: applied };
  }

  const readback = await gapi(`${base}/edits/${editId}/listings`);

  if (dryRun) {
    await gapi(`${base}/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
    return { ok: true, dryRun: true, committed: false, applied, readback: readback.body };
  }

  const commit = await gapi(`${base}/edits/${editId}:commit`, { method: 'POST' });
  if (!commit.ok) {
    await gapi(`${base}/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
    return { ok: false, stage: 'commit', status: commit.status, error: commit.body, applied };
  }

  return { ok: true, dryRun: false, committed: true, editId, applied, commit: commit.body };
}

/**
 * Read the graphic assets attached to each localisation (read-only).
 * imageTypes covered: icon, featureGraphic, phoneScreenshots, tvBanner,
 * sevenInchScreenshots, tenInchScreenshots.
 */
const IMAGE_TYPES = [
  'icon',
  'featureGraphic',
  'phoneScreenshots',
  'sevenInchScreenshots',
  'tenInchScreenshots',
] as const;

async function images(languages?: string[]) {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
  const edit = await gapi(`${base}/edits`, { method: 'POST', body: '{}' });
  if (!edit.ok) return { ok: false, stage: 'createEdit', status: edit.status, error: edit.body };
  const editId = (edit.body as { id?: string })?.id;
  if (!editId) return { ok: false, error: 'no edit id', raw: edit.body };

  try {
    const langs = languages?.length ? languages : LISTINGS.map((l) => l.language);
    const out: Record<string, Record<string, unknown>> = {};
    for (const lang of langs) {
      out[lang] = {};
      for (const t of IMAGE_TYPES) {
        const res = await gapi(`${base}/edits/${editId}/listings/${lang}/${t}`);
        out[lang][t] = res.ok ? res.body : { error: res.body, status: res.status };
      }
    }
    return { ok: true, images: out };
  } finally {
    await gapi(`${base}/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
  }
}

/** Create a long-lived draft edit the caller can upload images into. */
async function openEdit() {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
  const edit = await gapi(`${base}/edits`, { method: 'POST', body: '{}' });
  return { ok: edit.ok, status: edit.status, editId: (edit.body as { id?: string })?.id ?? null, raw: edit.body };
}

/** Delete every image of a type for a language inside an open edit. */
async function deleteImages(editId: string, language: string, imageType: string) {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
  const res = await gapi(`${base}/edits/${editId}/listings/${language}/${imageType}`, { method: 'DELETE' });
  return { ok: res.ok, status: res.status, body: res.body };
}

/** Upload one PNG/JPEG (base64) as a listing graphic inside an open edit. */
async function uploadImage(
  editId: string,
  language: string,
  imageType: string,
  base64: string,
  contentType = 'image/jpeg',
) {
  const bin = atob(base64.replace(/^data:[^,]+,/, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const token = await getAccessToken();
  const url =
    `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE_NAME}` +
    `/edits/${editId}/listings/${language}/${imageType}?uploadType=media`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: bytes,
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, bytes: bytes.length, body };
}

/** Commit (or discard) an open edit. */
async function finishEdit(editId: string, commit: boolean) {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
  if (!commit) {
    const del = await gapi(`${base}/edits/${editId}`, { method: 'DELETE' });
    return { ok: del.ok, committed: false, status: del.status, body: del.body };
  }
  const res = await gapi(`${base}/edits/${editId}:commit`, { method: 'POST' });
  return { ok: res.ok, committed: res.ok, status: res.status, body: res.body };
}



/**
 * Replace the feature graphic + phone screenshots for each localisation from
 * the CDN manifest. Never touches the app icon or release tracks.
 */
async function pushAssets(dryRun: boolean, only?: string[]) {
  const langs = Object.keys(STORE_ASSETS).filter((l) => !only?.length || only.includes(l));
  if (!langs.length) return { ok: false, error: 'no matching languages', only };

  const opened = await openEdit();
  if (!opened.ok || !opened.editId) return { ok: false, stage: 'createEdit', raw: opened };
  const editId = opened.editId;
  const report: Record<string, unknown> = {};

  try {
    for (const lang of langs) {
      const spec = STORE_ASSETS[lang];
      const done: string[] = [];
      for (const type of ['featureGraphic', 'phoneScreenshots'] as const) {
        const del = await deleteImages(editId, lang, type);
        if (!del.ok) return { ok: false, stage: 'deleteImages', lang, type, raw: del, report };
        const urls = type === 'featureGraphic' ? [spec.featureGraphic] : spec.phoneScreenshots;
        for (const url of urls) {
          const res = await fetch(url);
          if (!res.ok) return { ok: false, stage: 'fetchAsset', url, status: res.status, report };
          const buf = new Uint8Array(await res.arrayBuffer());
          let b64 = '';
          for (let i = 0; i < buf.length; i += 8192) b64 += String.fromCharCode(...buf.subarray(i, i + 8192));
          const up = await uploadImage(editId, lang, type, btoa(b64), 'image/jpeg');
          if (!up.ok) return { ok: false, stage: 'uploadImage', lang, type, url, raw: up, report };
          done.push(`${type}:${url.split('/').pop()}`);
        }
      }
      report[lang] = done;
    }
    const fin = await finishEdit(editId, !dryRun);
    return { ok: fin.ok, dryRun, committed: fin.committed, editId, report, finish: fin.body };
  } catch (e) {
    await finishEdit(editId, false).catch(() => {});
    return { ok: false, stage: 'exception', error: String(e), report };
  }
}

async function anrIssues(days: number) {
  const end = new Date(Date.now() - 2 * 86400000);
  const start = new Date(end.getTime() - days * 86400000);
  const s = ymd(start), e = ymd(end);
  const filter = `errorIssueType = ANR`;
  const res = await gapi(
    `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${PACKAGE_NAME}/errorIssues:search` +
      `?filter=${encodeURIComponent(filter)}&pageSize=20&orderBy=${encodeURIComponent('errorReportCount desc')}` +
      `&interval.startTime.year=${s.year}&interval.startTime.month=${s.month}&interval.startTime.day=${s.day}` +
      `&interval.endTime.year=${e.year}&interval.endTime.month=${e.month}&interval.endTime.day=${e.day}`,
  );
  return { ok: res.ok, status: res.status, body: res.body };
}


/** Latest DAILY freshness date for a metric set (Reporting API lags days). */
async function freshnessEnd(metricSet: string): Promise<Date> {
  const res = await gapi(`https://playdeveloperreporting.googleapis.com/v1beta1/apps/${PACKAGE_NAME}/${metricSet}`);
  const list = (res.body as any)?.freshnessInfo?.freshnesses ?? [];
  const daily = list.find((f: any) => f.aggregationPeriod === 'DAILY') ?? list[0];
  const t = daily?.latestEndTime;
  if (!t) return new Date(Date.now() - 5 * 86400000);
  return new Date(Date.UTC(t.year, (t.month ?? 1) - 1, t.day ?? 1));
}

/** Generic freshness-clamped timeline query, optionally split by dimensions. */
async function metricQuery(
  metricSet: string,
  metrics: string[],
  days: number,
  dimensions: string[] = [],
) {
  const end = await freshnessEnd(metricSet);
  const start = new Date(end.getTime() - days * 86400000);
  const res = await gapi(
    `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${PACKAGE_NAME}/${metricSet}:query`,
    {
      method: 'POST',
      body: JSON.stringify({
        timelineSpec: {
          aggregationPeriod: 'DAILY',
          startTime: { ...ymd(start), timeZone: { id: 'America/Los_Angeles' } },
          endTime: { ...ymd(end), timeZone: { id: 'America/Los_Angeles' } },
        },
        dimensions,
        metrics,
        pageSize: 1000,
      }),
    },
  );
  return { ok: res.ok, status: res.status, window: { start: ymd(start), end: ymd(end) }, body: res.body };
}

/** Production/internal track releases so we know which versionCode is live. */
async function tracks() {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`;
  const edit = await gapi(`${base}/edits`, { method: 'POST', body: '{}' });
  const editId = (edit.body as { id?: string })?.id;
  if (!editId) return { ok: false, raw: edit.body };
  try {
    const res = await gapi(`${base}/edits/${editId}/tracks`);
    return { ok: res.ok, status: res.status, body: res.body };
  } finally {
    await gapi(`${base}/edits/${editId}`, { method: 'DELETE' }).catch(() => {});
  }
}

/** One-shot vitals audit: ANR/crash per version, startup, rendering, wakeups. */
async function audit(days: number) {
  const [anrTotal, anrByVersion, crashTotal, slowStart, rendering] = await Promise.all([
    metricQuery('anrRateMetricSet', ['anrRate', 'userPerceivedAnrRate', 'distinctUsers'], days),
    metricQuery('anrRateMetricSet', ['userPerceivedAnrRate', 'distinctUsers'], days, ['versionCode']),
    metricQuery('crashRateMetricSet', ['crashRate', 'userPerceivedCrashRate', 'distinctUsers'], days),
    metricQuery('slowStartRateMetricSet', ['slowStartRate', 'distinctUsers'], days, ['startType']),
    metricQuery('slowRenderingRateMetricSet', ['slowRenderingRate20Fps', 'slowRenderingRate30Fps', 'distinctUsers'], days),
  ]);
  return { anrTotal, anrByVersion, crashTotal, slowStart, rendering };
}

async function permissions() {

  // Cheap probes: each tells us whether the service account has that scope/role.
  const [pub, reporting] = await Promise.all([
    gapi(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/subscriptions?pageSize=1`),
    gapi(`https://playdeveloperreporting.googleapis.com/v1beta1/apps/${PACKAGE_NAME}/anrRateMetricSet`),
  ]);
  let clientEmail = null;
  try { clientEmail = JSON.parse(SA_JSON).client_email ?? null; } catch { /* ignore */ }
  return {
    packageName: PACKAGE_NAME,
    serviceAccount: clientEmail,
    androidPublisher: { ok: pub.ok, status: pub.status, error: pub.ok ? null : pub.body },
    playDeveloperReporting: { ok: reporting.ok, status: reporting.status, error: reporting.ok ? null : reporting.body },
  };
}

async function isAuthorized(req: Request): Promise<boolean> {
  const provided = req.headers.get('x-diag-key') ?? '';
  for (const name of ['PLAY_DIAG_KEY', 'PLAY_DIAG_KEY_2', 'PLAY_DIAG_KEY_3', 'PLAY_DIAG_KEY_4', 'PLAY_DIAG_KEY_5', 'PLAY_DIAG_KEY_6', 'PLAY_DIAG_KEY_7', 'PLAY_DIAG_KEY_8', 'PLAY_DIAG_KEY_9', 'PLAY_DIAG_KEY_10', 'PLAY_DIAG_KEY_11', 'PLAY_DIAG_KEY_12', 'PLAY_DIAG_KEY_13', 'PLAY_DIAG_KEY_14', 'PLAY_DIAG_KEY_15', 'PLAY_DIAG_KEY_17', 'PLAY_PUSH_KEY']) {
    const k = Deno.env.get(name) ?? '';
    if (k && provided === k) return true;
  }

  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.replace(/^Bearer\s+/i, '');
  if (!bearer) return false;
  if (SERVICE_ROLE && bearer === SERVICE_ROLE) return true;
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: userData } = await client.auth.getUser();
    if (!userData?.user) return false;
    const { data: ok } = await client.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    return ok === true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (!(await isAuthorized(req))) return json({ error: 'unauthorized' }, 401);

  try {
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action ?? 'diagnose');
    const days = Math.min(Math.max(Number(payload.days ?? 28), 1), 90);

    switch (action) {
      case 'permissions':
        return json(await permissions());
      case 'vitals':
        return json(await vitals(days));
      case 'subscriptions':
        return json(await subscriptions());
      case 'offers':
        return json(await offers());
      case 'voided':
        return json(await voided(days));
      case 'listing':
        return json(await listing());
      case 'images':
        return json(await images(Array.isArray(payload.languages) ? payload.languages.map(String) : undefined));

      case 'pushAssets':
        return json(await pushAssets(payload.dryRun !== false, Array.isArray(payload.languages) ? payload.languages.map(String) : undefined));
      case 'openEdit':
        return json(await openEdit());
      case 'deleteImages': {
        if (!payload.editId || !payload.language || !payload.imageType)
          return json({ error: 'editId, language, imageType required' }, 400);
        return json(await deleteImages(String(payload.editId), String(payload.language), String(payload.imageType)));
      }
      case 'uploadImage': {
        if (!payload.editId || !payload.language || !payload.imageType || !payload.base64)
          return json({ error: 'editId, language, imageType, base64 required' }, 400);
        return json(
          await uploadImage(
            String(payload.editId),
            String(payload.language),
            String(payload.imageType),
            String(payload.base64),
            String(payload.contentType ?? 'image/jpeg'),
          ),
        );
      }
      case 'finishEdit': {
        if (!payload.editId) return json({ error: 'editId required' }, 400);
        return json(await finishEdit(String(payload.editId), payload.commit === true));
      }

      case 'tracks':
        return json(await tracks());
      case 'audit':
        return json(await audit(days));
      case 'metric':
        return json(await metricQuery(String(payload.metricSet), (payload.metrics ?? []).map(String), days, (payload.dimensions ?? []).map(String)));
      case 'anrIssues':
        return json(await anrIssues(days));
      case 'pushListing':
        return json(
          await pushListing(
            payload.dryRun !== false,
            Array.isArray(payload.languages) ? payload.languages.map(String) : undefined,
          ),
        );



      case 'purchase': {
        if (!payload.purchaseToken) return json({ error: 'purchaseToken required' }, 400);
        return json(await purchase(String(payload.purchaseToken)));
      }
      case 'diagnose': {
        const [perm, v, subs, vd] = await Promise.all([
          permissions(), vitals(days), subscriptions(), voided(days),
        ]);
        return json({ permissions: perm, vitals: v, subscriptions: subs, voided: vd });
      }
      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error('[play-console] error', e);
    return json({ error: String(e) }, 500);
  }
});
