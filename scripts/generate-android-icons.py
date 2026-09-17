#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android" / "app" / "src" / "main" / "res"
SRC = ROOT / "resources" / "icon.png"
FOREGROUND_SRC = ROOT / "resources" / "icon-foreground.png"
SPLASH_SRC = ROOT / "resources" / "splash.png"
SPLASH_DARK_SRC = ROOT / "resources" / "splash-dark.png"

DENSITIES = {
    "ldpi": 36,
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

SPLASH_DENSITIES = {
    "ldpi": int(288 * 0.75),
    "mdpi": 288,
    "hdpi": int(288 * 1.5),
    "xhdpi": 288 * 2,
    "xxhdpi": 288 * 3,
    "xxxhdpi": 288 * 4,
}

# Android adaptive icons render the foreground inside a safe zone. The previous
# generator wrote the full painting into the foreground and then XML-inset it
# again, so launchers/splash screens displayed a double-scaled, soft icon.
# Keep the foreground artwork large and remove XML inset in the adaptive icon.
FOREGROUND_SCALE = 1.0
LEGACY_SCALE = 0.92


def open_rgba(path: Path) -> Image.Image:
    if not path.exists():
        raise FileNotFoundError(f"Missing source asset: {path}")
    return Image.open(path).convert("RGBA")


def fit_on_canvas(source: Image.Image, size: tuple[int, int], scale: float, bg=(0, 0, 0, 0)) -> Image.Image:
    canvas = Image.new("RGBA", size, bg)
    target = int(min(size) * scale)
    fitted = source.resize((target, target), Image.Resampling.LANCZOS)
    x = (size[0] - target) // 2
    y = (size[1] - target) // 2
    canvas.alpha_composite(fitted, (x, y))
    return canvas


def sharpen_for_launcher(img: Image.Image, density_size: int) -> Image.Image:
    # Small launcher icons need a little post-downsample crispness. Keep it mild
    # to avoid halos, but enough to prevent Samsung/Pixel launchers looking soft.
    amount = 1.18 if density_size >= 144 else 1.12
    img = ImageEnhance.Sharpness(img).enhance(amount)
    return img


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=False, compress_level=1)


def rounded_icon(source: Image.Image, size: int, scale: float) -> Image.Image:
    icon = fit_on_canvas(source, (size, size), scale, (0, 0, 0, 255))
    radius = int(size * 0.205)
    mask = Image.new("L", (size, size), 0)
    # Supersampling the mask gives clean corners at all densities.
    ss = 4
    hi = Image.new("L", (size * ss, size * ss), 0)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(hi)
    draw.rounded_rectangle((0, 0, size * ss - 1, size * ss - 1), radius=radius * ss, fill=255)
    mask = hi.resize((size, size), Image.Resampling.LANCZOS)
    icon.putalpha(mask)
    return sharpen_for_launcher(icon, size)


def write_adaptive_xml() -> None:
    xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
'''
    for name in ["ic_launcher.xml", "ic_launcher_round.xml"]:
        (RES / "mipmap-anydpi-v26" / name).write_text(xml, encoding="utf-8")


def write_android_12_splash_themes() -> None:
    values_v31 = RES / "values-v31"
    values_v31.mkdir(parents=True, exist_ok=True)
    (values_v31 / "styles.xml").write_text('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:windowBackground">@color/background</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:windowSplashScreenBackground">@color/background</item>
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowBackground">@color/background</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:enforceNavigationBarContrast">false</item>
        <item name="android:enforceStatusBarContrast">false</item>
    </style>

    <style name="AppTheme.Launcher" parent="AppTheme.NoActionBar">
        <item name="android:windowSplashScreenBackground">@color/background</item>
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
''', encoding="utf-8")


def safe_zone_splash_icon(source: Image.Image, size: int, scale: float) -> Image.Image:
    """Android 12+ splash icon inside the platform safe zone.

    The splash drawable is a 288dp canvas but only the inner 192dp (2/3) is
    guaranteed visible — OEM launchers (iQOO/Funtouch, MIUI, One UI) mask the
    rest, which is why the old 82%-of-canvas artwork looked cropped on some
    phones and fine on Pixel. Contain the artwork (aspect preserved) inside the
    safe zone on a transparent canvas so no device can clip it.
    """
    safe = int(size * scale)
    sw, sh = source.size
    ratio = min(safe / sw, safe / sh)
    fitted = source.convert("RGBA").resize(
        (max(1, round(sw * ratio)), max(1, round(sh * ratio))), Image.Resampling.LANCZOS
    )
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
    return canvas


def write_splash_icon(source: Image.Image) -> None:
    # Android 12 system splash otherwise falls back to the 192px launcher icon
    # and scales it up. Provide density-specific splash icons so the startup
    # logo is never enlarged from a tiny bitmap on real Android devices.
    for density, size in SPLASH_DENSITIES.items():
        icon = safe_zone_splash_icon(source, size, 0.62)
        icon = ImageEnhance.Sharpness(icon).enhance(1.08)
        save_png(icon, RES / f"drawable-{density}" / "splash_icon.png")


def main() -> None:
    icon = open_rgba(SRC)
    foreground = open_rgba(FOREGROUND_SRC)

    for density, size in DENSITIES.items():
        out = RES / f"mipmap-{density}"
        save_png(rounded_icon(icon, size, LEGACY_SCALE), out / "ic_launcher.png")
        save_png(rounded_icon(icon, size, LEGACY_SCALE), out / "ic_launcher_round.png")
        save_png(Image.new("RGBA", (size, size), (0, 0, 0, 255)), out / "ic_launcher_background.png")
        fg = fit_on_canvas(foreground, (size, size), FOREGROUND_SCALE, (0, 0, 0, 0))
        save_png(sharpen_for_launcher(fg, size), out / "ic_launcher_foreground.png")

    write_adaptive_xml()
    write_splash_icon(icon)
    write_android_12_splash_themes()
    print("✅ Native Android launcher + Android 12 splash icons regenerated from HD resources/icon.png")


if __name__ == "__main__":
    main()
