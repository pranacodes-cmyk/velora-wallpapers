const fs = require('fs');
const path = require('path');

const gradlePath = path.join('android', 'app', 'build.gradle');
const pangleVersion = '8.0.0.4.0';
const pangleDependency = `implementation 'com.google.ads.mediation:pangle:${pangleVersion}'`;

if (!fs.existsSync(gradlePath)) {
  throw new Error('android/app/build.gradle not found. Generate Android before adding ad mediation.');
}

let gradle = fs.readFileSync(gradlePath, 'utf8');

gradle = gradle.replace(
  /implementation ['"]com\.google\.ads\.mediation:pangle:[^'"]+['"]/g,
  pangleDependency,
);

if (!gradle.includes(pangleDependency)) {
  // Insert right after the Vungle line if present, else before closing dependencies brace.
  if (/com\.google\.ads\.mediation:vungle:/.test(gradle)) {
    gradle = gradle.replace(
      /(implementation ['"]com\.google\.ads\.mediation:vungle:[^'"]+['"]\n)/,
      `$1\n    // Pangle (ByteDance) mediation adapter for AdMob.\n    // Required so AdMob can serve Pangle bids configured in the Mediation dashboard.\n    ${pangleDependency}\n`,
    );
  } else {
    gradle = gradle.replace(
      /(dependencies\s*\{\n)/,
      `$1    // Pangle (ByteDance) mediation adapter for AdMob.\n    // Required so AdMob can serve Pangle bids configured in the Mediation dashboard.\n    ${pangleDependency}\n`,
    );
  }

  fs.writeFileSync(gradlePath, gradle);
  console.log('✅ Pangle AdMob mediation adapter added to Android build.');
} else {
  console.log('✅ Pangle AdMob mediation adapter already present.');
}

// Pangle SDK (com.pangle.global:pag-sdk) is NOT on Google/Maven Central.
// It's hosted on ByteDance's own Maven repo. Add it to the root build.gradle
// so Gradle can resolve the transitive dependency of the adapter above.
const rootGradlePath = path.join('android', 'build.gradle');
if (fs.existsSync(rootGradlePath)) {
  let rootGradle = fs.readFileSync(rootGradlePath, 'utf8');
  const pangleRepoMarker = 'pangle-sdk-repo';
  const pangleRepoUrl = 'https://artifact.bytedance.com/repository/pangle/';
  rootGradle = rootGradle.replace(
    /https:\/\/artifact\.bytedanceapi\.com\/repository\/pangle\/?/g,
    pangleRepoUrl,
  );

  if (!rootGradle.includes(pangleRepoMarker) && !rootGradle.includes(pangleRepoUrl)) {
    rootGradle = rootGradle.replace(
      /(allprojects\s*\{\s*repositories\s*\{)([\s\S]*?)(\n\s*\})/,
      (match, head, body, tail) => {
        return `${head}${body}\n        // ${pangleRepoMarker}: Pangle (ByteDance) SDK Maven repo — required by the Pangle AdMob adapter.\n        maven { url '${pangleRepoUrl}' }${tail}`;
      }
    );
    fs.writeFileSync(rootGradlePath, rootGradle);
    console.log('✅ Pangle Maven repo added to android/build.gradle.');
  } else {
    fs.writeFileSync(rootGradlePath, rootGradle);
    console.log('✅ Pangle Maven repo already present in android/build.gradle.');
  }
} else {
  console.warn('⚠️  android/build.gradle not found; skipping Pangle Maven repo injection.');
}
