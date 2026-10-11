#!/usr/bin/env node
/**
 * Prints the highest versionCode + versionName currently present on Google Play
 * (across all tracks) as `code=<n>` / `name=<x.y.z>` lines, ready to append to
 * $GITHUB_OUTPUT.
 *
 * Requires a service-account JSON path in PLAY_SERVICE_ACCOUNT_JSON_PATH.
 * Fails soft: if anything goes wrong it prints nothing and exits 0, so the
 * workflow can fall back to its local floor-based bump.
 */
const fs = require('fs');

const PACKAGE_NAME = process.env.PLAY_PACKAGE_NAME || 'com.jesuswallpaperbible.app';
const KEY_PATH = process.env.PLAY_SERVICE_ACCOUNT_JSON_PATH || '/tmp/play-service-account.json';

async function main() {
  if (!fs.existsSync(KEY_PATH)) return;
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const publisher = google.androidpublisher({ version: 'v3', auth });

  const edit = await publisher.edits.insert({ packageName: PACKAGE_NAME });
  const editId = edit.data.id;

  let maxCode = 0;
  let maxName = '';

  // Bundles already uploaded (covers drafts not yet assigned to a track).
  try {
    const bundles = await publisher.edits.bundles.list({ packageName: PACKAGE_NAME, editId });
    for (const b of bundles.data.bundles || []) {
      const code = Number(b.versionCode || 0);
      if (code > maxCode) maxCode = code;
    }
  } catch (_) { /* ignore */ }

  // Track releases carry the versionName.
  try {
    const tracks = await publisher.edits.tracks.list({ packageName: PACKAGE_NAME, editId });
    for (const t of tracks.data.tracks || []) {
      for (const r of t.releases || []) {
        for (const vc of r.versionCodes || []) {
          const code = Number(vc);
          if (code >= maxCode) {
            maxCode = code;
            if (r.name) maxName = String(r.name).trim();
          }
        }
      }
    }
  } catch (_) { /* ignore */ }

  try {
    await publisher.edits.delete({ packageName: PACKAGE_NAME, editId });
  } catch (_) { /* ignore */ }

  if (maxCode > 0) process.stdout.write(`code=${maxCode}\n`);
  if (maxName) process.stdout.write(`name=${maxName}\n`);
}

main().catch((err) => {
  process.stderr.write(`play-latest-version: ${err?.message || err}\n`);
});
