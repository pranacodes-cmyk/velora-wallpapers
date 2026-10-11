// Renders the Meta Daily Prayer ad (whispered, candlelit, ASMR-style).
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.argv[2] || "/mnt/documents/daily-verse-ads";
fs.mkdirSync(OUT_DIR, { recursive: true });

const VARIANTS = [
  {
    id: "whispered",
    backgrounds: [
      "daily-verse-bg/bg-prayer-candle-bedside.jpg",
      "daily-verse-bg/bg-prayer-folded-hands.jpg",
      "daily-verse-bg/bg-prayer-bible-candle.jpg",
      "daily-verse-bg/bg-prayer-moon-window.jpg",
    ],
    copy: {
      hookLine1: "When you have no words left\u2026",
      hookLine2: "let this pray for you.",
      prayerLines: [
        "Lord, You see this heart, even now.",
        "You hear what I cannot say.",
        "Quiet the noise, hold what is heavy,",
        "and let Your peace rest over me tonight.",
      ],
      amen: "In Jesus' name, Amen.",
      promiseLine1: "A new prayer, written for you.",
      promiseLine2: "Every morning. Every night.",
    },
  },
  {
    id: "weary",
    backgrounds: [
      "daily-verse-bg/bg-prayer-folded-hands.jpg",
      "daily-verse-bg/bg-prayer-moon-window.jpg",
      "daily-verse-bg/bg-prayer-bible-candle.jpg",
      "daily-verse-bg/bg-prayer-candle-bedside.jpg",
    ],
    copy: {
      hookLine1: "If today wore you out\u2026",
      hookLine2: "let Him pray over you.",
      prayerLines: [
        "Father, I am tired in places I cannot name.",
        "Take what I carried alone today.",
        "Remind me I was never meant to hold it all,",
        "and breathe Your peace into this quiet hour.",
      ],
      amen: "In Jesus' name, Amen.",
      promiseLine1: "A prayer for every season of your soul.",
      promiseLine2: "Waiting for you each morning and night.",
    },
  },
  {
    id: "morning-bless",
    backgrounds: [
      "daily-verse-bg/bg-prayer-bible-candle.jpg",
      "daily-verse-bg/bg-prayer-candle-bedside.jpg",
      "daily-verse-bg/bg-prayer-folded-hands.jpg",
      "daily-verse-bg/bg-jesus-mountain-sunrise.jpg",
    ],
    copy: {
      hookLine1: "Before the day finds you\u2026",
      hookLine2: "let Him bless your morning first.",
      prayerLines: [
        "Lord, before I touch the world today,",
        "let me first be touched by You.",
        "Soften what is sharp, steady what is shaking,",
        "and walk beside me wherever this day leads.",
      ],
      amen: "In Jesus' name, Amen.",
      promiseLine1: "Begin each morning with a prayer.",
      promiseLine2: "End each night held by His peace.",
    },
  },
];

console.log("Bundling…");
const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (c) => c,
});

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const { execSync } = await import("child_process");
const music = path.resolve(__dirname, "../public/audio/ReelAudio-43303.mp3");

const filterArg = process.argv[3];
const toRender = filterArg
  ? VARIANTS.filter((v) => filterArg.split(",").includes(v.id))
  : VARIANTS;

for (const variant of toRender) {
  const inputProps = {
    audioTrack: "ReelAudio-43303.mp3",
    backgrounds: variant.backgrounds,
    copy: variant.copy,
  };

  const videoOnly = path.join(OUT_DIR, `meta-daily-prayer-${variant.id}-video-only.mp4`);
  const out = path.join(OUT_DIR, `meta-daily-prayer-${variant.id}.mp4`);
  console.log(`\n=== Variant: ${variant.id} ===`);
  console.log(`→ ${out}`);

  const t0 = Date.now();
  const composition = await selectComposition({
    serveUrl: bundled,
    id: "meta-daily-prayer",
    puppeteerInstance: browser,
    inputProps,
  });
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: videoOnly,
    inputProps,
    puppeteerInstance: browser,
    muted: true,
    concurrency: Number(process.env.REMOTION_RENDER_CONCURRENCY || 1),
  });
  console.log(`✓ video ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const duration = composition.durationInFrames / composition.fps;
  const filter = `[0:a]aloop=loop=-1:size=2e9,atrim=0:${duration},asetpts=N/SR/TB,afade=t=in:st=0:d=1.2,afade=t=out:st=${duration - 1.5}:d=1.5,volume=0.7[a]`;
  execSync(
    `ffmpeg -y -i "${music}" -i "${videoOnly}" -filter_complex "${filter}" -map 1:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest "${out}"`,
    { stdio: "inherit" },
  );
  fs.unlinkSync(videoOnly);
  console.log(`Done → ${out}`);
}

await browser.close({ silent: false });
console.log("\nAll prayer variants rendered.");
