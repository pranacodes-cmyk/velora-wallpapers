const fs = require('fs');
const path = require('path');

const gradlePath = path.join('android', 'app', 'build.gradle');

if (!fs.existsSync(gradlePath)) {
  throw new Error('android/app/build.gradle not found. Generate Android first.');
}

let gradle = fs.readFileSync(gradlePath, 'utf8');

if (!gradle.includes('com.android.billingclient:billing')) {
  gradle = gradle.replace(
    /(dependencies\s*\{\n)/,
    `$1    // Direct Google Play Billing read for fresh paywall price labels.\n    implementation 'com.android.billingclient:billing:8.0.0'\n\n`
  );
  fs.writeFileSync(gradlePath, gradle);
  console.log('✅ Google Play Billing dependency injected into android/app/build.gradle');
} else {
  console.log('✅ Google Play Billing dependency already present');
}