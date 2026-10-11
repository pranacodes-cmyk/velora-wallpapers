# Flutter light-mode and media parity repair

## Goal
Make the Flutter app match the calm, polished Capacitor/web reference in light mode while stabilizing media behavior and preserving bounded memory use.

## Work
1. **Today light mode**
   - Match the scoped light palette for the streak badge, devotion/checklist card, prayer alarm card, and floating navigation.
   - Remove dark-mode shadows and muddy gold washes that look wrong on the cream background.

2. **Parallax lifecycle and scroll performance**
   - Resume sensor/ticker motion whenever Today becomes active again.
   - Pause work when hidden or off-screen, reduce repaint cost, and keep optimized card-sized assets with bounded decoding.

3. **Live wallpaper grid**
   - Replace the global eviction loop with visibility-aware playback for only the on-screen tiles.
   - Preserve initialized controllers and last frames while scrolling, avoid recurring shimmer, retry failed previews safely, and release far-off tiles to cap memory.
   - Remove unnecessary scaling/filtering that softens preview quality while retaining Android edge clipping.

4. **Quiz and Journey parity**
   - Match the React Quiz card gradients, gold icon tiles, borders, spacing, shadows, and Pro badges in light mode.
   - Constrain and align the Journey narration pill so its play/pause circle stays fully inside the top-right border.

5. **Verification and delivery**
   - Run static consistency checks, push the repair to private GitHub `main`, dispatch the Flutter light screenshot workflow, and observe it to completion.
   - Compare generated light screenshots against the supplied Capacitor references and report any remaining visible mismatch.

## Technical notes
- React/Capacitor remains the visual and behavioral source of truth.
- Playback will be viewport-driven rather than continuously evicting active decoders.
- No APK workflow will be triggered; only the requested screenshot workflow will run.
