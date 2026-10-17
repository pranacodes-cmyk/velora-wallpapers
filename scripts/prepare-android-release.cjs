const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

execFileSync(process.execPath, ['scripts/strip-exact-alarms.cjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/ensure-android-ad-mediation.cjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/ensure-android-facebook-sdk.cjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/ensure-android-device-compat.cjs'], { stdio: 'inherit' });

const gradlePath = path.join('android', 'app', 'build.gradle');
if (!fs.existsSync(gradlePath)) {
  throw new Error('android/app/build.gradle not found. Run npm run android:generate first.');
}

function requireFileContains(file, checks) {
  if (!fs.existsSync(file)) throw new Error(`Release guard failed: missing ${file}`);
  const text = fs.readFileSync(file, 'utf8');
  for (const check of checks) {
    if (!text.includes(check)) {
      throw new Error(`Release guard failed: ${file} is missing required content: ${check}`);
    }
  }
}

function requireManifestMetaValue(file, name, value) {
  const text = fs.readFileSync(file, 'utf8');
  const tags = text.match(/<meta-data\b[\s\S]*?\/>/g) || [];
  const ok = tags.some((tag) => tag.includes(`android:name="${name}"`) && tag.includes(`android:value="${value}"`));
  if (!ok) {
    throw new Error(`Release guard failed: ${file} must set ${name}=${value}`);
  }
}

function verifyNativeNotificationReleaseInputs() {
  requireFileContains('android/app/src/main/AndroidManifest.xml', [
    'com.velora.plugins.ContentPushReceiver',
    'com.velora.plugins.PrayerBootReceiver',
    'android.intent.action.TIME_SET',
    'android.intent.action.TIMEZONE_CHANGED',
    'android.intent.action.MY_PACKAGE_REPLACED',
  ]);
  requireFileContains('android/app/src/main/java/com/velora/plugins/ContentPushPlugin.java', [
    'setBestEffortWakeup(am, at, pi)',
    'fireCurrentSlotForTimeChange',
    'KIND_COMPANION',
    'cleanupLegacyLocalNotifications(ctx)',
  ]);
  requireFileContains('android/app/src/main/java/com/velora/plugins/ContentPushReceiver.java', [
    'EXTRA_BYPASS_GUARDS',
    'DAILY_CAP = 4',
    'prayly_verse_v9',
    'USAGE_ALARM',
    'CATEGORY_ALARM',
    'PRIORITY_MAX',
    'setCustomHeadsUpContentView',
    'setCustomBigContentView',
  ]);
  requireFileContains('android/app/src/main/java/com/velora/plugins/ParallaxLiveWallpaperService.java', [
    'new ParallaxSceneRenderer()',
    'Sensor.TYPE_GAME_ROTATION_VECTOR',
    'EGL14.eglSwapBuffers(eglDisplay, eglSurface)',
  ]);
  requireFileContains('android/app/src/main/java/com/velora/plugins/ParallaxSceneRenderer.java', [
    'FOV_BASE',
  ]);
  requireFileContains('android/app/src/main/java/com/velora/plugins/VideoWallpaperService.java', [
    'mediaPlayer.prepareAsync()',
  ]);
  requireFileContains('android/app/src/main/java/com/velora/plugins/DailyVerseWallpaperService.java', [
    'conn.setConnectTimeout(5000)',
    'conn.setReadTimeout(8000)',
  ]);
  console.log('✅ Native notification release guard passed: content pushes use custom heads-up card.');
}

function verifyNativeCrashHardening() {
  requireFileContains('capacitor.config.ts', [
    'launchShowDuration: 1200',
    'launchFadeOutDuration: 0',
    "backgroundColor: '#0a0f1a'",
    'splashFullScreen: false',
    'splashImmersive: false',
  ]);
  requireFileContains('android/app/src/main/AndroidManifest.xml', [
    'android:hardwareAccelerated="true"',
    'android:theme="@style/AppTheme.Launcher"',
  ]);
  requireManifestMetaValue('android/app/src/main/AndroidManifest.xml', 'com.facebook.sdk.AutoInitEnabled', 'true');
  requireManifestMetaValue('android/app/src/main/AndroidManifest.xml', 'com.facebook.sdk.AutoLogAppEventsEnabled', 'false');
  requireManifestMetaValue('android/app/src/main/AndroidManifest.xml', 'com.facebook.sdk.AdvertiserIDCollectionEnabled', 'true');
  requireFileContains('android/app/src/main/java/com/jesuswallpaperbible/app/MainActivity.java', [
    'setImportantForAutofill',
    'FacebookSdk.isInitialized()',
    '}, 800);',
  ]);
  requireFileContains('android/app/src/main/java/com/jesuswallpaperbible/app/GooglePlayPricesPlugin.java', [
    'AtomicBoolean finished',
    'Google Play price lookup timed out',
    'postDelayed(timeout, 10000)',
  ]);
  // Guard: app-wide MotionConfig reducedMotion must NOT be re-added. It
  // flattens every modal/sheet/nav transition on Android for marginal ANR
  // gain. GPU-heavy effects are already stripped in src/index.css.
  const appTsx = fs.readFileSync('src/App.tsx', 'utf8');
  // Strip comments before checking so explanatory notes don't trigger the guard.
  const appTsxCode = appTsx
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  if (/<\s*MotionConfig\b[^>]*reducedMotion/.test(appTsxCode)) {
    throw new Error('Release guard failed: app-wide MotionConfig reducedMotion must not be used in src/App.tsx. Apply reducedMotion locally to decorative/infinite components only.');
  }
  const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  if (manifest.includes('com.facebook.internal.FacebookInitProvider') && manifest.includes('tools:node="remove"')) {
    throw new Error('Release guard failed: FacebookInitProvider must not be removed; Meta install attribution breaks.');
  }
  const mainActivity = fs.readFileSync('android/app/src/main/java/com/jesuswallpaperbible/app/MainActivity.java', 'utf8');
  if (mainActivity.includes('FacebookSdk.fullyInitialize()')) {
    throw new Error('Release guard failed: MainActivity must not manually fullyInitialize Meta during launch.');
  }
  console.log('✅ Native crash hardening guard passed: hardware acceleration on for all devices.');
}

