# Flutter light-mode parity recovery

## Goal
Make Flutter use the Capacitor/web app as the exact visual source of truth in light mode, without redesigning or changing behavior.

## Implementation
1. **Centralize exact web tokens**
   - Port the web light palette, Today-only navy/gold override, premium tile gradients, borders, shadows, and glass/navigation surfaces into reusable Flutter theme helpers.
   - Preserve intentional always-dark experiences only where the web does, such as cinematic prayer slides and the post-onboarding premium handoff.

2. **Repair the visible mismatches**
   - Today prayer/checklist: align card fills, navy structure, gold accents, borders, shadows, typography, and spacing with the web screenshot.
   - Bible Chat: replace the hardcoded midnight card in light mode with the web ivory/blue/gold premium tile treatment, including readable title, chips, and composer.
   - Quiz: match web hero, stats, regular modes, Pro mode cards, badges, shadows, and spacing in light mode.
   - Premium sheet: match the web light presentation for normal entry points while keeping the post-onboarding sheet intentionally midnight.
   - Journey/day reading screens: remove Flutter-only hardcoded dark canvases where the web uses the selected light theme.

3. **Match bottom navigation exactly**
   - Reproduce the web pill's translucent near-white surface, subtle warm border, soft lifted shadow, 28px shape, active gold line/glow, icon weights, label opacity, margins, and safe-area placement.
   - Keep its existing navigation behavior unchanged.

4. **Full light-mode sweep**
   - Scan all Flutter screens and shared overlays for literal black/white/navy surfaces that bypass theme tokens.
   - Classify each against the web implementation, then convert only incorrect cases to semantic light/dark styling.
   - Cover wallpapers, favorites, settings, alarms, chat, journeys, quiz states, dialogs, sheets, and shared controls.

5. **Validation and delivery**
   - Run static checks available in the workspace and verify representative light/dark Flutter web screenshots at phone size against the React reference.
   - Fix contrast, clipping, and bottom-navigation overlap regressions found during that pass.
   - Push the completed parity pass to the private GitHub repository; do not start an APK workflow unless requested.

## Technical notes
- React/Capacitor remains authoritative; no invented Flutter styling.
- Shared Flutter helpers will mirror `--tile-grad`, `--tile-grad-soft`, `--tile-border`, `--tile-shadow`, `--glass`, `--glass-border`, and `--nav-blur`.
- Theme-aware foreground colors replace literal white only when the matching web element uses semantic foreground tokens.
- Full-screen media/prayer scenes remain dark when their web counterparts are intentionally cinematic.
