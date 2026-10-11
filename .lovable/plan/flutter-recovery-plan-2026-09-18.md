# Flutter Recovery Plan

## Goal
Make the Flutter APK feel like Prayly again: original dark/gold look, clean typography, no yellow debug-looking text lines, complete images/icons/audio where expected, smoother home loading, smaller/faster debug builds.

## What I will fix first
1. **Bad typography and yellow lines**
   - Remove the text underline/debug-style rendering that is showing across onboarding and screens.
   - Restore the original Prayly font feel: clean app text, proper weights, no monospace-looking labels unless the web app intentionally uses it.
   - Re-check onboarding spacing, button shape, language cards, and slide colors against the screenshots.

2. **Home page lag and slow loading**
   - Stop heavy daily-verse mockups from all rendering at once.
   - Keep only the visible phone preview and nearby items mounted.
   - Reduce expensive glow/blur/shadow work on Flutter debug/device.
   - Add stable placeholders so the screen does not feel empty while images load.

3. **Missing icons, images, and audio**
   - Audit the Flutter assets declared in `pubspec.yaml` against actual files.
   - Fix missing journey images, live wallpaper previews, bottom/tab icons, and journey audio wiring.
   - Ensure asset URLs and bundled JSON point to real files or CDN assets.

4. **Colors and visual parity**
   - Re-align Flutter design tokens to the original Prayly dark majestic palette.
   - Remove the bad half-glow effects in mockups/previews.
   - Match the web card borders, gold intensity, dark surfaces, and glass depth more closely.

5. **Crash/error screen**
   - Trace the Flutter layout assertion from the red screen.
   - Fix the widget causing repeated layout invalidation, especially around moving mockups/carousels.

6. **APK size and faster GitHub builds**
   - Explain debug APK size honestly: debug builds include extra runtime/debug symbols and are much larger than release.
   - Add/verify Flutter pub, Gradle, and Android build caches in the debug workflow.
   - Keep one fast debug APK workflow only; no Play build and no OTA unless explicitly asked.

## Verification before I call it done
- Run local static checks where possible.
- Push fixes to GitHub only after the source is cleaned.
- Run the Flutter debug APK workflow.
- Confirm the latest workflow is green and the artifact is available.
- Report what still needs real-device QA separately instead of pretending it is perfect.

## Not included now
- No Play Store upload.
- No OTA.
- No new Prayer Lock/social-media lock feature yet.
