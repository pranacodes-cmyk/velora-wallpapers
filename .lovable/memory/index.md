# Memory: index.md
Updated: now

# Project Memory

## Core
App name is "Prayly"; never remove it from store titles. Canonical English title: "Prayly: Bible Prayer & Verse".
Dark & Majestic theme: Deep Midnight Navy bg, Royal Gold primary, Deep Royal Blue accent.
Visuals of Jesus must be majestic/triumphant; never crying/suffering.
Meticulous Apple-level visual polish over bulk features. Craft in parts.
Omit titles/subtitles in previews to maintain focus. Auto-clean slug prefixes.
Workspace policy: pull assets from R2, delete local rendered videos.
Analytics rule: ANR judge only 28-day weighted rate (0.27%, limit 0.80% — we are fine). Cold start on 1.0.1160 must use dom_interactive_ms, not FCP (null there). Always exclude is_bot + India. See verified-metrics-baseline before quoting any number.
Always push every code change to GitHub main with GITHUB_PUSH_TOKEN via the GitHub API (git push blocked). No APK/workflow unless asked. See github-push.


## Memories
- [Brand Identity](mem://project/identity) — Core brand identity, color palette, and thematic constraints
- [UI Design System](mem://style/ui-design) — Core UI components, glassmorphism styling, and layout rules
- [Admin Tools](mem://features/admin-tools) — Admin hub at /test for bulk ingestion and asset management
- [Bible Quiz](mem://features/engagement/bible-quiz) — Polished trivia game mechanics, ad strategy, and local storage keys
- [Gamification Mechanics](mem://features/engagement/gamification-mechanics) — Engagement features including streaks and favorites
- [Localization (i18n)](mem://features/i18n) — Custom i18n engine, 7 languages, screen-pack layout, translation quality rules
- [Platform Support](mem://features/platform-support) — Web browser fallback for wallpaper downloads
- [Devotional Audio](mem://features/engagement/devotional-audio) — 365 prayers, AI narration, and ambient music integration
- [Asset Fallback](mem://features/ui-resilience/asset-fallback) — Runtime fallback for corrupt live wallpaper thumbnails
- [Remotion Setup](mem://project/infrastructure/remotion-setup) — Manual binary adjustments for Remotion compositor on Linux
- [Lean Workspace](mem://preference/workspace) — Keep local environment clean of generated assets
- [Marketing Ads](mem://marketing/ads) — Video production standards, hooks, and creative styles for ads
- [Play Store ASO](mem://marketing/play-store-aso) — ASO history, 17 locales, live push dates, and redesigned-app screenshot/description plan
- [Daily Verse Offline Cache](mem://features/daily-verse-offline) — Pro auto-update with Doze-proof local cache; free users gated by rewarded ad
- [Verified Metrics Baseline](mem://project/verified-metrics-baseline) — Ground-truth ANR/cold-start numbers, ASO dates (Aug 16 + Sep 1), and exact Play/PostHog query methods
- [Flutter Parity Rule (STRICT 100%)](mem://preference/flutter-parity) — Always implement Flutter first, then mirror it pixel- and behaviour-identically in the web preview
- [PrayScreen Competitor Teardown](mem://marketing/prayscreen-competitor-teardown) — Full APK teardown of com.fkr.prayscreen: AccessibilityService blocking, 4-window prayer reset, ad-gated prayer, Adapty/AppLovin/Amplitude stack, onboarding survey funnel
- [PrayScreen Prayer Library](mem://marketing/prayscreen-prayer-library) — Their entire server prayer library is only 4 looping English prayers, no titles/audio/localization
