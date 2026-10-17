- [x] Add Pro-only bonus challenges (7-day Gratitude, 7-day Courage, 14-day Peace) with locked teaser + paywall for free users, calendar-gated daily missions and localized copy in 8 languages on web and Flutter; web flows verified in browser, Flutter awaits an approved build.
- [x] Match Flutter Home gift to web Lucide shape/colors, pair message surface/text in both themes and scoped paywall, remove Redo Onboarding from both Settings; source tests and web Settings verified.
- [ ] Verify gift and message contrast on a Flutter device (blocked: requires an explicitly approved build).
- [x] Implement localized Bible reader in web and Flutter with feed/chapter modes, typography, likes, sharing and private notes; web language switching and persistence verified.
- [ ] Add licensed Indonesian Old Testament (current clearly labelled edition is New Testament only).
- [x] Lock trial transition to onboarding colors and add timed haptics in web and Flutter.
- [ ] Compile Flutter reader and verify typography/haptics on physical devices before an approved release.
- [x] Move Shield to Settings, restore Journeys navigation, and replace its onboarding slide with classic alarm options and the original alarm sound for Free and Pro in web and Flutter.
- [ ] Fix all Flutter localization-sensitive overflows across all 8 languages
- [ ] Fix Flutter language switching so every screen updates immediately
- [x] Restore Flutter Journeys and Bible Chat translations across all 8 languages
- [x] Open the Journeys catalogue from its Home card instead of a bottom tab or direct day
- [ ] Fix Today mockup text overlap at all supported sizes/font settings
- [x] Lock Flutter Today mockup sizing to the approved 384px web composition on tall Android screens
- [ ] Remove Flutter mockup carousel swipe jank
- [ ] Verify Flutter checks and screenshot-sensitive layouts
- [x] Push latest code to GitHub main
- [x] Make Daily Verse apply confirm Android picker success and roll back today's unlock on cancel/failure
- [x] Match native Daily Verse indexing to Flutter's 1-based day calculation
- [x] Keep guarded apps blocked until Prayly actually resumes after the Sacred Promise CTA
- [x] Keep the Shield overlay until Prayly or Home is actually foregrounded; remove the unsafe grace window
- [x] Add Shield service restart recovery and fail-safe Home handling if overlay permission disappears
- [x] Add a clear tap-to-open instruction to the Redmi Shield fallback notification
- [x] Fix Redmi Daily Verse picker false-cancel rollback and use Flutter's exact verse dataset natively
- [x] Wait for Redmi WallpaperManager state propagation before reporting Daily Verse apply failure
- [x] Restore the proven Capacitor Daily Verse picker flow in Flutter without OEM result-code verification
- [x] Push the latest Flutter app to Play Internal Testing using the saved token, then restore the repo private
- [x] Prevent stale Flutter translation bundles from exposing raw onboarding keys
- [x] Prevent raw localization keys across Flutter Today, Journeys, reader, and Bible Companion
- [x] Show a readable prayer before the Shield unlocks guarded apps
- [x] Localize the Flutter daily prayer reminder card, notification, streak, and Settings copy

- [x] Build one-slide interactive PrayScreen onboarding mockup in web preview: icon tap → Shield → verse → prayer → unlock → app opens; use Astra-generated scene/copy.
- [x] Replace the artificial PrayScreen demo with an original Prayly visual: realistic feed, cinematic prayer, and native-feeling motion.

- [x] Optimize and verify new PrayScreen images.
- [x] Push latest code and run Play Internal build.
- [x] Restore GitHub repository private immediately after the workflow finishes.

- [x] Repair Flutter PrayScreen onboarding and ship corrected Play Internal build for device verification.

- [x] Refine the 60% offer treatment into a compact premium ribbon in Flutter and web.

- [x] Create and render a professional 9:16 PrayScreen feature video: app tap → blocker → prayer → Amen → intentional feed.
- [x] Remove Replay Welcome Tour from Settings in web and Flutter.
- [x] Restore Settings onboarding replay in web and Flutter for visual review without clearing user data.
- [x] Generate three Jesus-and-child heaven-gate visual concepts for paywall review; wait for selection before video and paywall replacement.
- [x] Push latest code and upload the new Flutter build to Play Internal Testing, then restore the repository private.
- [x] Reduce only the Home cross preview movement by 20% in web and Flutter.
- [x] Prayer bell: swipe/ignore returns every 20 min (max 6) until Pray/Dismiss; Close renamed Dismiss (Flutter Android).
- [x] Set balanced, attractive regional Yearly and Weekly prices in all 174 Google Play markets; verify Monthly, legacy cohorts and yearly trial untouched.

