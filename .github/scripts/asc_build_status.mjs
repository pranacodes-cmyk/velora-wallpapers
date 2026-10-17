// Waits for an uploaded iOS build to finish Apple processing, then makes it
// testable: "What to Test" notes + internal TestFlight groups. Prints a short
// report. Env: ISS, KID, PK (App Store Connect API key), BUILD (optional
// CFBundleVersion; blank = newest build), WHATS_NEW (optional).
import crypto from 'node:crypto';

const BUNDLE_ID = 'com.jesuswallpaperbible.app';
const b64u = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function token() {
  let pk = process.env.PK || '';
  const m = pk.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
  if (m) pk = '-----BEGIN PRIVATE KEY-----\n' + m[1].replace(/\s+/g, '').match(/.{1,64}/g).join('\n') + '\n-----END PRIVATE KEY-----\n';
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'ES256', kid: process.env.KID.trim(), typ: 'JWT' }));
  const p = b64u(JSON.stringify({ iss: process.env.ISS.trim(), iat: now - 30, exp: now + 1100, aud: 'appstoreconnect-v1' }));
  const s = crypto.sign('sha256', Buffer.from(h + '.' + p), { key: crypto.createPrivateKey(pk), dsaEncoding: 'ieee-p1363' });
  return h + '.' + p + '.' + b64u(s);
}

async function api(method, path, body) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { status: r.status, json, text };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE_ID}`);
if (apps.status !== 200 || !apps.json.data.length) {
  console.log('APP_LOOKUP_FAILED', apps.status, apps.text.slice(0, 300));
  process.exit(1);
}
const appId = apps.json.data[0].id;
console.log('App', appId, apps.json.data[0].attributes.name);

import fs from 'node:fs';
let wanted = (process.env.BUILD || '').trim();
if (!wanted && fs.existsSync('.github/ios-last-build.txt')) wanted = fs.readFileSync('.github/ios-last-build.txt', 'utf8').trim();
let build = null;
const maxWait = Number(process.env.MAX_WAIT_MIN || 35);
const deadline = Date.now() + maxWait * 60 * 1000;

async function diagnose() {
  const pre = await api('GET', `/v1/preReleaseVersions?filter[app]=${appId}&limit=10&sort=-version`);
  console.log('PRERELEASE', pre.status, (pre.json?.data || []).map((v) => v.attributes.version).join(', '));
  for (const path of [
    `/v1/apps/${appId}/buildUploads?limit=5`,
    `/v1/buildUploads?filter[app]=${appId}&limit=5`,
  ]) {
    const r = await api('GET', path);
    console.log('UPLOADS', path, r.status, r.text.slice(0, 1500));
    if (r.status === 200) break;
  }
  if (wanted) {
    const f = await api('GET', `/v1/builds?filter[app]=${appId}&filter[version]=${wanted}`);
    console.log('FILTERED', f.status, f.text.slice(0, 600));
  }
}
while (Date.now() < deadline) {
  const res = await api('GET', `/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=10&include=preReleaseVersion`);
  if (res.status !== 200) { console.log('BUILDS_FAILED', res.status, res.text.slice(0, 300)); process.exit(1); }
  const versions = Object.fromEntries((res.json.included || []).filter((i) => i.type === 'preReleaseVersions').map((i) => [i.id, i.attributes.version]));
  const list = res.json.data.map((b) => ({
    id: b.id,
    number: b.attributes.version,
    state: b.attributes.processingState,
    version: versions[b.relationships?.preReleaseVersion?.data?.id] || '?',
    expired: b.attributes.expired,
    minOs: b.attributes.minOsVersion,
  }));
  build = wanted ? list.find((b) => b.number === wanted) : list[0];
  if (!build) {
    // Apple reports validation failures on the upload record, not as a build.
    const up = await api('GET', `/v1/apps/${appId}/buildUploads?limit=10`);
    const rec = (up.json?.data || []).find((u) => !wanted || u.attributes.cfBundleVersion === wanted);
    const st = rec?.attributes?.state;
    if (st?.state === 'FAILED') {
      console.log(`RESULT UPLOAD FAILED ${rec.attributes.cfBundleShortVersionString} (${rec.attributes.cfBundleVersion})`);
      for (const e of st.errors || []) console.log(`  ITMS-${e.code}: ${e.description}`);
      process.exit(1);
    }
    console.log(`Build ${wanted || '(latest)'} not visible yet… upload state: ${st?.state || 'unknown'}`);
  } else {
    console.log(`Build ${build.version} (${build.number}) → ${build.state}`);
    if (build.state !== 'PROCESSING') break;
  }
  await sleep(60_000);
}

if (!build) { console.log('RESULT build never appeared'); await diagnose(); process.exit(1); }
if (build.state !== 'VALID') {
  console.log('RESULT', build.state, '— Apple did not accept the build. Check the App Store Connect email for the ITMS reason.');
  process.exit(build.state === 'PROCESSING' ? 0 : 1);
}

// "What to Test" (en-US) for testers.
const whatsNew = (process.env.WHATS_NEW || '').trim() ||
  'New Prayly for iPhone: daily verse wallpaper made on your phone (set it up once with Shortcuts), Home & Lock Screen widgets, Journey, Bible, Quiz and prayers. Please test: Daily Verse → Make it automatic, widgets, Premium purchase/restore.';
const locs = await api('GET', `/v1/builds/${build.id}/betaBuildLocalizations`);
const en = locs.json?.data?.find((l) => l.attributes.locale === 'en-US');
const locRes = en
  ? await api('PATCH', `/v1/betaBuildLocalizations/${en.id}`, { data: { type: 'betaBuildLocalizations', id: en.id, attributes: { whatsNew } } })
  : await api('POST', '/v1/betaBuildLocalizations', {
      data: { type: 'betaBuildLocalizations', attributes: { locale: 'en-US', whatsNew }, relationships: { build: { data: { type: 'builds', id: build.id } } } },
    });
console.log('What to Test', locRes.status);

// Internal groups: make sure the build is in each one.
const groups = await api('GET', `/v1/betaGroups?filter[app]=${appId}&limit=50`);
for (const g of groups.json?.data || []) {
  const a = g.attributes;
  if (!a.isInternalGroup) { console.log(`Group "${a.name}" (external) — not auto-added (needs Beta App Review).`); continue; }
  if (a.hasAccessToAllBuilds) { console.log(`Group "${a.name}" (internal) — gets every build automatically.`); continue; }
  const add = await api('POST', `/v1/betaGroups/${g.id}/relationships/builds`, { data: [{ type: 'builds', id: build.id }] });
  console.log(`Group "${a.name}" (internal) — added: ${add.status}`);
}
if (!(groups.json?.data || []).length) console.log('No TestFlight groups yet — add yourself under TestFlight → Internal Testing.');

const detail = await api('GET', `/v1/builds/${build.id}/buildBetaDetail`);
console.log('Internal testing state:', detail.json?.data?.attributes?.internalBuildState, '| External:', detail.json?.data?.attributes?.externalBuildState);
console.log('RESULT VALID', build.version, build.number);
