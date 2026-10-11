# Android Performance Recovery Plan

## What the evidence says

The user’s concern is valid: the app is not consistently smooth, and earlier “buttery smooth” conclusions were based on incomplete telemetry.

### Measured user experience

- Android cold-start telemetry over the last 12 days shows a median of roughly **1.3–2.8 seconds**, but the slowest 10% take about **5.2–7.7 seconds**. A meaningful part of the audience is staring at a slow launch.
- Recorded main-thread jank is severe: a typical affected session accumulates about **1.6–3.1 seconds** of blocked work; the slowest 10% accumulate roughly **7–12 seconds**.
- Play Console has already shown **10.26% frozen frames**, **27.24% slow warm starts**, and a recent production ANR. The overall ANR average can look small while a new-release spike still exists; both statements can be true.
- The earlier iQOO 11 report was misleading because route-shell timing was fast while the first 19 seconds still contained image/decode stalls. Current telemetry also starts late and loses many ANR/early-exit sessions, so it systematically under-reports the worst users.

### Proven causes in the current code

1. **Oversized launch bundle**
   - The initial JavaScript is about **1.25 MB / 341 KB compressed** in one eager chunk.
   - The home screen alone is about **95 KB of source / 2,377 lines** and loads many features before the user needs them.
   - The app contains about **13 MB of frontend source**, including **8.6 MB of localization data**. Locale files are lazy, but the selected non-English language currently delays the first React render.

2. **Heavy first screen**
   - Home starts two Supabase queries immediately.
   - It mounts a visually expensive carousel, shadows/glows, checklist content, and wallpaper rendering.
   - The parallax card keeps a 30–60 fps JavaScript animation loop alive while visible. Android is classified as “low end” globally, but this hero deliberately ignores the broader Android performance mode.

3. **Wallpaper canvas work still exists**
   - `useVerseWallpaper` creates a canvas, draws a large image, and converts it with `toDataURL` on the main thread.
   - Preview resolution was reduced recently, which helps, but JPEG encoding is still synchronous and can block interaction.
   - One audit subtask incorrectly said canvas was absent; direct source verification proved that statement wrong.

4. **Onboarding still carries decode pressure**
   - Five large visual backgrounds are warmed during onboarding. Staggering reduced the single freeze, but it spreads decode work across the exact period when users swipe the first slides.
   - This matches the iQOO user’s report: the first slides can feel worse than later screens even on a powerful phone.

5. **GPU/compositor pressure**
   - The app has many blur, backdrop-filter, shadow, glow, and infinite-animation sites.
   - Startup CSS disables many effects for Android, which is good, but the parallax conversion hero restores continuous motion/effects after startup.
   - `FLAG_SECURE` is enabled for the whole activity, preventing screenshots and potentially reducing composition flexibility. Its exact cost must be measured before removal, so it is not being treated as a proven root cause.

6. **Native scheduling and image risks**
   - Prayer alarms use both `setAlarmClock` and an exact backup alarm. Receivers are now moved off the main thread, but the duplicated high-priority scheduling design still increases system/Binder work.
   - Native wallpaper classes still use raw `HttpURLConnection`; some paths downsample correctly, while others decode downloaded images without a screen-size-based sample calculation.
   - The parallax wallpaper service already has proper sample-size decoding; it should not be rewritten blindly.

7. **Observability is currently biased**
   - Analytics starts after first paint and can be delayed several seconds.
   - Android session replay is unavailable/disabled, jank flushes can be lost on ANR, and “route mounted” does not mean visible content is ready.
   - Local ANR breadcrumbs are stored only on the affected phone and are not automatically uploaded next launch, so they do not currently explain Play Console ANRs.

## Recovery work

### Phase 1 — Make measurements trustworthy

- Add a tiny native boot timestamp and report: native launch → WebView ready → React shell → actual screen content ready.
- Persist long-task, route, last-action, memory-warning, image-decode, and previous abnormal-exit breadcrumbs locally; upload them on the next successful launch.
- Record sampled per-screen interaction readiness without loading the heavy PostHog recorder at startup.
- Add version, OTA version, RAM/device tier, WebView version, locale, and foreground/background state to every performance event.
- Keep Supabase usage low by batching one compact diagnostic event per session rather than streaming raw frames.

### Phase 2 — Fix cold start and onboarding first

- Split stable libraries and non-critical home features into separate cached chunks; keep only the minimal home shell eager.
- Render immediately with the built-in English shell, then switch/load a selected translation without blocking the first frame; preserve the splash until the first localized content commit to avoid a visible language flash.
- Stop onboarding-wide image warming. Preload only the current and next slide, with correct display-size variants.
- Delay OTA, attribution, RevenueCat, notifications, content scheduling, and other bridge work until content is interactive and the main thread is idle—not merely after fixed timers.
- Remove global console interception from production startup or replace it with a bounded error-only buffer.

### Phase 3 — Make Home consistently smooth

- Break `Today.tsx` into a minimal above-the-fold shell and lazy sections.
- Start wallpaper/live-count Supabase queries only when their section approaches the viewport.
- Move wallpaper preview decode/resize/encode off the interaction path; cache the result and generate full resolution only for apply/share/download.
- Retain the restored Day badge and phone glow while reducing blur/shadow complexity on Android.
- Pause parallax during scroll, sheets, carousel movement, background state, and low frame-rate periods; cap Android preview motion to 30 fps and downgrade dynamically if frames miss budget.

### Phase 4 — Native ANR and memory hardening

- Replace duplicated prayer alarm scheduling with one exact alarm per enabled reminder and reschedule only the next occurrence; keep alarm reliability and editable times intact.
- Add screen-bound bitmap probing/downsampling to every native wallpaper decode path that lacks it, with strict byte/dimension limits and safe failure handling.
- Use a shared bounded executor instead of creating an unbounded new thread for each native action.
- Add connection/read timeouts and disk-aware caching to wallpaper downloads. Introduce OkHttp only if the existing dependency/build impact is justified.
- Preserve the parallax wallpaper’s existing GPU rendering and screen scaling; optimize only verified allocation or frame problems.

### Phase 5 — Reduce GPU cost screen by screen

- Audit every blur, filter, infinite animation, large shadow, and full-screen transition on Android.
- Replace expensive backdrop blur with visually similar opaque/translucent fills on Android where needed.
- Ensure hidden routes, sheets, carousels, and parallax scenes stop all timers/rAF loops and release large image references.
- Keep premium visuals polished; changes should degrade cost, not conversion-critical clarity.

## Verification and release gates

- Test on three tiers: a low-end 3–4 GB Android, a common mid-range Android, and a flagship.
- Capture Macrobenchmark/Perfetto cold, warm, onboarding-swipe, home-carousel, premium-sheet, prayer, and wallpaper-apply traces.
- Do not release broadly unless: cold-start p90 is under 3.5 seconds on mid-range hardware, no interaction task exceeds 200 ms in core flows, frozen frames are under 3%, and the staged build has no new ANR cluster.
- Ship to internal testing, then a small production rollout, compare by native/OTA version for 48–72 hours, and only then expand.
- Conversion experiments and new features remain frozen until performance gates pass, so performance changes can be measured cleanly.

## Technical note

Some native fixes require a new Play Store build and cannot reach old native versions through OTA. React, CSS, bundle splitting, onboarding, Home, parallax-preview, and telemetry improvements can ship by OTA where the installed native compatibility floor allows it.
