---
name: Daily Verse Offline Cache
description: Pro-only auto-update flow with Doze-proof local cache, free users gated behind a rewarded ad
type: feature
---
**Architecture for the Daily Verse auto-updating wallpaper.**

- Pro-only feature. Free users tap "Unlock Daily Auto-Update" → opens PremiumSheet.
- On enable, native plugin `DailyVerseWallpaper.prefetchAssets()` downloads all 10 R2 backgrounds to `getFilesDir()/daily-verse/bg-XX.jpg` while the full-screen `DailyVersePrefetchModal` shows a golden progress bar.
- Live wallpaper service `DailyVerseWallpaperService` reads ONLY from local files via `BitmapFactory.decodeFile()` — never the network. This is mandatory: Battery saver / Doze blocks midnight `HttpURLConnection` calls and would silently break auto-update.
- Midnight redraw: `AlarmManager.setAndAllowWhileIdle` fires `ACTION_REDRAW`, the engine re-reads today's verse + bg from disk and repaints. ~50ms, zero network.
- Weekly refresh: when Pro user opens the page and `getCacheStatus().ageDays >= 7`, run `prefetchAssets({force:true})` silently in the background.
- 365 verses are bundled in `assets/daily_verse/verses.json` so they always work offline.

**Free user "Apply Today's Snapshot"**: gated by `showRewardedAd()` (same pattern as quiz revives). After ad reward → `WallpaperSetter.setWallpaper(dataUrl)` applies a one-time static wallpaper. No auto-update.

**Why**: Battery saver / Doze WILL block network calls inside `WallpaperService` workers. Local-cache-only design is the only way to guarantee daily updates work for everyone, including users with battery saver permanently on.
