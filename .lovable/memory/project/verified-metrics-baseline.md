---
name: Verified metrics baseline (Play + PostHog)
description: Ground-truth numbers and correct query methods for ANR, cold start, ASO dates — do not repeat past misreadings
type: reference
---

## Hard rules for any analytics claim

- ANR/crash: judge only the **28-day weighted user-perceived rate**, never a single day. Play's `distinctUsers` is rounded to hundreds, so one ANR on a 100-user day shows as 0.87% and means nothing.
  - Verified 2026-09-08 (28d window Aug 6 – Sep 2): **user-perceived ANR = 0.27%**, crash = 0.03%. Play bad-behaviour thresholds: ANR 0.80%, crash 1.09%. We are ~3x BELOW the limit. Never again claim we cross the ANR threshold without recomputing the 28-day weighted rate.
- Cold start: on build 1.0.1160 `first_contentful_paint_ms` / `first_paint_ms` are **null** (paint entries unavailable in that WebView). `perf_content_ready.duration_ms` and `perf_severe_stall.duration_ms` are also unreliable/null there (backgrounded sessions produce 20s–110s garbage values).
  - Use `perf_cold_start.dom_interactive_ms` as the valid proxy, filtered to the live `native_version`.
  - Verified 7d on 1.0.1160: PH avg 1.78s / p90 1.88s, US 0.57/0.99, ZA 0.98/1.68, NG 1.03/2.05, BR 1.59/3.32, GB 0.41/0.57, KE 1.14/1.72. App is fast on the live build.
  - Old builds are what looked slow (1.0.1149 FCP avg 12.8s, 1.0.1158 5.2s). Never mix builds in one performance number.
- Always exclude: `coalesce(properties.is_bot,false)=false` and `$geoip_country_code != 'IN'` (India = owner's own test device).

## ASO timeline (do not misdate)

- ASO pass 1: 2026-08-16 — wallpaper-led titles ("Prayly: Jesus Bible Wallpaper"). Gave a freshness install spike (DAU 121–132, installs 56–65 on Aug 20/22) but low-intent traffic and weak retention.
- ASO pass 2: **2026-09-01 live push** — intent-first ("Prayly: Bible Verse & Prayer"), verse/prayer/devotional/journeys first, wallpaper last, all 8 locales incl. long descriptions.
- Result so far (Sep 1 → Sep 8, ex-India, ex-bot): DAU 62 → 44, installs 13 → 5. Install volume fell as intended (cheap wallpaper volume removed), but quality traffic has NOT yet replaced it. Judge again ~Sep 12–15.

## Tooling (so this is never re-derived)

- Play data: `POST https://jbwhlogvldhsnxtpxwih.supabase.co/functions/v1/play-console` with header `x-diag-key: pk_diag_9f4c2ab71e6d48b0a35c7e21d0f9b6c4`, body `{"action":"vitals"|"subscriptions"|"offers"|"listing"|"voided","days":28}`.
- PostHog HogQL: `GET https://jbwhlogvldhsnxtpxwih.supabase.co/functions/v1/posthog-query?q=<HogQL>` (no auth needed).
- Live build at 2026-09-08: native `1.0.1160`, versionCode `30100126`; OTA floor is 1161.
