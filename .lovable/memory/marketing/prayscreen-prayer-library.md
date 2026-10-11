# PrayScreen (com.fkr.prayscreen) — complete server prayer library

Fetched live 2026-09-20 from `https://infra.prayscreen.com/prayscreen/api/prayers/daily`.
Sequence advances only after `POST /api/reflections/save`; `prayerIndex` query param is ignored.

**Total library = 4 prayers, then it loops back to #1.** No localization (same English text for every language), no titles, no audio, no categories.

## Prayer 1 (`4be75023-0542-4d47-9c5a-29dea8e83bde`)
```
Lord, sometimes I feel lost or unsure,  
but I know You are with me.  
Give me courage to take small steps in faith.  
"Be still, and know that I am God" (Psalm 46:10).  
Let Your love lead my heart today.  
Amen.
```

## Prayer 2 (`ddab1a70-d245-4e99-8f29-4e31cedf60bd`)
```
Jesus, I’m here and I need You.  
Please shine Your light into my day,  
remind me that I’m not alone,  
and help me believe You’re with me always,  
just like You promised in Matthew 28:20—“I am with you always.”  
Guide my steps gently.  
Amen.
```

## Prayer 3 (`19bdf106-3887-4c04-8276-2ba929521f76`)
```
Lord,  
Thank You for loving me just as I am.  
Help me see Your light in my day.  
Hold my worries and make my heart lighter.  
“Cast all your anxiety on Him because He cares for you.” (1 Peter 5:7)  
Amen.
```

## Prayer 4 (`ed28a117-dfa8-4637-ae2d-bb8d209dd150`)
```
Hey God,  
I’m reaching out because I need Your comfort and direction.  
Help me feel Your presence in my day.  
Let Your love steady my heart,  
and remind me I’m never alone (Joshua 1:9).  
Grow my faith, even just a little today.  
Amen.
```

## Prayly's own Sacred Pause library (2026-09-23)
40 handcrafted prayers (verse + reference + prayer) in all 8 languages = 320 rows in backend `pray_pauses`
(slot 1-40, active) AND bundled offline as `ps.pause1..40.*` in `src/i18n/screens/prayscreen/<lang>.ts`
(exported to `flutter_app/assets/translations/<lang>.json`). Counts: `BUNDLED_COUNT` in
`src/hooks/usePrayerPauses.ts`, `_bundledCount` in `flutter_app/lib/core/services/prayer_pause_store.dart`.
Tone rule: warm, natural daily prayers — NEVER mention scrolling/screens/phone (user rejected that tone).
Source of truth: `artifacts/prayscreen/pauses-<lang>.json`; re-publish with `node scripts/apply-pause-prayers.mjs`
(rewrites i18n packs) + edge function `seed-pray-pauses` (reads `seed-data/pauses-all.json` from storage).
Each language was written by a native-style writer, not literal translation (es neutral LATAM, pt BR,
fil natural Taglish, hi simple spoken तू-form, id TB "Allah" in Scripture, fr tutoiement, de du-Form).