- [x] Sync latest code and upload the new Flutter build to Play Internal Testing, then restore the repository private.

- [x] Redesign the paywall around the approved Jesus-and-boy film in web and Flutter; preserve Yearly/Weekly purchases and onboarding replay.
- [x] Move prayer alarms below Daily Prayers, restore audible alarm playback, and add four rotating paper-cut lock-screen scenes.
- [x] Ask for notifications after the first paywall closes, add one localized Home retry, and localize overflow-safe prayer lock screens and paywall copy across all 8 languages.
- [x] Refine paywall plan controls and typography, with polished in-app light-theme parity in web and Flutter.
- [x] Remove Replay Welcome Tour from Settings in web and Flutter for the new Play Internal build.
- [x] Upload the latest signed Flutter build to Play Internal Testing, verify success, then restore the repository private.
- [x] Use the existing saved GitHub token release path rather than adding a new connector.

- [x] Refine cinematic paywall spacing, typography and CTA in web/Flutter; accelerate video startup and verify preview.
- [ ] Verify native paywall playback and layout on a device after the next explicitly approved Flutter build.
- [x] Keep Yearly/Weekly visible above a compact paywall CTA; include accurate Bible benefits in web/Flutter.
- [x] Add localized Bible/Prayer blocker switch with continuous chapters in web/Flutter.
- [x] Remove duplicate Home Bible entry while preserving Bible navigation.
- [x] Replace the Home Bible Chat card with Prayly Shield in web and Flutter.
- [x] Sync latest changes and release Prayly 1.0.1199 (30100164) to Play Internal Testing; verify workflow and upload success, then restore GitHub repository private.

- [ ] Verify native blocker mode handoff, chapter scroll and layout on a physical device after an explicitly approved Flutter build.
- [x] Correct paywall empty space and currency-neutral trial copy in matching web/Flutter layouts; web verified at 384×576 and 384×824.
- [x] Audit released bundle size, remove Vungle from both Android targets and exclude 25 redundant assets (2.992 MB compressed in released bundle); preserve subscriptions and offline Bible.
- [x] Remove duplicate Flutter Home notification card.
- [ ] Verify cleaned Flutter build size, native paywall and frame performance after an explicitly approved CI build; no native build requested for this audit.
- [x] Gift tap opens Life Calendar wallpaper preview, app name and Install action in matching web/Flutter; web preview and exact Play listing verified, native store launch awaits approved device build.
- [x] Cancel requested Play build before store upload and restore repository private; do not restart without approval.
- [x] Release Prayly 1.0.1201 (30100166) to Play Internal Testing; run 38260726966 and store upload succeeded, GitHub repository restored private.
- [x] iOS release unblocked: Flutter iOS project + TestFlight workflow in the old iOS repo (working Apple key) — see iOS section below.

