# Project Architecture

- Keep the full Bible reader in bottom navigation and Settings, without a duplicate Today button with shared book-wise compressed licensed texts, local verse-position preferences, likes and private notes; this avoids redundant Home entry points and bounds offline book-cache memory usage.
- Keep trial transition colors scoped to the midnight onboarding palette and time its cancellable haptics to the switch/check beats; global light theme must never alter this handoff.

- Keep matching web/Flutter bottom navigation Today, Wallpapers, Bible, Quiz; expose Shield as a pushed destination from Settings and the former Home Bible Chat slot so it remains accessible without occupying a primary tab.
- Arm prayer alarms from the onboarding Rhythm choice on its explicit Continue tap, and reuse alarm controls in Today and Settings for all subscription tiers; never schedule merely from viewing a slide, preserving explicit user opt-in.
- Rotate the four bundled paper-cut prayer-alarm scenes by calendar day in the native lock-screen activity; deterministic local rotation keeps alarms instant and visually varied without network access.
- Generate Flutter translations from the web dictionaries, retaining every key family used by restored Flutter screens so raw localization keys can never reach the UI.
- Build Flutter localization from bundled English + selected language, then accept only non-empty, non-literal OTA values so stale content can never expose raw keys.
- Sync native Android reminder copy from Flutter's active dictionary so scheduled lock-screen UI follows in-app language changes.
- Prototype major onboarding concepts in the web preview first, then mirror the approved interaction and composition in Flutter so both remain visually aligned.
- Expose onboarding replay in Settings using the existing replay handoff in web and Flutter without clearing user data or entitlements; this lets the complete flow be reviewed safely.
- Produce standalone PrayScreen feature films as deterministic 9:16 Remotion compositions; frame-controlled UI motion keeps the product interaction and copy exact.
## GitHub Actions releases
- Keep the GitHub repository public only while an explicitly requested workflow runs, then restore private immediately; this avoids private-runner billing failures.

- Keep the cinematic paywall presentation separate from store purchase/restore logic, using one CDN video with a poster fallback in web and Flutter; this preserves legacy entitlements and keeps media lightweight.
- Start buffering the paywall film when its view mounts, cache the native poster, and skip video initialization for reduced motion; this reduces startup delay without background playback or purchase changes.
- Keep the post-onboarding paywall in the midnight palette, while paywalls opened inside the app follow the active light/dark theme; this preserves onboarding continuity without breaking in-app theme expectations.

- Keep Yearly/Weekly plan selection pinned beside the purchase CTA while film/benefits scroll; both choices stay visible on short phones.
- Use one localized Bible/Prayer sacred-pause route with bundled Bible chapters and independent local progress; switching modes must never dismiss the native guard handoff.
