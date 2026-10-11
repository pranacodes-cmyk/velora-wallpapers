#!/usr/bin/env node
/**
 * Ship a web-only fix over the air (no Play Store release).
 *
 *   node scripts/release-ota.mjs --native 1.0.1150 --version 1.0.1151 \
 *        --rollout 20 --notes "Fix prayer background loading"
 *
 * VERSIONING RULE (do not break this):
 *   OTA bundle versions live on the SAME number line as the Play versionName
 *   (1.0.NNNN). --native is the versionName of the store build the bundle is
 *   built against, and --version must be exactly one step above it (or higher).
 *   The ota-update endpoint never serves a bundle whose version is <= the
 *   device's native versionName, so this scheme makes a JS/native mismatch or
 *   a silent downgrade on fresh installs impossible.
 *
 * Steps: build -> zip dist -> sha256 -> upload zip to R2 -> register bundle.
 * Installed apps download it in the background and apply it on next launch.
 *
 * Env required:
 *   OTA_RELEASE_KEY   admin key for the ota-release edge function
 * Optional:
 *   SUPABASE_URL      defaults to the project URL below
 *
 * Rollback:  node scripts/release-ota.mjs --deactivate 1.0.1151
 * Rollout:   node scripts/release-ota.mjs --set-rollout 1.0.1151 --rollout 100
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jbwhlogvldhsnxtpxwih.supabase.co';
const KEY = process.env.OTA_RELEASE_KEY || '';
if (!KEY) {
  console.error('Missing OTA_RELEASE_KEY env var.');
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

async function call(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ota-key': KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${fn} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// --- rollback / rollout shortcuts -------------------------------------------
const deactivate = flag('deactivate');
if (deactivate) {
  console.log(await call('ota-release', { action: 'deactivate', version: deactivate }));
  process.exit(0);
}
const setRollout = flag('set-rollout');
if (setRollout) {
  console.log(
    await call('ota-release', {
      action: 'rollout',
      version: setRollout,
      rollout: Number(flag('rollout') ?? 100),
    }),
  );
  process.exit(0);
}
if (args.includes('--list')) {
  console.log(JSON.stringify(await call('ota-release', { action: 'list' }), null, 2));
  process.exit(0);
}

// --- publish ----------------------------------------------------------------
const version = flag('version');
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Pass --version x.y.z (bump it for every OTA release).');
  process.exit(1);
}
// The versionName of the live store build this bundle is built against.
// Required — it is the anti-mismatch guard.
const nativeVersion = flag('native');
if (!nativeVersion || !/^\d+\.\d+\.\d+$/.test(nativeVersion)) {
  console.error(
    'Pass --native x.y.z — the versionName of the store build this bundle targets\n' +
      '  (see the "Using versionName=" line in the Play Store release workflow log).',
  );
  process.exit(1);
}
const cmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};
if (cmp(version, nativeVersion) <= 0) {
  console.error(
    `--version ${version} must be HIGHER than --native ${nativeVersion}.\n` +
      `  Use ${nativeVersion.replace(/(\d+)$/, (n) => String(Number(n) + 1))} or above.`,
  );
  process.exit(1);
}
const [vMajor, vMinor] = version.split('.');
const [nMajor, nMinor] = nativeVersion.split('.');
if (vMajor !== nMajor || vMinor !== nMinor) {
  console.error(
    `--version ${version} must stay on the same major.minor line as the store build (${nMajor}.${nMinor}.x).`,
  );
  process.exit(1);
}
const rollout = Number(flag('rollout') ?? 100);
// --urgent: apply on the very next launch during splash instead of waiting for
// a later cold start. Use only for critical fixes.
const urgent = args.includes('--urgent');
const notes = flag('notes') ?? '';
const channel = flag('channel') ?? 'production';

const root = process.cwd();
const dist = path.join(root, 'dist');
const zipPath = path.join(root, `ota-${version}.zip`);

if (!args.includes('--skip-build')) {
  console.log('▶ building…');
  execSync('npm run build', { stdio: 'inherit' });
}
if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html missing — build failed?');
  process.exit(1);
}

console.log('▶ zipping dist…');
execSync(`rm -f "${zipPath}" && cd "${dist}" && zip -qr "${zipPath}" .`, { stdio: 'inherit' });
const buf = readFileSync(zipPath);
const checksum = createHash('sha256').update(buf).digest('hex');
console.log(`  ${(statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB  sha256=${checksum.slice(0, 12)}…`);

console.log('▶ uploading bundle…');
const form = new FormData();
form.append('file', new Blob([buf], { type: 'application/zip' }), `ota-${version}.zip`);
form.append('key', `ota/${channel}/${version}.zip`);
const upRes = await fetch(`${SUPABASE_URL}/functions/v1/r2-manager?action=upload`, {
  method: 'POST',
  body: form,
});
const up = await upRes.json();
if (!upRes.ok || !up.url) throw new Error(`upload failed: ${JSON.stringify(up)}`);
console.log(`  ${up.url}`);

console.log('▶ registering release…');
const out = await call('ota-release', {
  action: 'publish',
  version,
  url: up.url,
  checksum,
  channel,
  rollout,
  // Floor, not a hard pin: the bundle needs at least this store build. Older
  // builds never see it, and newer store builds outrank it automatically
  // because their versionName is higher than the bundle version.
  min_native_version: nativeVersion,
  urgent,
  notes,
});
console.log(JSON.stringify(out, null, 2));
console.log(
  `\n✅ OTA ${version} live at ${rollout}% (store build ${nativeVersion}+) — installed apps apply it on next launch.`,
);
