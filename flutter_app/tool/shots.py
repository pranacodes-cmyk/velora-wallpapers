"""Capture every Flutter-web screen at S23-Ultra size for visual parity diffing.

Run from CI after `flutter build web` with a static server on :8000.
Writes one PNG per screen (plus a scrolled variant where the screen scrolls)
and a per-screen console log that includes full Dart error text/stacks.
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

BASE = os.environ.get("SHOT_BASE", "http://localhost:8000")
OUT = os.environ.get("SHOT_OUT", "shots")

# name, query string, extra settle seconds, capture a scrolled variant
SCREENS = [
    ("01-onboarding", "?shot=onboarding&theme=light", 5, False),
    ("02-today", "?shot=1&tab=0&theme=light", 7, True),
    ("03-wallpapers", "?shot=1&tab=1&theme=light", 22, True),
    ("04-quiz", "?shot=1&tab=2&theme=light", 7, False),
]


async def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    failures: list[str] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--no-sandbox"],
        )
        ctx = await browser.new_context(
            viewport={"width": 412, "height": 915},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
        )
        page = await ctx.new_page()
        logs: list[str] = []

        def on_console(msg):
            text = msg.text
            # Dart errors are what we actually care about — keep them loud.
            logs.append(f"{msg.type}: {text}")

        def on_pageerror(err):
            # `err` alone stringifies to a useless "Error" for compiled Dart;
            # the stack carries the real frame list.
            logs.append(f"pageerror: {err.message}\nstack: {err.stack}")

        page.on("console", on_console)
        page.on("pageerror", on_pageerror)

        for name, query, settle, scrolled in SCREENS:
            logs.append(f"===== {name} =====")
            try:
                await page.goto(
                    f"{BASE}/{query}", wait_until="domcontentloaded", timeout=60_000
                )
                await page.wait_for_timeout(settle * 1000)
                await page.screenshot(path=f"{OUT}/{name}.png")
                print(f"captured {name}")
                if name == "05-quiz":
                    # Enter Daily Challenge, tap a known-wrong option, then
                    # capture the delayed revive overlay. This catches the
                    # device-reported black-screen regression automatically.
                    try:
                        await page.mouse.click(205, 405)
                        await page.wait_for_timeout(1200)
                        await page.mouse.click(205, 585)
                        await page.wait_for_timeout(1100)
                        await page.screenshot(path=f"{OUT}/05-quiz-revive.png")
                        print("captured 05-quiz-revive")
                    except Exception as exc:  # noqa: BLE001
                        failures.append(f"05-quiz-revive: {exc}")
                if scrolled:
                    await page.mouse.move(206, 600)
                    for _ in range(4):
                        await page.mouse.wheel(0, 420)
                        await page.wait_for_timeout(500)
                    await page.wait_for_timeout(2500)
                    await page.screenshot(path=f"{OUT}/{name}-scrolled.png")
                    print(f"captured {name}-scrolled")
            except Exception as exc:  # noqa: BLE001
                failures.append(f"{name}: {exc}")
                print(f"FAILED {name}: {exc}")

        with open(f"{OUT}/console.log", "w") as fh:
            fh.write("\n".join(logs))
        errors = [line for line in logs if "ERROR" in line or "pageerror" in line]
        if errors:
            print("---- dart/js errors ----")
            print("\n".join(errors[:40]))
        await browser.close()

    if failures:
        print("\n".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
