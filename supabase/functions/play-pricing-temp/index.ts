/**
 * TEMPORARY admin bridge to the Android Publisher API for subscription pricing
 * work (regional prices + free-trial offers). Delete after the pricing change.
 * Guarded by a request token; not referenced by the app.
 */
const PACKAGE_NAME = Deno.env.get('PLAY_PACKAGE_NAME') ?? 'com.jesuswallpaperbible.app';
const SA_JSON = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') ?? '';
const GUARD = 'prayly-pricing-temp-2026-09-13';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

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

let cached: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() / 1000 + 60) return cached.token;
  if (!SA_JSON) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not configured');
  const sa = JSON.parse(SA_JSON);
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const signingInput = `${b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))}.${b64url(
    enc.encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ),
  )}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(String(sa.private_key).replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput)));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${b64url(sig)}`,
    }).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${JSON.stringify(json)}`);
  cached = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cached.token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if ((req.headers.get('x-pricing-key') ?? '') !== GUARD) return json({ error: 'unauthorized' }, 401);

  try {
    const payload = await req.json().catch(() => ({} as Record<string, unknown>));
    const path = String((payload as any).path ?? '');
    const method = String((payload as any).method ?? 'GET').toUpperCase();
    const body = (payload as any).body;
    if (!path.startsWith('/')) return json({ error: 'path must start with /' }, 400);

    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}` + path;
    const token = await getAccessToken();
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return json({ ok: res.ok, status: res.status, body: parsed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
