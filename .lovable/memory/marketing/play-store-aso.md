---
name: Play Store ASO
description: Live Play listing strategy, ASO history, keyword targets, and redesign-era screenshot/description plan
type: feature
---

# Play Store ASO

Source of truth: `supabase/functions/play-console/listings.ts`.
Push: edge function `play-console`, action `pushListing` (`dryRun` defaults true),
authorized with header `x-diag-key` = one of the `PLAY_DIAG_KEY*` / `PLAY_PUSH_KEY`
secrets. Text-only — never touches icon, screenshots, feature graphic, tracks.

## Store assets
The current icon, screenshots and feature graphic previously delivered 42% CTR
and 51.9% conversion. Keep them unchanged until the redesigned app is final.
Then replace the screenshots and rewrite the descriptions to represent the new
experience. The icon and feature graphic remain locked unless separately asked.

## Version history
- ASO-1 (Aug 16 2026): wallpaper-led titles. Install spike, wrong intent, weak US retention.
- ASO-2 (Sep 1 2026): repositioned to Bible verse / prayer / devotional intent, 8 locales.
- ASO-3 (Sep 10 2026, edit 12196983773520573764): maximised every indexed field,
  but incorrectly removed the brand from store titles.
  - Never remove "Prayly" from the app title. The canonical English Play Store
    title is `Prayly: Bible Prayer & Verse` (28/30 characters).
  - Short descriptions 69-78 of 80 chars, distinct tokens only.
  - Full descriptions 2.3-3.7K of 4000 via per-language long-tail + FAQ tails.
  - Locales 8 -> 17: added en-GB, en-ZA, en-IN, en-SG, pt-PT, es-ES, it-IT, pl-PL, sw.
- Sep 12 2026 (edit 06842090289863035616): restored Prayly at the front of all
  17 localized titles and published them live. This is the latest listing push.

## Keyword anchors (Semrush)
us: bible verse of the day 246K, verse of the day 201K, daily devotional 135K,
daily bible verse 110K, morning prayer 60.5K | avoid "bible app" (KD 92).
br: versiculo do dia 550K, palavra do dia 450K, devocional diario 90.5K, oração da manhã 90.5K.
ph: bible verse 165K, verse of the day 74K, gospel for today 74K, panalangin 14.8K.
it: vangelo del giorno 135K (KD 47), preghiera del mattino 60.5K (KD 14), versetto del giorno 2.9K.
in: jesus images 74K, bible verse of the day 33.1K, bible in hindi 9.9K.

## Open conversion issue (not ASO)
Zero trials for 9+ days despite traffic. Regional weekly/monthly/yearly prices
exist in 173 Play regions, but the paywall only maps `$rc_monthly`, `$rc_annual`,
`$rc_lifetime` — no weekly package is shown. Weekly visibility is the next
conversion lever and needs a `$rc_weekly` package in the RevenueCat offering.

## Sep 24 2026 post-mortem (PostHog, ex-IN, ex-bot, new users/day)
- Jun 14–Jul 18: 400–900/week — NOT organic (paid era, PH-heavy, ~14 yearly buys). Organic baseline after that: ~8/day.
- ASO-1 wallpaper (Aug 16–31): ~30/day organic (best). ASO-2/3 verse/prayer: ~12–17/day.
- Ad-looking spikes, exclude: Sep 9 (PH), Sep 17–18 (US+ZA), Sep 23 (US).
- Last purchase_completed Sep 4. Sep 6–24: 63 purchase_started, 56 cancelled, 0 completed → Play sheet opens, users back out. Trial/offer problem, not ASO.
- Lesson: dropping "wallpaper" from title/short halved installs; head terms (bible verse of the day KD60, daily prayer KD69, bible app KD92) are unwinnable for a small app.
- ASO-4 DRAFTED in listings.ts (Sep 24, NOT pushed — wait for user go). User chose Option A: MORNING PRAYER-led (not wallpaper — wallpaper traffic = cheap, non-paying, seen in Aug). en title `Prayly: Morning Prayer & Verse` (morning prayer 60.5K/mo KD39). Order: morning prayer → Shield → lock-screen verse → wallpaper secondary. NIV/ESV + fake language claims removed (KJV only, 8 languages).
- ASO-4 PUSHED LIVE Sep 24 2026 (edit 04106805972943752754), all 17 locales. Short desc: "focus shield" (0 volume) swapped for "app blocker"; EN FAQ adds block Instagram/TikTok/YouTube + reduce screen time. Do not touch listing for 2-3 weeks.
- New Morning Prayer/Shield screenshots + banner LIVE Sep 24 2026 in all 17 locales (pushed one locale at a time, verified 1 banner + 8 shots each). Icon untouched. Don't touch listing/images for 2-3 weeks. Never run parallel Play edits (they delete each other + burn quota).
