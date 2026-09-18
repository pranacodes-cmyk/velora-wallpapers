# Flutter rewrite (100% ditto parity with the web app)

## Phase 1 — Foundation
- [x] Flutter project scaffold (`flutter_app/`) with pubspec + lint rules
- [x] Design tokens ported from `src/index.css` (dark + light), Cormorant serif, glass + premium tile styles
- [x] i18n exporter (`bun scripts/export-i18n-flutter.mjs`) → all 8 languages as JSON assets
- [x] Core services: prefs (same storage keys), haptics, PostHog, Supabase, RevenueCat, native wallpaper MethodChannel
- [x] State layer (language, premium reconciliation, onboarding, user name, tabs)
- [x] Bottom nav bar ported 1:1 (glass pill, gold indicator, radial glow, 9px labels)
- [x] GitHub Actions workflow: Flutter debug/release APK artifact download

## Phase 2 — Core screens
- [x] Onboarding step 0 — language picker (`language_slide.dart`, native prompts/hints/CTA, one switch on Continue)
- [x] Onboarding controller (`onboarding_flow.dart`): 5 slides, 190ms nav lock, swipe back/forward, progress dots, gated gold CTA, replay key, completion analytics
- [x] Slide 0 Verse + LockScreenMock (200x400 frame, 10:08, 4 rotating verse/wallpaper pairs, glass card, gold badge)
- [x] Slide 1 Journeys (3 hue cards, accent bar, cross glyph, 7-bar equaliser)
- [x] Slide 2 Prayer (devotional bg, halo, prayer card + narration waveform, 3 feature pills)
- [x] Slide 3 Bible Chat (3-turn loop: ask 1.2s → typing 2.4s → reply, rotates 5.4s; chip, private badge, composer)
- [x] Slide 4 Focus (6 cards, gold picked state + check, one tap finishes after 240ms, writes `cw_user_focus`)
- [x] Storage keys aligned with web (`cw_onboarded_v3`, `cw_onboarded_v3_at`, `cw_onboarding_replay_active`, `cw_user_focus`)
- Note: the Time and Name slides in `OnboardingLateSlides.tsx` are dead code on web (flow is 5 steps, Focus is last) — intentionally not ported.
- Note: `flutter pub get` cannot reach pub.dev from this sandbox (TLS blocked), so the analyzer/compile check runs in the GitHub Actions Flutter build.
- [x] TrialReadyTransition (`trial_ready_transition.dart`) — gold switch flip, knob slide, check reveal, localized headline, reduced-motion respected
- [x] PremiumSheet (`premium_sheet.dart`) — hero + halo, rotating review card (7.5s), 6-benefit bento, urgency strip, yearly/monthly/weekly cards with trial badges + per-week anchor, trust strip, gold CTA with $0-today chip, per-day line, reminders, restore/terms/privacy footer, mission line; compact <740px & tiny <620px density, drag-to-dismiss, safe-area close button, live Play prices via RevenueCat offerings, same analytics events (paywall_shown / paywall_cta_tapped / purchase_started / purchase_completed / purchase_failed / purchase_cancelled), auto-close when premium turns on
- [x] Post-onboarding handoff (`post_onboarding_premium.dart`) — 3200ms transition → sheet mounts → 3460ms reveal, `cw_post_onboarding_premium_shown` written only on dismiss, idempotent handoff, premium users skip both
- [x] Today screen part 1: content data assets (verses, prayers, quiz, journeys, reflections, backgrounds),
      streak / today-tasks / user-profile / journey-progress stores (same storage keys as web),
      header + greeting + streak badge, 11-day verse hero carousel with phone mockups,
      daily checklist + progress ring, full-screen verse reflection, personalized journey card,
      premium nudge, 3-hour daily question card, footer
- [x] Today screen part 2a: prayer alarm service (MethodChannel + same storage keys, 21:00 migration,
      self-heal), Pro prayer toggle, per-slot alarm toggles with custom times, ParallaxRail
      (8 scenes, OneEuro + per-layer springs, 30fps cap, active±1 loading, shared EngravedOverlay),
      Bible Companion card, toast helper, parallax scene + cross-engraving data/i18n export
- [x] Parallax Preview screen: per-layer springs on tilt, whole-move scenes, swipe + arrows + dots,
      personalize pill, PersonalizeCrossSheet (name + verse picker, same keys), engraved overlay,
      gold apply CTA with paywall gate, native parallax wallpaper channel, glow colour
