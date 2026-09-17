---
name: Play Store ASO
description: Live Play listing strategy, ASO version history, keyword targets, push workflow, locked assets rule
type: feature
---

# Play Store ASO

Source of truth: `supabase/functions/play-console/listings.ts`.
Push: edge function `play-console`, action `pushListing` (`dryRun` defaults true),
authorized with header `x-diag-key` = one of the `PLAY_DIAG_KEY*` / `PLAY_PUSH_KEY`
secrets. Text-only — never touches icon, screenshots, feature graphic, tracks.

## Locked assets
Play Store icon, screenshots and feature graphic are LOCKED (42% CTR / 51.9%
conversion). Never redesign or swap them.

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
