# Flutter parity repair pass

## Goal
Use the self-hosted Flutter preview as the primary QA surface, compare each main screen and modal against the React web reference, fix visible and functional mismatches, and push every completed batch to private GitHub `main` without triggering APK or CI builds.

## Work
1. **Make live preview auditable**
   - Fix the browser-locale startup crash currently leaving automated preview captures blank.
   - Add stable web-preview navigation/deep-link handling only where needed to open every screen and modal quickly.

2. **Wallpapers and tree card**
   - Match the Daily Verse tree card's height, crop, text lane, fade, and spacing to the React card at mobile widths.
   - Remove excessive darkness from static/live thumbnails while retaining readable bottom labels.
   - Fix broken-image warning states, preview fallbacks, live-video loading, category/header/icon differences, premium lock badges, and full-screen overlay behavior.

3. **Set Today / wallpaper setup**
   - Compare the complete setup flow with React: preview, verse placement, free/premium states, action buttons, back/close behavior, safe-area spacing, and failure/retry states.
   - Replace remaining broad orange/gold surfaces with dark navy glass; keep gold only for accents, borders, selection marks, and final actions.

4. **Premium sheet**
   - Audit every plan state and compact breakpoint.
   - Remove any remaining gold/orange wash from selected plans, benefits, urgency, reviews, and sheet background while preserving intentional premium accents.
   - Ensure premium wallpapers open the subscription sheet directly; free wallpapers retain the proper unlock path.

5. **Full-screen sweep**
   - Open Today, Wallpapers, Journeys, Quiz, Daily Verse, Prayer, onboarding, Settings, and their key dialogs.
   - Fix remaining layout, icon, color, overlap, blank-state, navigation, and interaction differences found against React.

6. **Verification and delivery**
   - Re-open affected flows at the user's 384×624 viewport and a taller Android viewport.
   - Check console/runtime failures and source consistency.
   - Push the final code to private GitHub `main` through the saved token flow and report commit hashes. No APK build or CI screenshot workflow.

## Technical notes
- React/Vite remains the visual and behavioral source of truth.
- Shared dark-glass tokens will replace screen-specific structural gold fills.
- Fix root causes in shared widgets first so multiple screens update together.
