---
name: PrayScreen competitor teardown
description: Full APK teardown of com.fkr.prayscreen (dedicated Christian app-blocker) — funnel, blocking mechanics, monetization, SDK stack; benchmark for Prayly's PrayScreen feature
type: reference
---

Source: user-uploaded `PrayScreen.apk` (17 MB), package `com.fkr.prayscreen`, compileSdk 35, Jetpack Compose single-Activity app. Site: prayscreen.com.

## Blocking mechanics (important correction to earlier assumption)
- Uses **AccessibilityService** (`typeWindowStateChanged`, notificationTimeout 100), NOT UsageStatsManager. Play-approved with a hard in-app **Disclosure screen + consent checkbox + Opt-Out button** ("accesses app usage data through Android's Accessibility permission").
- Permissions: `SYSTEM_ALERT_WINDOW`, `QUERY_ALL_PACKAGES`, `POST_NOTIFICATIONS`, `VIBRATE`, `com.android.vending.BILLING`, `AD_ID`. `<queries>` explicitly lists Facebook/Instagram/FB Lite packages.
- Overlay = `WindowManager` `TYPE_APPLICATION_OVERLAY` (2038), FLAG_NOT_FOCUSABLE style flags, hosts a **ComposeView with its own lifecycle + savedState owner** — full Compose UI over the blocked app.
- Unlock is a **time gate**: `LocalDateTime unlockUntil`, `now().isAfter(unlockUntil)` → re-block. Blocked package list held in memory in the service.
- **Schedule-based, not per-open**: "Your apps will now be blocked at 12AM, 5AM, 12PM, 6PM. You need to do a prayer to unlock them." One prayer per window unlocks all blocked apps until the next reset (`PrayerResetTime`, `PrayerResetTimeChanged`).

## Onboarding funnel (nav graph `OnboardingGraph`)
Splash → Intro (3 slides) → Survey → PreparingPlan → Testimonial → SelectApps → InitialPaywall → FinalPaywall → AbandonedCart → OnboardingPrayerGraph (Prayer → Paywall → Success).
- Intro copy: "Social media addiction is taking you away from God." / "Pray Screen can help you get back on your spiritual journey!" / "It's simple. Once a day, you pray to unlock your apps." CTA "Get Started", "How it works".
- Survey fields sent to backend (`SaveOnboardingPayload`): `gender`, `age`, `denomination`, `prayerFrequency`, `preventingGoal` (+ `deviceId`). Events: OnboardingGender/Age/Denomination/PrayFrequency/GoalPreventions/Goals/Reviews/DemoAppSelected/OtherApps.
- **Three paywall slots** in onboarding: BEFORE_ONBOARDING, default/InitialPaywall, FinalPaywall, plus **AbandonedCartPaywall** on skip. Each has Presented + Skipped events.
- First prayer is part of onboarding: "It's time for a prayer. Let's go!" → "Let's Pray" → 5-second dwell → "I've prayed today 🙏" → Success + reflection (skippable, `OnboardingReflectionSkipped`).

## Freemium / ad loop
- Free path copy: **"Pray Screen Free — Watch a 15 seconds video to support and continue using for free. You will see your prayer after. God Bless!"** Button: **"Watch Video & Pray 🙏"**. Premium button: **"No More Ads 🚫"**, "Join Pray Screen 🙏".
- Ad slots are named and tracked: `AdsPopupOnboardingShowAd`, `AdsPopupOne(ShowAd/SubscribeClicked)`, `AdsPopupTwoShowAd`, `AdsOnboardingAbandonedCart` — i.e. ad popup screens double as paywall upsell surfaces.
- So: **rewarded/interstitial video gates the prayer, prayer gates the apps, subscription removes the ads.** No per-unlock minute timer — the reset windows do that job.

## Content + backend
- Backend `https://infra.prayscreen.com/prayscreen/`. Endpoints: register device (`deviceId` only — no login/account), save onboarding, get daily prayer (`prayerId`, `prayerText`), save/get reflections (`reflectionPreview`, `submissionTime`), environment content.
- Anonymous device-ID identity, prayer text served remotely (live-editable), TTS intent queried for read-aloud, ExoPlayer/Media3 bundled for video.
- 32 locales via `localeConfig` + in-app language picker.

## SDK stack
- **Adapty** (paywalls + subscriptions, remote paywall builder — that's why no paywall copy in the APK), **AppLovin MAX** (ads incl. Amazon/mediation), **Amplitude** (product analytics), **AppsFlyer** (attribution, af_subscribe / af_projected_revenue), **Sentry** (crash, traces 1.0), Google Play Billing, Firebase encoders.

## Home / settings surface
- Home: "Apps You Blocked 🙏", Blocking Schedule card, Give Access (permission repair), "Thank you for trusting us" share prompt ("Check this out! It makes me pray everyday before using social media apps"), Force Block Apps (resets prayer status immediately).
- Settings: Language, Apps Linked with Pray Screen, User Status, Share, Contact Us, Privacy, Terms. No account, no restore-purchase screen beyond Adapty.

## Takeaways for Prayly
1. Schedule-reset unlock (4 windows/day) is far less annoying than per-open blocking and still forces daily prayer — adopt this, not per-launch walls.
2. AccessibilityService + disclosure/consent screen is the Play-safe pattern they ship in production.
3. Multi-slot paywalls (before onboarding, initial, final, abandoned-cart) + ad popups that also sell the subscription.
4. Survey (denomination/prayer frequency/goal) exists mainly to personalize the plan screen and raise perceived value before the paywall.
5. Anonymous device-ID backend, remote prayer text, reflections journal — no login friction at all.
