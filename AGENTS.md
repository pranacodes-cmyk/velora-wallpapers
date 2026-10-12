# Project Architecture

- Keep the full Bible reader as a pushed Today/Settings destination with shared book-wise compressed licensed texts, local verse-position preferences, likes and private notes; this preserves primary tabs and bounds offline memory usage.
- Keep trial transition colors scoped to the midnight onboarding palette and time its cancellable haptics to the switch/check beats; global light theme must never alter this handoff.

- Keep matching web/Flutter bottom navigation Today, Wallpapers, Journeys, Quiz; expose Shield as a pushed Settings destination so it remains available without occupying a primary tab.
- Arm prayer alarms from the onboarding Rhythm choice on its explicit Continue tap, and reuse alarm controls in Today and Settings for all subscription tiers; never schedule merely from viewing a slide, preserving explicit user opt-in.
- Generate Flutter translations from the web dictionaries, retaining every key family used by restored Flutter screens so raw localization keys can never reach the UI.
- Build Flutter localization from bundled English + selected language, then accept only non-empty, non-literal OTA values so stale content can never expose raw keys.
- Sync native Android reminder copy from Flutter's active dictionary so scheduled lock-screen UI follows in-app language changes.
- Prototype major onboarding concepts in the web preview first, then mirror the approved interaction and composition in Flutter so both remain visually aligned.
- Produce standalone PrayScreen feature films as deterministic 9:16 Remotion compositions; frame-controlled UI motion keeps the product interaction and copy exact.
## GitHub Actions releases
- Keep the GitHub repository public only while an explicitly requested workflow runs, then restore private immediately; this avoids private-runner billing failures.