- [x] Share service (`share_service.dart`, 1:1 of `utils/nativeShare.ts`: app-link append, same
      `share_invoked` analytics, clipboard fallback) + ExitConfirmDialog wired to hardware back in the
      tab shell (non-Today tab → Today, Today → exit dialog)
- [x] Settings screen: premium card, profile name edit (same `cw_user_name` key), theme system/light/dark
      (`cw-theme` key, app-wide ThemeMode), 8-language grid, saved wallpapers row, Life Calendar promo,
      rate/share/restore/contact, privacy/terms, delete-my-data (clears all keys but `cw-theme` + mail
      intent), about expander, version footer from package_info
      - [x] "Manage Ad Preferences" row (UMP consent form, hidden where not required)
- [x] Devotional (prayer) screen: prayer slots + rewarded-ad unlock, daily-funnel store, ambient music
      fade-in, Ken-Burns backgrounds, rays/aura/embers, prayer card, Amen chip + counter, share,
      narration button (free pill → paywall, Pro auto-play), Continue → reflection handoff,
      escalating exit rescue (toast → FunnelExitModal), AI Personal Prayer sheet (8 topics, free
      lifetime quota 1, copy/share/save) wired to the `ai-pastoral` function
- [x] Today screen part 2b: verse wallpaper renderer (1170x2532 `dart:ui` canvas, 1:1 of
      `useVerseWallpaper.ts`) + image share/save, wired into the reflection sheet
- [x] Privacy Policy + Terms of Service screens (shared `LegalScreen`, 1:1 copy, wired from Settings)
- [x] Daily Verse screen (preview card, apply with rewarded-ad gate, auto-change Pro gate, pillars,
      verse packs picker: situation + mood groups, `jwbp_active_mood_pack_v1` key, native pack push)
- [x] Bible Companion chat (streaming `bible-companion` function, 5/day quota → paywall, history,
      markdown bubbles) wired from the home card
- [x] Favorites + saved wallpapers (static/live tiles, detail view, apply gating) wired from Settings
- [x] Wallpapers tab (live/photos/both feed, categories, search, favorites, feed banners + daily verse card)
- [x] Journeys tab (featured card, journey list, locked-day sheet, day flow)
  - Deviation: RichDayExperience multi-slide days + AI reflection/narration sheet pending
- [x] Quiz tab (hub, modes, question flow, revive, results, pro pack picker)
  - Deviation: simplified confetti, Material icons in place of a few lucide glyphs
- Note: web's `jn.featured.meta.hm` key is missing in the web dictionary too — parity kept

## Phase 3 — Wallpapers & media
- [ ] Static wallpaper feed, categories, search, detail/preview, favorites
- [ ] Live wallpaper feed + native apply flow
- [ ] Parallax rail, tilt preview (sensors), apply flow
- [ ] Devotional audio (365 prayers, narration + ambient), journeys, journey day, quiz packs

## Phase 4 — System & growth
- [x] Settings, privacy, terms, language picker, restore purchases
- [x] Native Android project for `flutter_app` (locked package `com.jesuswallpaperbible.app`, gradle +
      wrapper, manifest, copied wallpaper/alarm services) with three MethodChannel bridges wired in
      `MainActivity`: wallpaper (static/live/daily-verse + prefetch/cache/pack/premium), parallax
      (stage assets → live wallpaper picker), prayer_alarm (status/schedule/cancel/preview/settings)
- [x] AdMob parity: init at startup, warm interstitial cache, `primeInterstitial`, global 45s
      cooldown (`tryShowInterstitial`), fail-open rewarded, UMP privacy options form
- [x] 2-step Jesus-toned rating prompt (`rating.ts` port: same keys, throttles, in-app review +
      Play Store fallback, mailto feedback) wired to wallpaper apply, live/parallax apply, favorite
      added, journey day complete, quiz leave, daily verse apply, pack activation; paywall parks it
- [ ] Notifications / content push (reuse existing Java plugins)
- [ ] First debug APK via GitHub Actions + on-device QA pass (needs your go-ahead)
- [ ] Side-by-side parity QA pass (screen-by-screen screenshot diff vs web)

## Phase 5 — After parity
- [ ] Remove Bible Chat
- [ ] Prayer Lock (social-media intercept) feature
