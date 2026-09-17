# Capacitor App Assets

This folder contains the source images used by **@capacitor/assets** to generate every required app icon and splash screen for iOS and Android.

## Files

| File | Size | Purpose |
|------|------|---------|
| `icon.png` | 1024×1024 | iOS app icon (full bleed, includes background) |
| `icon-foreground.png` | 1024×1024 | Android adaptive icon foreground (transparent, Jesus centered in safe zone) |
| `icon-background.png` | 2732×2732 | Android adaptive icon background (deep midnight navy) |
| `splash.png` | 1920×1920 | Light-mode splash screen |
| `splash-dark.png` | 1920×1920 | Dark-mode splash screen |

## Generate all platform assets

From the project root, run:

```bash
npm install --save-dev @capacitor/assets   # one-time, if not installed
npx capacitor-assets generate
```

This will populate:
- `android/app/src/main/res/` (mipmaps, adaptive icons, splash drawables)
- `ios/App/App/Assets.xcassets/` (AppIcon + Splash sets)

Then sync native projects:

```bash
npx cap sync
```

## Brand

- **Primary**: Royal Gold `#D4A93A`
- **Background**: Deep Midnight Navy `#0a1228`
- **Accent**: Deep Royal Blue `#1a2752`

Subject: Majestic, triumphant Jesus — never suffering.