## 75 Days of Light challenge (replaces Journeys)
- [x] Replace Live it with the approved 75 practical missions and why-it-matters copy; all eight language packs independently edited, exact Flutter parity and placeholders tested, web layouts and completion/reload verified.
- [ ] Verify practical Journey mission screens on a physical Flutter device after an explicitly approved build (blocked: build approval required).
- [x] Replace mismatched Journey scene and lamb with a cohesive cinematic banner; matching web/Flutter assets and geometry verified, 76 route positions inspected and saved-progress arrivals checked at 0/30/60/75 days in phone preview without runtime errors. Native device check remains blocked on approved build.
- [x] Move lamb info outside artwork with matching quiet controls in web/Flutter; preview-only reset verified at language selection, hub/help checked at 384×624 without page errors.
- [x] Add compact name/DP setup after Begin Journey, with selected-avatar preview and no repeated friend-profile prompt in web/Flutter; web save, cancel/retry and invite handoff verified. Native device verification awaits approved build.
- [x] Replace human avatar concepts with 12 original Christian mascot DPs, matching selection and crew displays in web/Flutter; web selection, real profile saving and image loading verified. Native verification awaits an approved build.
- [x] Add Ecclesiastes 4:9 to invitation cards/shared text and six verified crew rules in all eight web/Flutter locales; mobile help and actual invitation text verified.
- [x] Add localized step/milestone/crew info sheets and an inviting friends block in web + Flutter; web help and invite-form interactions verified at mobile and desktop sizes.
- [x] 75-day NT plan, four daily steps, translations in 8 languages, reminders, crews backend, web + Flutter parity.
- [x] Make reflection optional: day lights after Read/Pray/Live, post-lit reflection still savable, counts and stones reflect actual progress (web + Flutter).
- [x] Redesign Journey as the approved Island Route: ship sails toward the cross, islands every 15 days, steps, crew race, logbook, celebration (web + Flutter).
- [x] Journey becomes the fourth bottom tab; Quiz opens from Home (web + Flutter).
- [x] Crew race groups close markers (+N); simpler crew progress header.
- [x] Island numbers fade while the ship covers them; island 30 label sits beside its marker.
- [x] Home card progress text fits 360dp phones; finished-journey buttons stacked.
- [x] Ship arrival fires only after a real sail (no stray vibration); reduced motion still records arrival.
- [x] Remove old lamp/task/hero images from Flutter.
- [x] Remove dead old-Journeys screens, data files, cover images and translations from Flutter (~5 MB raw; no startup parse).
- [ ] Device-check Journey reminders and lamb walk animation after an explicitly approved build (blocked: needs build approval).
- [x] Fix Journey reminders to automatic 7 AM / 9 PM local times, remove reminder controls, and compact all Journey pages in web + Flutter.
- [x] Refine the Journey intro with architectural double borders, ringed icons, section rules and clearer depth in web + Flutter.
- [x] Simplify Journey into an Apple-style hierarchy with quiet surfaces, compact steps and a segmented path choice in web + Flutter.
- [x] Remove crews entirely from Journey in web + Flutter (crew screens, cheer cards, header button, crew rules); intro step 3 rewritten as share-your-progress copy in all 8 locales; hub verified crew-free.
- [x] Align steps counters with optional reflection: hub/day/home show "of 3" with required tasks only in web + Flutter, 8 locales; type-check and browser check clean.

- [x] Replace old Journey art with approved Alpine day/night and separated lamb; trace the actual route in web/Flutter and verify movement. Full artwork framing preserves Cross and feet; actual web hub return walk and arrival verified.
- [x] Redesign Journey hub, intro and Home artwork presentation in web/Flutter: refined day/night Alpine scene without overlays, external progress, simplified daily steps and quiet invite. Web phone/desktop, help, task navigation and saved walk arrival verified; native device checks remain blocked on approved build.
- [x] Replace boxy/night Journey art with wide daytime scenery and an away-facing lamb in matching web/Flutter; traced road checked visually, phone light/dark and desktop layouts verified, actual saved-progress walk arrived without runtime errors. Native device verification awaits an approved build.
- [x] Fix Flutter daily quiz navigation with route-local start intent; checklist, reflection and prayer paths checked with four passing source-contract regression tests. Native end-to-end verification requires an approved Flutter CI/device run (Flutter SDK unavailable here).
- [x] Replace photographic Journey banner with reference-inspired illustrated scenery and matching shadow-free lamb; retraced all 76 day positions on the actual road, checked phone/desktop saved-progress arrivals at 0/30/60/75 without page errors, mirrored assets/geometry to Flutter. Native verification awaits an approved build.
- [x] Journey redo: new dawn scene + standing/walking lamb poses synced to the road (web + Flutter)
- [ ] Verify new lamb walk on a physical device after an explicitly approved Flutter build.

- [x] Journey Buddy: invite code join, buddy progress, Pray for friend (web + Flutter)
- [ ] Verify Journey Buddy on device after an approved Flutter build
- [x] Add a cinematic Journey buddy walkthrough and visible Pro badges in web + Flutter; preview local data reset for review.
- [x] Refine the three-slide Journey tour: lamb toward the Cross, merged invitation/shared road, milestone badges and prayer encouragement; remove Skip/close, mirror Flutter and verify all eight web languages.
- [ ] Verify Journey walkthrough and Pro buddy badge on a physical device after an approved Flutter build.

