# Flutter visual and behavior recovery

## Goal
Make the Flutter APK match the polished Capacitor/web app on the supplied S23 Ultra screenshots, while fixing the broken wallpaper and prayer flows.

## Changes
1. **Visual system**
   - Replace broad opaque gold fills with the web app's dark glass surfaces, restrained gold highlights, borders, and shadows.
   - Apply the correction to Today, prayer cards, Daily Verse setup, pack cards, buttons, and shared premium surfaces.

2. **Onboarding and wallpaper previews**
   - Center the first post-language headline and lock-screen mockup using the same responsive vertical sizing as the web app.
   - Ensure Today's center and neighboring phone mockups render the background, date, clock, verse, reference, and lock state without blank cards or overflow.

3. **Prayer screen**
   - Replace the invalid devotional image URLs with verified working assets and add a non-error fallback.
   - Make toolbar and Android back actions single-fire and lifecycle-safe; stop animations/audio before leaving to prevent delayed crashes.

4. **Daily Verse setup and auto-rotation**
   - Remove narrow-screen card overflows with content-driven pack tile heights.
   - Restore the real flow: check cache, prefetch required backgrounds, open Android's live-wallpaper picker, re-check active state, and show clear success/failure feedback.
   - Keep mood-pack selection synchronized with the native wallpaper service.

5. **Parallax loading and performance**
   - Cache scene data and image providers above scrolling cards, preserve already-loaded scenes, and avoid restarting sensor/ticker work during ordinary page scrolling.
   - Add visible stable placeholders/fallbacks instead of black or repeatedly loading cards.

6. **Verification and delivery**
   - Run formatting and CI analysis/build checks.
   - Push the fixes to GitHub and run only the cached arm64 debug APK workflow.
   - Do not run a Play Store build or publish an OTA update.

## Technical notes
- Flutter remains the native implementation; the React app is the visual and behavioral reference.
- Existing package name, purchase identifiers, storage keys, translations, and native wallpaper services remain unchanged.
- Verification targets the supplied S23 Ultra dimensions and the current web preview.
