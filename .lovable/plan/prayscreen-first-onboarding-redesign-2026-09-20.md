# PrayScreen-first onboarding redesign

## Experience
- Keep the language picker first.
- Replace the old Journeys and Bible Chat onboarding content with three connected PrayScreen story screens before the existing Verse, Prayer, and personal-focus screens.
- Keep the current Prayly wording style and dark majestic identity; make the presentation feel cinematic, devotional, and unmistakably product-specific.
- Do not request Usage Access or overlay permission during onboarding. The real permission flow remains on the Shield screen.

## Three-screen story
1. **The interruption** — familiar social apps pull the user away; the Prayly Shield arrives and calmly stops the noise.
2. **The Sacred Pause** — a live prayer/Scripture interaction completes inside the shield, followed by a tactile unlock transformation.
3. **The promise** — selected apps appear protected around a central shield, showing the four daily reset moments and the calmer day the user receives.

## Motion and visual treatment
- Use one continuous visual story rather than three unrelated cards: app icons converge, the shield forms, prayer light travels through it, then protection rings expand.
- Use layered depth, restrained gold light, crisp midnight surfaces, premium spring timing, staggered typography, haptics, and meaningful state transitions.
- Keep motion efficient: transform/opacity animation, isolated repaint areas, reduced-motion support, and no heavyweight video or unnecessary image assets.
- Preserve exact web/Flutter composition parity while using each platform's native motion system.

## Implementation
- Add shared PrayScreen onboarding copy to every supported language.
- Build matching web and Flutter slide components and update both onboarding controllers to the same order and progress count.
- Delete Bible Chat and Journeys onboarding components, imports, and onboarding-only translation keys; leave their web/Capacitor product pages untouched.
- Keep existing Verse, Prayer, Focus, completion tracking, replay, paywall handoff, and native permission behavior intact.

## Validation
- Verify the complete first-launch flow at phone size, including swipe/back/continue behavior, short-screen fit, animation continuity, and no blank frames.
- Run focused web checks and Flutter static analysis without triggering Android CI or producing an APK.
