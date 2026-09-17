# 3-Day Trial Transition

## Goal
Add only the recording’s centered trial-confirmation moment between onboarding’s final step and the Premium sheet. Ignore the pet imagery, setup checklist, and the other app’s paywall design.

## Experience
- After the user completes the final onboarding step, show a clean full-screen Prayly transition on the existing midnight background.
- Animate a compact switch from off to royal gold, slide the knob across, then reveal a gold checkmark.
- Show localized “3-day free trial is enabled!” copy beneath it.
- Hold briefly, fade out, and open Prayly’s existing Premium sheet with Yearly still selected by default.
- Keep Weekly as no-trial; this animation only introduces the Monthly/Yearly trial offer and does not activate a purchase by itself.

## Implementation
- Add a lightweight, GPU-safe transition component using only opacity and transform animations; no blur, video, large image, or infinite animation.
- Integrate it into the post-onboarding premium handoff while retaining overlay-queue protection and the existing recovery behavior.
- Add the new sentence in all eight supported languages.
- Respect reduced-motion settings and ensure a failed timer/unmount cannot leave the overlay queue locked.

## Validation
- Verify fresh onboarding flows: final step → trial transition → Premium sheet.
- Verify returning users do not see the transition.
- Verify Premium users see neither the transition nor the paywall.
- Check narrow Android sizing and confirm no overlapping overlays.
