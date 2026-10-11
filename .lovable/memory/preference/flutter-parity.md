---
name: Flutter Parity Rule (STRICT 100%)
description: Flutter rewrite of Prayly must be a pixel- and behaviour-identical copy of the web app; nothing may differ or be missed
type: preference
---
The Flutter/Dart app in `flutter_app/` is a **100% ditto copy** of the React web app in `src/`.

**How to apply:**
- Every product and UI change starts in Flutter/Dart first. After Flutter is complete, mirror it exactly in the web preview; never use web as the implementation starting point.
- Every screen, sheet, modal, dialog, banner, icon, badge, shadow, gradient, radius, spacing, animation curve/duration, haptic, sound, and empty state must be replicated exactly. Not even one small icon may be missed or changed.
- Strings come from the web dictionaries — never hand-written. Run `bun scripts/export-i18n-flutter.mjs` to regenerate `flutter_app/assets/translations/*.json` for all 8 languages (en, es, pt, fil, hi, id, fr, de).
- Same backend (Lovable Cloud project), same R2 asset URLs, same edge functions, same PostHog event names/properties, same RevenueCat entitlement `Jesus Wallpaper & Bible Prayer Pro` and products `prayly_weekly`, `prayly_monthly`, `prayly_yearly`, `prayly_lifetime`.
- Same Android package `com.jesuswallpaperbible.app`; existing Java plugins in `native-plugins/java` are reused via MethodChannel.
- Verify each ported screen against the web source file before marking it done — re-check 10 times if needed. Behaviour parity beats speed.
- New features (doomscroll/Prayer Lock, Bible Chat removal) come AFTER full parity is reached.

**Working method (credit-efficient, zero-rework):**
- Read each web source file once, port it fully in the same turn, then never re-read it.
- Batch parallel writes; never end a turn on a single small write.
- Every ported file names its web source in a header comment so parity is auditable.
- Anything not yet ported is an explicit `PortPlaceholder` (never a silent approximation) and is tracked in `roadmap.md`.
- Quality gate each turn: `nix run nixpkgs#dart -- format --output=none lib` inside `flutter_app` (catches syntax errors without the Flutter SDK). Never hand-write colour hex from memory when the CSS HSL value is in the web source.
- Flutter/Dart requirement: SDK >= 3.6 (uses `Color.withValues`).
- No Play builds, GitHub pushes, or OTA releases unless the user explicitly asks in that message.

**Why:** Capacitor/WebView caused ANRs and jank on low-end devices (Samsung A05, itel, Redmi 8); Flutter is the performance fix, but the product/UI is already validated and must not regress.
