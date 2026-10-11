const fs = require('fs');
const path = require('path');

const gradlePath = path.join('android', 'app', 'build.gradle');
const vungleVersion = '7.7.3.0';
const vungleDependency = `implementation 'com.google.ads.mediation:vungle:${vungleVersion}'`;

if (!fs.existsSync(gradlePath)) {
  throw new Error('android/app/build.gradle not found. Generate Android before adding ad mediation.');
}

let gradle = fs.readFileSync(gradlePath, 'utf8');

gradle = gradle.replace(
  /implementation ['"]com\.google\.ads\.mediation:vungle:[^'"]+['"]/g,
  vungleDependency,
);

if (!gradle.includes(vungleDependency)) {
  gradle = gradle.replace(
    /(\s+implementation project\(':capacitor-cordova-android-plugins'\)\n)/,
    `$1\n    // Liftoff Monetize (Vungle) mediation adapter for AdMob.\n    // Required in release builds so AdMob can load Vungle waterfall/bidding demand.\n    ${vungleDependency}\n`,
  );

  if (!gradle.includes(vungleDependency)) {
    gradle = gradle.replace(
      /(dependencies\s*\{\n)/,
      `$1    // Liftoff Monetize (Vungle) mediation adapter for AdMob.\n    // Required in release builds so AdMob can load Vungle waterfall/bidding demand.\n    ${vungleDependency}\n`,
    );
  }

  fs.writeFileSync(gradlePath, gradle);
  console.log('✅ Liftoff Monetize (Vungle) AdMob mediation adapter added to Android build.');
} else {
  console.log('✅ Liftoff Monetize (Vungle) AdMob mediation adapter already present.');
}