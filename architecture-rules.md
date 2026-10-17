# Existing architecture rules

# Project Architecture
- Keep practical missions in a dedicated eight-language screen dictionary separate from chapter/prayer content, retaining the `live` completion ID to preserve saved progress and web/Flutter parity.
- Render Journey member avatars through shared web/Flutter mascot registries using existing emoji wire IDs and matching bundled portraits; preserves profile contracts.
- Reuse the circle profile flow after Journey's explicit start intent and start progress/reminders only after profile confirmation; existing identities bypass setup and cancelling leaves the intro retryable.
- Keep Journey help in localized sheets and completion-gated tours with versioned flags; avoid clutter and preserve saved days.
- Load the Life Calendar promotion on explicit gift tap using CDN-hosted official store screenshots; keep store launch behind Install and prefer Android market links with HTTPS fallback to avoid unexpected redirects.

- Keep the full Bible reader in bottom navigation and Settings (no duplicate Today button), with book-wise compressed licensed texts and local positions, likes and notes; avoids redundant entry points and bounds cache memory.
- Keep trial transition colors scoped to the midnight onboarding palette and time its cancellable haptics to the switch/check beats; global light theme must never alter this handoff.

- Keep web/Flutter tabs Today, Wallpapers, Bible, Journey; push Quiz from Home and Shield from Settings/Home. Pass Flutter daily-quiz intent through its route, not a shared notifier, to prevent duplicate pushes from retained Today widgets.
- Arm prayer alarms from the onboarding Rhythm choice on its explicit Continue tap, and reuse alarm controls in Today and Settings for all subscription tiers; never schedule merely from viewing a slide, preserving explicit user opt-in.
- Rotate the four bundled paper-cut prayer-alarm scenes by calendar day in the native lock-screen activity; deterministic local rotation keeps alarms instant and visually varied without network access.
- Export Flutter copy from web dictionaries; keep resolved keys and drop retired families to prevent missing copy and dead weight.
- Build Flutter localization from bundled English + selected language, then accept only non-empty, non-literal OTA values so stale content can never expose raw keys.
- Sync native Android reminder copy from Flutter's active dictionary so scheduled lock-screen UI follows in-app language changes.
- Prototype onboarding on web, then mirror approved visuals in Flutter for parity.
- Keep replay handling independent of Settings; hiding it must not clear progress or entitlements.
- Pair Flutter SnackBar surface/text tokens in both themes, overriding scoped paywall text; avoids unreadable inverse-surface defaults.
- Use shared Lucide geometry for the Home gift; preserves web/Flutter parity.
- Use deterministic 9:16 Remotion for PrayScreen films; preserve exact interaction and copy.
## GitHub Actions releases
- Keep the GitHub repository public only while an explicitly requested workflow runs, then restore private immediately; avoids billing failures.

- Keep the cinematic paywall presentation separate from store purchase/restore logic, using one CDN video with a poster fallback in web and Flutter; this preserves legacy entitlements and keeps media lightweight.
- Start buffering the paywall film when its view mounts, cache the native poster, and skip video initialization for reduced motion; this reduces startup delay without background playback or purchase changes.
- Keep the post-onboarding paywall in the midnight palette, while paywalls opened inside the app follow the active light/dark theme; this preserves onboarding continuity without breaking in-app theme expectations.

- Keep paywall content naturally sized with bounded scrolling and pin plan selection beside the purchase CTA; both stay usable on short phones.
- Bundle only AdMob ad-serving adapters in both Android targets; keep purchase and attribution services separate from ad mediation.
- Mirror Journey geometry/assets in web and Flutter: rear-facing lamb frames on traced quadratic road, perspective day spacing, road crop and external progress; keeps feet on-road and scenery clear.
- Keep Journey reminders automatic at 07:00 and 21:00 local time with no user-facing schedule controls; fixed cadence keeps onboarding and settings compact.
- Use one localized Bible/Prayer sacred-pause route with bundled Bible chapters and independent local progress; preserve native guard handoff.
- Journey buddies reuse the existing circle backend and sync progress plus a server-derived Pro display flag; each owner's circle code is their buddy code, with no new auth.
- Pro Journeys reveal full NT chapter→insight→practice→mission inside sessions only; preserve calendar-gated `word/practice/mission` IDs in `prayly_pro_journeys_v1` and use matching web/Flutter `prayly_pro_journey_study_v2` JSON for reading/notes, keeping saved progress intact.
## iOS (Flutter)
- Keep iOS behaviour in `flutter_app/ios` plus `IosPlatform`-gated Dart; never edit `flutter_app/android` for iOS work, so the live Play build stays untouched.
- Render the iOS daily wallpaper natively from bundled photos/verses (same selection as `ContentData`) and reuse that render for preview, Photos and the Shortcuts action; apps cannot set wallpapers on iOS, so Shortcuts automation is the only auto-change path.
- Share app↔widget state through the existing App Group `group.com.jesuswallpaperbible.app.shared`; provisioned for the app/widgets.
- Build iOS only via `flutter-ios-testflight.yml` on the old iOS repo's `flutter-ios` branch (working Apple key); push the app as `flutter_app.tar.gz` to stay under GitHub API content limits.
- Use CocoaPods (Swift Package Manager disabled in iOS CI) while google_mobile_ads lacks SPM support.
