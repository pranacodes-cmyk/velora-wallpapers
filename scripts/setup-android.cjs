const { execSync } = require('child_process');
const fs = require('fs');

function run(command) {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: 'inherit' });
}

function readPngSize(file) {
  const buffer = fs.readFileSync(file);
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error(`${file} is not a PNG file`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.byteLength,
  };
}

function requirePng(file, width, height, minBytes = 0) {
  if (!fs.existsSync(file)) throw new Error(`Missing Android asset source: ${file}`);
  const image = readPngSize(file);
  if (image.width !== width || image.height !== height) {
    throw new Error(`${file} must be ${width}x${height}; found ${image.width}x${image.height}`);
  }
  if (image.bytes < minBytes) {
    throw new Error(`${file} looks too compressed/small (${image.bytes} bytes). Replace it with the HD source.`);
  }
  console.log(`✓ ${file}: ${image.width}x${image.height}, ${(image.bytes / 1024 / 1024).toFixed(2)} MB`);
}

function ensureAssetSources() {
  // Source PNGs (resources/*.png) are gitignored — they may not exist in a
  // fresh clone (e.g. new GitHub repo). If missing, skip @capacitor/assets
  // generation entirely and fall back to Capacitor's default icons. This
  // unblocks CI builds without requiring the source PSDs to be committed.
  if (!fs.existsSync('resources/icon.png')) {
    console.warn('⚠️  resources/icon.png missing — skipping @capacitor/assets generation. Default Capacitor icons will be used.');
    return false;
  }
  if (!fs.existsSync('resources/icon-only.png')) {
    fs.copyFileSync('resources/icon.png', 'resources/icon-only.png');
  }
  requirePng('resources/icon.png', 1024, 1024, 700 * 1024);
  requirePng('resources/icon-only.png', 1024, 1024, 700 * 1024);
  requirePng('resources/icon-foreground.png', 1024, 1024, 700 * 1024);
  requirePng('resources/icon-background.png', 1024, 1024);
  requirePng('resources/splash.png', 2732, 2732, 900 * 1024);
  requirePng('resources/splash-dark.png', 2732, 2732, 900 * 1024);
  return true;
}

function ensurePillow() {
  try {
    execSync('python3 -c "from PIL import Image"', { stdio: 'ignore' });
  } catch (_) {
    run('python3 -m pip install --user Pillow');
  }
}

function verifyCapacitorWebAssets() {
  const requiredFiles = [
    'android/app/src/main/assets/public/index.html',
    'android/app/src/main/assets/capacitor.config.json',
    'android/app/src/main/assets/capacitor.plugins.json',
  ];
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Android web asset missing after sync: ${file}. Refusing to build an app that would show localhost connection refused.`);
    }
  }
  console.log('✓ Android bundled web assets verified');
}

// We only wipe + regenerate android/ when source icon PNGs (resources/icon*.png)
// are actually present. Without them, @capacitor/assets is skipped and
// Capacitor would ship its DEFAULT icon — destroying the brand. The committed
// android/app/src/main/res/mipmap-* PNGs already contain the real branded
// icons, so when sources are missing we PRESERVE the existing android/ folder
// and only run `cap sync` (which keeps mipmaps intact).
const sourcesPresent = fs.existsSync('resources/icon.png');
const androidExists = fs.existsSync('android');
const shouldRegenerate = sourcesPresent || !androidExists;

if (shouldRegenerate && androidExists) {
  console.log('Removing old generated android project (sources present, regenerating)...');
  fs.rmSync('android', { recursive: true, force: true });
} else if (!sourcesPresent) {
  console.log('✓ resources/icon.png missing — preserving committed android/ folder so branded mipmaps stay intact.');
}

run('npm run build');
if (shouldRegenerate) {
  run('npx cap add android');
}
run('node scripts/copy-native-plugins.cjs');
run('node scripts/strip-exact-alarms.cjs');
run('node scripts/ensure-android-ad-mediation.cjs');
run('node scripts/ensure-android-facebook-sdk.cjs');
run('node scripts/ensure-android-billing.cjs');

// Generate branded app icons + splash from /resources into android/app/src/main/res
// Uses @capacitor/assets — sources in /resources are full-bleed (logo already
// has its own dark background baked in, no extra padding/background needed).
const hasAssetSources = ensureAssetSources();
if (hasAssetSources) {
  run("npx --yes @capacitor/assets@3.0.5 generate --android --iconBackgroundColor '#0a0f1a' --iconBackgroundColorDark '#0a0f1a' --splashBackgroundColor '#0a0f1a' --splashBackgroundColorDark '#0a0f1a'");
}

run('npx cap sync android');
verifyCapacitorWebAssets();
// CRITICAL: re-copy native plugin files AFTER `cap sync`, because cap sync
// regenerates AndroidManifest.xml and can blow away our receiver / activity
// entries (ContentPushReceiver, PrayerAlarmReceiver, etc.). Without this
// second copy, alarms fire but Android has no registered receiver to handle
// them and the notification never posts.
run('node scripts/copy-native-plugins.cjs');
verifyCapacitorWebAssets();
run('node scripts/strip-exact-alarms.cjs');
run('node scripts/ensure-android-billing.cjs');
if (hasAssetSources) {
  ensurePillow();
  run('python3 scripts/generate-android-icons.py');
} else {
  console.warn('⚠️  Skipping generate-android-icons.py (no resources/icon.png).');
}


console.log('\n✅ Android project generated, branded, and synced.');
