// Renders Meta CONVERT ads — 4 direct-response variants.
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
    id: "pov-lockscreen",
    variant: "pov-lockscreen",
    audioTrack: "ReelAudio-10281.mp3",
    hook: "POV: God Speaks First.",
    hookSub: "Before the world gets your attention…",
    verse: { text: "Be still, and know that I am God.", reference: "Psalm 46:10" },
    bg: "daily-verse-bg/bg-jesus-mountain-sunrise.jpg",
  },
  {
    id: "stop-scroll",
    variant: "stop-scroll",
    audioTrack: "ReelAudio-43303.mp3",
    hook: "Stop Scrolling.",
    hookSub: "This is your sign from Him.",
    verse: { text: "Cast all your anxiety on Him because He cares for you.", reference: "1 Peter 5:7" },
    bg: "daily-verse-bg/bg-cross-dawn-rays.jpg",
  },
  {
    id: "testimonial",
    variant: "testimonial",
    audioTrack: "ReelAudio-1283.mp3",
    verse: { text: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1" },
    bg: "daily-verse-bg/bg-shepherd-sheep.jpg",
    testimonials: [
      { name: "Sarah M.", handle: "@sarah_m", text: "I open my phone and the first thing I see is God's Word. It changed my mornings." },
      { name: "Marcus T.", handle: "@marcust", text: "I talked to the Bible chat at 2am when I couldn't sleep. It actually prayed with me." },
      { name: "Grace K.", handle: "@gracek", text: "Best free app I've ever downloaded. Period. Every Christian needs this." },
    ],
  },
  {
    id: "before-after",
    variant: "before-after",
    audioTrack: "ReelAudio-30696.mp3",
    hook: "Before Prayly vs After",
    hookSub: "Same phone. Different life.",
    verse: { text: "I can do all things through Christ who strengthens me.", reference: "Philippians 4:13" },
    bg: "daily-verse-bg/bg-jesus-halo-sunset.jpg",
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
const toRender = filterArg ? VARIANTS.filter((v) => filterArg.split(",").includes(v.id)) : VARIANTS;

for (const variant of toRender) {
  const { id, ...inputProps } = variant;
  const music = path.resolve(__dirname, `../public/audio/${variant.audioTrack}`);
  const videoOnly = path.join(OUT_DIR, `meta-convert-${id}-video-only.mp4`);
  const out = path.join(OUT_DIR, `meta-convert-${id}.mp4`);

  console.log(`\n=== ${id} ===`);
  const t0 = Date.now();
  const composition = await selectComposition({
    serveUrl: bundled, id: "meta-convert",
    puppeteerInstance: browser, inputProps,
  });
  await renderMedia({
    composition, serveUrl: bundled, codec: "h264",
    outputLocation: videoOnly, inputProps,
    puppeteerInstance: browser, muted: true,
    concurrency: Number(process.env.REMOTION_RENDER_CONCURRENCY || 1),
  });
  console.log(`✓ video ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const duration = composition.durationInFrames / composition.fps;
  const filter = `[0:a]aloop=loop=-1:size=2e9,atrim=0:${duration},asetpts=N/SR/TB,afade=t=in:st=0:d=0.6,afade=t=out:st=${duration - 1.2}:d=1.2,volume=0.75[a]`;
  execSync(
    `ffmpeg -y -i "${music}" -i "${videoOnly}" -filter_complex "${filter}" -map 1:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest "${out}"`,
    { stdio: "inherit" },
  );
  fs.unlinkSync(videoOnly);
  console.log(`→ ${out}`);
}

await browser.close({ silent: false });
console.log("\nAll convert variants rendered.");
