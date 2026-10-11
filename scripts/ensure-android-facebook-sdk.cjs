const fs = require('fs');
const path = require('path');

const gradlePath = path.join('android', 'app', 'build.gradle');
const fbDep = `implementation 'com.facebook.android:facebook-android-sdk:18.0.3'`;
const idDep = `implementation 'com.google.android.gms:play-services-ads-identifier:18.2.0'`;

if (!fs.existsSync(gradlePath)) {
  throw new Error('android/app/build.gradle not found. Generate Android first.');
}

let gradle = fs.readFileSync(gradlePath, 'utf8');
let changed = false;

if (!/com\.facebook\.android:facebook-android-sdk/.test(gradle)) {
  gradle = gradle.replace(
    /(dependencies\s*\{\n)/,
    `$1    // Meta (Facebook) SDK — required by MainActivity for cold-start install attribution.\n    ${fbDep}\n    ${idDep}\n`,
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(gradlePath, gradle);
  console.log('✅ Facebook SDK dependency injected into android/app/build.gradle');
} else {
  console.log('✅ Facebook SDK dependency already present.');
}