verifyNativeNotificationReleaseInputs();
verifyNativeCrashHardening();

let gradle = fs.readFileSync(gradlePath, 'utf8');

// WebView startup hardening in MainActivity uses AndroidX WebKit startup APIs.
if (!gradle.includes('androidx.webkit:webkit')) {
  gradle = gradle.replace(
    /implementation "androidx\.core:core-splashscreen:\$coreSplashScreenVersion"/,
    'implementation "androidx.core:core-splashscreen:$coreSplashScreenVersion"\n    implementation "androidx.webkit:webkit:$androidxWebkitVersion"'
  );
}

const versionCode = process.env.ANDROID_VERSION_CODE || process.env.GITHUB_RUN_NUMBER || '1';
const versionName = process.env.ANDROID_VERSION_NAME || '1.0.0';

// 1. Update versionCode / versionName inside defaultConfig
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${Number(versionCode)}`)
  .replace(/versionName\s+(['"])[^'"]+\1/, `versionName "${versionName}"`);

// 1b. Ensure compileSdk is present (Capacitor sometimes uses compileSdkVersion only)
if (!/compileSdk\s*=?\s*(\d+|rootProject\.ext\.compileSdkVersion)/.test(gradle) && !/compileSdkVersion\s+(rootProject|\d+)/.test(gradle)) {
  gradle = gradle.replace(/android\s*\{/, 'android {\n    compileSdk rootProject.ext.compileSdkVersion');
}

// 2. Inject signingConfigs block + wire it into release buildType
// Use a marker comment so re-runs are idempotent
const SIGNING_MARKER = '// LOVABLE_SIGNING_CONFIG';

function findMatchingBrace(text, openBraceIdx) {
  let depth = 0;
  for (let i = openBraceIdx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}') depth--;
    if (depth === 0) return i;
  }
  return -1;
}

function findNamedBlock(text, name, startIdx = 0) {
  const nameIdx = text.indexOf(name, startIdx);
  if (nameIdx === -1) return null;
  const openIdx = text.indexOf('{', nameIdx);
  if (openIdx === -1) return null;
  const closeIdx = findMatchingBrace(text, openIdx);
  if (closeIdx === -1) return null;
  return { nameIdx, openIdx, closeIdx };
}

function ensureReleaseConfigLine(text, line) {
  const pattern = new RegExp(`^\\s*${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$\\n?`, 'gm');
  let next = text.replace(pattern, '');
  const buildTypesBlock = findNamedBlock(next, 'buildTypes');
  if (!buildTypesBlock) throw new Error('Could not find buildTypes block in app/build.gradle');
  const releaseBlock = findNamedBlock(next, 'release', buildTypesBlock.openIdx);
  if (!releaseBlock || releaseBlock.nameIdx > buildTypesBlock.closeIdx) {
    throw new Error('Could not find release buildType in app/build.gradle');
  }
  return next.slice(0, releaseBlock.openIdx + 1)
    + `\n            ${line}`
    + next.slice(releaseBlock.openIdx + 1);
}

if (!gradle.includes(SIGNING_MARKER)) {
  // Find the buildTypes { release { ... } } block and insert signingConfigs before it
  // and wire signingConfig into release.
  const signingConfigsBlock = `
    ${SIGNING_MARKER}
    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH") ?: "release.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
`;

  // Insert signingConfigs right before buildTypes { ... }
  const buildTypesIdx = gradle.indexOf('buildTypes');
  if (buildTypesIdx === -1) {
    throw new Error('Could not find buildTypes block in app/build.gradle');
  }
  gradle = gradle.slice(0, buildTypesIdx) + signingConfigsBlock + '    ' + gradle.slice(buildTypesIdx);

}

gradle = ensureReleaseConfigLine(gradle, 'signingConfig signingConfigs.release');
gradle = ensureReleaseConfigLine(gradle, 'crunchPngs false');

fs.writeFileSync(gradlePath, gradle);
console.log(`✅ Android release configured: versionCode=${versionCode}, versionName=${versionName}`);
console.log('--- Generated app/build.gradle (first 80 lines) ---');
console.log(gradle.split('\n').slice(0, 80).join('\n'));
