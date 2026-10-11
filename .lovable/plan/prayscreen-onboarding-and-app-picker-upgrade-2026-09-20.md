# PrayScreen Onboarding and App Picker Upgrade

## Goal
Make PrayScreen immediately communicate the emotional problem, show how Prayly interrupts distraction, and let Android users guard their own most-used apps instead of choosing from a fixed list.

## Experience
1. **Distraction story:** Open with stronger God-centered copy: “Social media is stealing your attention — and slowly pulling your heart away from God.” Supporting line: “Prayly helps you pause, pray, and return with intention.”
2. **Real notification pressure:** Show tasteful Instagram, TikTok, YouTube, Facebook, Snapchat, and X notification cards arriving around their recognizable app icons. Keep the mood serious rather than copying the white/orange reference.
3. **Prayly intervention:** Animate the Prayly shield rising over the noise, notifications dimming, and lock badges securing the distracting apps.
4. **Prayer outcome:** Retain the Sacred Pause prayer moment and make the final promise clear: pray first, then selected apps unlock until the next reset.

## Shield App Selection
- On Android, load installed launchable apps and rank the user’s most-used apps first when usage access is available.
- Show a polished visual row of suggested/top apps with their real phone icons.
- Add **Choose from all apps** to open a searchable picker for any installed app.
- Keep free users limited to two guarded apps and preserve the existing Pro upgrade behavior.
- Web preview will mirror the exact layout and interactions with realistic sample apps because browsers cannot inspect installed phone apps.

## Parity and Safety
- Build matching web and Flutter screens and update all eight languages.
- Extend the existing Android bridge only; keep the current overlay, permission, reset-window, and unlock logic unchanged.
- Exclude Prayly and system-only/non-launchable packages from selection.
- Use graceful fallback apps and initials if an icon or usage ranking is unavailable.
- Verify onboarding on a phone viewport, app-picker interactions in web preview, translation parity, and source consistency.
