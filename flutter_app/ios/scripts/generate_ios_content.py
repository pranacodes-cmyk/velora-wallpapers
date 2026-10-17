#!/usr/bin/env python3
"""Generates the bundled iOS daily-wallpaper content from the Flutter assets.

Outputs (both committed and regenerated in CI so iOS never drifts from the
Flutter verse data):
  Runner/DailyWallpaper/backgrounds/bg-XX.jpg   full-size photos (wallpaper)
  Runner/DailyWallpaper/verses/<lang>.json      [[text, reference], ...] x 366
  Runner/DailyWallpaper/strings/<lang>.json     native-surface copy
  PraylyWidget/WidgetContent/...                same data, widget-sized photos

Photos come from the same CDN list the app uses (assets/data/verse_backgrounds.json).
"""
import io
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
IOS = os.path.dirname(HERE)
APP = os.path.dirname(IOS)
ASSETS = os.path.join(APP, "assets")
LANGS = ["en", "hi", "es", "pt", "fr", "de", "id", "fil"]

sys.path.insert(0, HERE)
from native_strings import NATIVE_STRINGS  # noqa: E402


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def verses_for(lang, verses, translations):
    out = []
    for raw in verses:
        ref_key = raw["reference"]
        text = translations.get(f"v.{ref_key}") or raw["text"]
        ref = translations.get(f"r.{ref_key}") or ref_key
        out.append([text.strip(), ref.strip()])
    return out


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "prayly-ios-build"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    with open(os.path.join(ASSETS, "data", "verses.json"), encoding="utf-8") as f:
        verses = json.load(f)
    with open(os.path.join(ASSETS, "data", "verse_backgrounds.json"), encoding="utf-8") as f:
        backgrounds = json.load(f)

    app_dir = os.path.join(IOS, "Runner", "DailyWallpaper")
    widget_dir = os.path.join(IOS, "PraylyWidget", "WidgetContent")

    for lang in LANGS:
        path = os.path.join(ASSETS, "translations", f"{lang}.json")
        translations = {}
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                translations = json.load(f)
        data = verses_for(lang, verses, translations)
        assert len(data) == len(verses), lang
        strings = dict(NATIVE_STRINGS["en"])
        strings.update(NATIVE_STRINGS.get(lang, {}))
        for base in (app_dir, widget_dir):
            write_json(os.path.join(base, "verses", f"{lang}.json"), data)
            write_json(os.path.join(base, "strings", f"{lang}.json"), strings)

    try:
        from PIL import Image
    except ImportError:  # CI keeps the committed photos when Pillow is absent.
        Image = None

    for i, bg in enumerate(backgrounds):
        name = f"bg-{i + 1:02d}.jpg"
        full = os.path.join(app_dir, "backgrounds", name)
        small = os.path.join(widget_dir, "backgrounds", name)
        if not os.path.exists(full):
            os.makedirs(os.path.dirname(full), exist_ok=True)
            data = fetch(bg["url"])
            with open(full, "wb") as f:
                f.write(data)
        if not os.path.exists(small) and Image is not None:
            os.makedirs(os.path.dirname(small), exist_ok=True)
            img = Image.open(full).convert("RGB")
            w, h = img.size
            target_w = 720
            if w > target_w:
                img = img.resize((target_w, round(h * target_w / w)), Image.LANCZOS)
            img.save(small, "JPEG", quality=80, optimize=True, progressive=True)
    print(f"iOS content ready: {len(verses)} verses x {len(LANGS)} languages, {len(backgrounds)} photos")


if __name__ == "__main__":
    main()
