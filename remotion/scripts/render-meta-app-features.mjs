// Renders Meta App-Features ads — 4 variants showcasing Prayly's app screens.
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
    id: "daily-verse",
    variant: "daily-verse",
    audioTrack: "ReelAudio-10281.mp3",
    copy: {
      hookLine1: "Open your phone.",
      hookLine2: "Open His Word first.",
      featureKicker: "Inside Prayly",
      featureLine1: "A new verse on your lock screen.",
      featureLine2: "A new prayer when you need one most.",
      promiseLine1: "Let God's Word be the first thing you see.",
      promiseLine2: "One verse can change your whole day.",
    },
    verse: { text: "Be still, and know that I am God.", reference: "Psalm 46:10" },
    wallpapers: [
      "daily-verse-bg/bg-jesus-mountain-sunrise.jpg",
      "daily-verse-bg/bg-cross-dawn-rays.jpg",
      "daily-verse-bg/bg-jesus-water-moon.jpg",
    ],
  },
  {
    id: "bible-chat",
    variant: "bible-chat",
    audioTrack: "ReelAudio-43303.mp3",
    copy: {
      hookLine1: "When no one understands…",
      hookLine2: "He always does.",
      featureKicker: "Bible Companion",
      featureLine1: "Tell Him what's heavy.",
      featureLine2: "He'll answer with Scripture.",
      promiseLine1: "You don't have to carry it alone.",
      promiseLine2: "He's awake too.",
    },
    chat: [
      { role: "user", text: "I'm anxious tonight. I can't sleep." },
      { role: "ai",   text: "Let's pray. Father, quiet the noise in this heart and remind them You are near. \"Cast all your anxiety on Him because He cares for you.\" — 1 Peter 5:7" },
    ],
    wallpapers: [
      "daily-verse-bg/bg-jesus-dawn-prayer.jpg",
      "daily-verse-bg/bg-open-bible-glow.jpg",
      "daily-verse-bg/bg-jesus-clouds.jpg",
    ],
  },
  {
    id: "live-wallpaper",
    variant: "live-wallpaper",
    audioTrack: "ReelAudio-1283.mp3",
    copy: {
      hookLine1: "Your home screen,",
      hookLine2: "but with Jesus in it.",
      featureKicker: "Live Wallpapers",
      featureLine1: "Cinematic, living scenes of Christ —",
      featureLine2: "made to move with you.",
      promiseLine1: "A living testimony in your pocket.",
      promiseLine2: "Every time you open your phone.",
    },
    wallpapers: [
      "daily-verse-bg/bg-jesus-risen-angels.jpg",
      "daily-verse-bg/bg-cross-heavenly-light.jpg",
      "daily-verse-bg/bg-jesus-majestic.jpg",
    ],
    verse: { text: "I am the light of the world.", reference: "John 8:12" },
  },
  {
    id: "combo",
    variant: "combo",
    audioTrack: "ReelAudio-30696.mp3",
    copy: {
      hookLine1: "Three ways God",
      hookLine2: "meets you on your phone.",
      featureKicker: "Inside Prayly",
      featureLine1: "Verses. Prayers. His presence —",
      featureLine2: "every time you pick up your phone.",
      promiseLine1: "Let Him be the first thing you see.",
      promiseLine2: "And the last voice you hear tonight.",
    },
    verse: { text: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1" },
    chat: [
      { role: "user", text: "I feel so alone tonight." },
      { role: "ai",   text: "You are never alone. He has not forgotten you. \"I am with you always, to the very end of the age.\" — Matthew 28:20" },
    ],
    wallpapers: [
      "daily-verse-bg/bg-jesus-halo-sunset.jpg",
      "daily-verse-bg/bg-shepherd-sheep.jpg",
      "daily-verse-bg/bg-jesus-storm-calm.jpg",
    ],
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

const filterArg = process.argv[3];
const toRender = filterArg
  ? VARIANTS.filter((v) => filterArg.split(",").includes(v.id))
  : VARIANTS;

for (const variant of toRender) {
  const { id, ...inputProps } = variant;
  const music = path.resolve(__dirname, `../public/audio/${variant.audioTrack}`);

  const videoOnly = path.join(OUT_DIR, `meta-app-${id}-video-only.mp4`);
  const out = path.join(OUT_DIR, `meta-app-${id}.mp4`);
  console.log(`\n=== Variant: ${id} ===`);
  console.log(`→ ${out}`);

  const t0 = Date.now();
  const composition = await selectComposition({
    serveUrl: bundled,
    id: "meta-app-features",
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
console.log("\nAll app-feature variants rendered.");