## Pro Journeys
- [x] Deepen all 56 Pro Journey days with full relevant chapters, distinct substantial teaching, private reflection and guided practice/mission in eight languages; reveal stages only inside sessions in matching web/Flutter. Four web completion flows and eight-language screens verified; 18 regression tests pass. Native-speaker review and Flutter device checks remain separately blocked below; no release requested.
- [x] Replace the shallow Pro bonus list with four researched Pro Journeys (Who God Says I Am 7d, Fear Not 14d, Break Free 21d, Prayer Warrior 14d): daily Word → Practice → Mission, free Day 1, cinematic covers, 8 languages (web).
- [x] Mirror Pro Journeys in Flutter (shelf, detail, three-beat day, breath prayer, Stand Firm rescue, prayer list, battle plan, celebration) with the same storage.
- [x] Release the Pro Journeys build to the Play internal track (v1.0.1205, code 30100170; commit fdd4a536; repo back to private).
- [ ] Native-speaker review of the Pro Journeys copy in hi/es/pt/fil/id/fr/de (blocked: needs a qualified reviewer).
- [ ] Device-check Pro Journeys after the internal-track build (blocked: needs the user's phone).
- [ ] Optional reminder for an in-progress Pro Journey within the existing 4-a-day notification cap (idea; needs user approval since notifications were deliberately reduced).
- [ ] Show the Pro Journeys shelf before the 75-day path is started (today it appears only inside an active Journey; idea, needs user approval).

## Alarm ringing-screen fix
- [x] Fix alarm: notification Dismiss/Open now silences + closes the ringing screen, volume keys mute instantly, back/power stop it, auto-stop at 60s (web parity n/a; Flutter/native Android only).
- [x] Pushed to GitHub main (commit cd26e67); repo back to private.
- [x] Play build for the alarm fix shipped (v1.0.1208, now in production).
- [ ] Device-check the alarm on a phone (needs the user's phone with v1.0.1208).


## iOS Flutter app (replaces old Capacitor App Store build)
- [x] Flutter iOS project (same bundle ID, iPhone + iPad, app iOS 15+, widgets iOS 16+), Android project untouched
- [x] Native iOS bridge: wallpaper channel (save to Photos, daily verse state), reminders/alarms via local notifications, Shield/live/3D/Life Calendar hidden on iOS
- [x] On-device daily wallpaper renderer (same 20 photos + verse selection, content below lock-screen clock); in-app preview uses the same render
- [x] Shortcuts action "Get Today's Prayly Wallpaper" + in-app one-time automation guide (8 languages)
- [x] Home Screen widget (photo + verse, 3 sizes) and Lock Screen widgets (verse, streak) sharing the old App Group
- [x] RevenueCat App Store key, ATT prompt at start, Meta/RevenueCat ad-ID after ATT, Apple-native rating only on iOS
- [x] App Store compliance: privacy manifests, paywall Terms(EULA)/Privacy links + renewal disclosure, Apple wording in legal pages on iOS
- [x] First TestFlight upload: 1.0.23 (29868253) processed VALID, in internal testing (fixed Apple ITMS-90626 intent wording + ITMS-90683 microphone APIs)
- [ ] Real-device check of Shortcut automation, widgets, purchase/restore and ATT on TestFlight (needs the user's iPhone)
- [ ] App Store submission of the new version (screenshots/review notes in App Store Connect; after TestFlight approval by the user)
- [ ] AdMob on iOS (blocked: needs iOS app + ad unit IDs created in the AdMob account)
- [ ] AlarmKit real alarms on iOS 26 (next step after first TestFlight)

## Purchase / trial tracking cleanup
- [x] Recheck the historical saved-token release path against successful releases on October 14–15: both used GITHUB_PUSH_TOKEN and flutter-play-store.yml; no alternate GitHub backend dispatcher or CLI credential is available in this sandbox. All 32 tracking regression tests pass.
- [x] Ship the approved Flutter tracking-fix build to Play Internal Testing using the existing saved-token release path, then restore repository private: 1.0.1210 (30100175), run 39035962023 succeeded and Play upload passed; repository private verified. Fixed the host's missing Meta core compile dependency to match the installed plugin's SDK range; 32 tracking regression tests pass.
- [x] Retire custom webhook forwarding and block client conversion sends, including old-client requests at the live server; disable automatic SDK IAP logging in native configs and preserve explicit activation.
- [x] Separate trial checkout success from paid checkout/revenue in PostHog on web and Flutter; trial has zero price and catalog price is not revenue.
- [ ] Verify RevenueCat built-in Meta enabled state and event mappings (blocked: dashboard-only configuration is not readable through available integration API).
- [ ] Verify install/open, real trial, paid conversion and renewal receipt on device (blocked: requires the user's device on internal build 1.0.1210 and real store/test receipts; compilation and upload alone do not prove Meta receipt).

## Live Photo wallpapers on iOS
- [ ] Live Photo wallpapers on iOS (deferred until explicitly requested).
