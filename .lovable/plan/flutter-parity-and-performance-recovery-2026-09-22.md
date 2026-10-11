# Flutter parity and performance recovery

## Goal
Restore Flutter as the source implementation, make the affected screens visually match the web reference in both themes, and remove the carousel work causing visible frame drops on the S23 Ultra.

## Work
1. **Home phone mockups — layout and motion**
   - Remove the delayed heavy/light mockup replacement that happens after each swipe and causes the visible pause.
   - Keep a small, stable set of already-decoded neighboring mockups alive; pre-cache their images before interaction and avoid image decoding, timers, state changes, or haptics during the drag.
   - Keep only transform-based depth motion, use one lightweight repaint path, and make the phone’s date, clock, verse, reference, and day label fit within fixed bounds without clipping or overlapping.
   - Match the web carousel geometry, centered card size, side-card visibility, caption, dots, and controls.

2. **PrayScreen star card — restore the clean reference**
   - Restore the earlier compact horizontal card instead of the oversized gold-heavy redesign.
   - Use the web Today-page theme roles exactly: navy structural color in light mode, restrained gold accents in both modes, matching border, icon tile, typography, spacing, and status copy.
   - Implement Flutter first, then mirror the same card in web.

3. **Installed app suggestions**
   - Keep the full installed-app list searchable.
   - Build “Your top apps” from installed Instagram, TikTok, Facebook, X, Snapchat, and YouTube first, in a deliberate social priority order; fill any remaining slots from actual usage only when fewer than four supported social apps are installed.
   - Preserve real installed app names/icons and never show unavailable demo apps on Android.

4. **Onboarding and translations**
   - Verify the first PrayScreen onboarding slide uses the corrected bright, recognizable branded icons in Flutter and web with matching assets and no whole-row dimming applied to icons.
   - Prevent stale downloaded translation bundles from overriding newer bundled keys; missing review strings must fall back to English copy instead of displaying raw `onb.proof.*` keys.
   - Re-export and validate every social-proof key across English, Spanish, Portuguese, Filipino, Hindi, Indonesian, French, and German.

5. **Verification**
   - Run Dart formatting/static checks and web type checks.
   - Produce Flutter screenshots for dark and light Today, PrayScreen, onboarding slide 1, and social proof at the S23 Ultra viewport; compare them against the web screens.
   - Profile carousel interaction for rebuilds/image decodes during swipe and verify repeated swipes remain smooth without overflow warnings.
   - Push the verified Flutter-first and web-mirror fixes to the private repository; do not start an APK workflow unless separately requested.

## Why this drift happened
- The recent Flutter carousel optimization changed rendered widgets after a 220 ms settle timer. That saved memory but moved expensive image/widget work to the exact moment each swipe ended, creating the “jam.”
- Flutter’s home card was independently redesigned rather than restored from the established web reference, so both theme treatments drifted.
- Android suggestions are currently sorted only by 30-day usage, allowing utilities to displace the social apps the feature is meant to guard.
- Flutter displays the key itself when a translation is absent, and its asset loader can retain an older downloaded translation bundle after the app code has newer keys.
