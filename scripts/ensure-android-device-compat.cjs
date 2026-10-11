// Undoes Pangle's strict device requirements and enables native debug symbols
// so the Play Console stops flagging "no longer supports N devices" and
// "native code without debug symbols" warnings.
//
// Both edits are idempotent — safe to run on every build.

const fs = require('fs');
const path = require('path');

// ---------- 1. AndroidManifest: mark hardware features as not required ----------
const manifestPath = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');

// Features that Pangle's manifest declares (directly or implicitly via permissions)
// that exclude legacy / non-phone devices. Marking them `required=false` keeps
// the SDK working on devices that have the feature, and stops Play from filtering
// out devices that don't.
const NON_REQUIRED_FEATURES = [
  'android.hardware.telephony',
  'android.hardware.touchscreen',
  'android.hardware.location',
  'android.hardware.location.gps',
  'android.hardware.location.network',
  'android.hardware.wifi',
  'android.hardware.bluetooth',
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  'android.hardware.microphone',
  'android.hardware.screen.portrait',
  'android.hardware.screen.landscape',
  // Live wallpaper support — declared so Play knows we use it, but marked
  // not-required so devices without a live-wallpaper picker (some tablets,
  // launchers, Android Go, certain OEM ROMs) can still install the app.
  // The static wallpaper / daily verse paths still work on those devices.
  'android.software.live_wallpaper',
];

if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  const toolsNs = 'xmlns:tools="http://schemas.android.com/tools"';
  if (!manifest.includes(toolsNs)) {
    manifest = manifest.replace(/<manifest\s+/, `<manifest ${toolsNs} `);
  }

  const lines = [];
  for (const feature of NON_REQUIRED_FEATURES) {
    const escaped = feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<uses-feature[^>]*android:name=["']${escaped}["'][^/]*/>`, 'g');
    manifest = manifest.replace(re, '');
    lines.push(`    <uses-feature android:name="${feature}" android:required="false" tools:replace="android:required" />`);
  }

  const block = `\n    <!-- Override hardware requirements pulled in by ad-mediation SDKs (Pangle, etc.)\n         so Play does not filter out tablets, low-end phones, or devices missing telephony. -->\n${lines.join('\n')}\n`;

  // Remove any prior block we wrote, then re-insert (idempotent).
  manifest = manifest.replace(/\n\s*<!-- Override hardware requirements[\s\S]*?(?=\n\s*<application)/, '\n');

  manifest = manifest.replace(/(\n\s*)<application/, `${block}$1<application`);

  fs.writeFileSync(manifestPath, manifest);
  console.log('✅ Hardware uses-feature overrides written to AndroidManifest.xml');
} else {
  console.warn('⚠️  AndroidManifest.xml not found; skipping uses-feature overrides.');
}

// ---------- 2. app/build.gradle: enable native debug symbol upload ----------
const gradlePath = path.join('android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');

  if (!/debugSymbolLevel\s+['"]/.test(gradle)) {
    // Insert ndk { debugSymbolLevel 'SYMBOL_TABLE' } inside buildTypes.release { ... }
    gradle = gradle.replace(
      /(buildTypes\s*\{\s*release\s*\{)([\s\S]*?)(\n\s{8}\})/,
      (match, head, body, tail) => {
        if (body.includes('debugSymbolLevel')) return match;
        const insertion = `\n            ndk {\n                debugSymbolLevel 'SYMBOL_TABLE'\n            }`;
        return `${head}${body}${insertion}${tail}`;
      }
    );
    fs.writeFileSync(gradlePath, gradle);
    console.log("✅ Native debug symbols (SYMBOL_TABLE) enabled in release build.");
  } else {
    console.log('✅ Native debug symbols already enabled.');
  }
} else {
  console.warn('⚠️  android/app/build.gradle not found; skipping debug-symbol injection.');
}
