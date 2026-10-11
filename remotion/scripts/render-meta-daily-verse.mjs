// Renders multiple variants of the Meta Daily Verse Wallpaper ad.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSES_FILE = path.resolve(__dirname, "../../src/data/dailyVerses.ts");
const OUT_DIR = process.argv[2] || "/mnt/documents/daily-verse-ads";
fs.mkdirSync(OUT_DIR, { recursive: true });

function loadVerses() {
  const src = fs.readFileSync(VERSES_FILE, "utf8");
  const m = src.match(/const verses: DailyVerse\[\] = \[([\s\S]*?)\n\];/);
  if (!m) throw new Error("Could not locate verses array");
  const body = m[1];
  const re = /\{\s*text:\s*"((?:[^"\\]|\\.)*)"\s*,\s*reference:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  const out = [];
  let mm;
  while ((mm = re.exec(body))) out.push({ text: mm[1].replace(/\\"/g, '"'), reference: mm[2] });
  return out;
}

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function pickVerses(seed, n = 4) {
  const rng = mulberry32(seed);
  const pool = loadVerses();
  const short = pool.filter((v) => v.text.length <= 120 && v.text.length >= 40);
  const out = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const src = short.length > 5 ? short : pool;
    const idx = Math.floor(rng() * src.length);
    const v = src.splice(idx, 1)[0];
    const d = new Date(today); d.setDate(today.getDate() + i);
    out.push({ text: v.text, reference: v.reference, weekday: WEEKDAYS[d.getDay()], date: `${MONTHS[d.getMonth()]} ${d.getDate()}` });
  }
  return out;
}

// ───────────── Variants ─────────────
// Each variant: distinct opening hook, mid-message, closing promise, and image rotation.
const VARIANTS = [
  {
    id: "origin",
    seed: 420,
    backgrounds: [
      "daily-verse-bg/bg-jesus-water-moon.jpg",
      "daily-verse-bg/bg-jesus-clouds.jpg",
      "daily-verse-bg/bg-cross-crown.jpg",
      "daily-verse-bg/bg-shepherd-sheep.jpg",
    ],
    copy: {
      glintLine1: "Every morning,",
      glintLine2: "you wake up…",
      boringLine1: "The same screen.",
      boringLine2: "The same empty routine.",
      reasonKicker: "What if…",
      reasonLine1: "…it started with Jesus?",
      reasonLine2: "A Bible verse on your lock screen.",
      promiseLine1: "Let God's Word be the first thing you see.",
      promiseLine2: "One verse can change the way you face your day.",
    },
  },
  {
    id: "peace",
    seed: 1024,
    backgrounds: [
      "daily-verse-bg/bg-jesus-dawn-prayer.jpg",
      "daily-verse-bg/bg-mountain-dawn.jpg",
      "daily-verse-bg/bg-golden-sky.jpg",
      "daily-verse-bg/bg-praying-hands.jpg",
    ],
    copy: {
      glintLine1: "The world wakes up loud.",
      glintLine2: "Your soul doesn't have to.",
      boringLine1: "Notifications. Headlines.",
      boringLine2: "Noise before you've even breathed.",
      reasonKicker: "What if peace…",
      reasonLine1: "…met you before the noise did?",
      reasonLine2: "A quiet word from God, on your lock screen.",
      promiseLine1: "Begin the day with stillness.",
      promiseLine2: "One verse. One breath. One soul anchored in Him.",
    },
  },
  {
    id: "strength",
    seed: 7777,
    backgrounds: [
      "daily-verse-bg/bg-jesus-majestic.jpg",
      "daily-verse-bg/bg-cross-heavenly-light.jpg",
      "daily-verse-bg/bg-cross-crown.jpg",
      "daily-verse-bg/bg-jesus-halo-sunset.jpg",
    ],
    copy: {
      glintLine1: "Some mornings feel heavy.",
      glintLine2: "Some battles start at sunrise.",
      boringLine1: "The phone lights up.",
      boringLine2: "The weight settles back in.",
      reasonKicker: "What if strength…",
      reasonLine1: "…was the first thing you saw?",
      reasonLine2: "His promises, waiting on your screen.",
      promiseLine1: "Carry His Word into every battle.",
      promiseLine2: "You were never meant to face the day alone.",
    },
  },
  {
    id: "wonder",
    seed: 3333,
    backgrounds: [
      "daily-verse-bg/bg-jesus-clouds.jpg",
      "daily-verse-bg/bg-jesus-water-moon.jpg",
      "daily-verse-bg/bg-shepherd-sheep.jpg",
      "daily-verse-bg/bg-jesus-dawn-prayer.jpg",
    ],
    copy: {
      glintLine1: "There is more",
      glintLine2: "than this screen.",
      boringLine1: "Same swipe. Same scroll.",
      boringLine2: "Same hollow morning.",
      reasonKicker: "What if Heaven…",
      reasonLine1: "…whispered through your lock screen?",
      reasonLine2: "A verse, written for your today.",
      promiseLine1: "Every morning, He speaks first.",
      promiseLine2: "All you have to do is open your eyes.",
    },
  },
  {
    id: "anchor",
    seed: 5150,
    backgrounds: [
      "daily-verse-bg/bg-jesus-storm-calm.jpg",
      "daily-verse-bg/bg-hands-holding-bible.jpg",
      "daily-verse-bg/bg-jesus-mountain-sunrise.jpg",
      "daily-verse-bg/bg-cross-dawn-rays.jpg",
    ],
    copy: {
      glintLine1: "The world keeps shifting.",
      glintLine2: "Your anchor doesn't.",
      boringLine1: "Doubt before breakfast.",
      boringLine2: "Worry before the day begins.",
      reasonKicker: "What if Jesus…",
      reasonLine1: "…spoke first, every morning?",
      reasonLine2: "A verse from the Bible, waiting on your screen.",
      promiseLine1: "Anchor your soul before the day pulls you.",
      promiseLine2: "One word from Christ steadies everything.",
    },
  },
  {
    id: "light",
    seed: 8642,
    backgrounds: [
      "daily-verse-bg/bg-open-bible-glow.jpg",
      "daily-verse-bg/bg-cross-dawn-rays.jpg",
      "daily-verse-bg/bg-jesus-risen-angels.jpg",
      "daily-verse-bg/bg-hands-holding-bible.jpg",
    ],
    copy: {
      glintLine1: "Before the day finds you,",
      glintLine2: "let the Light find you first.",
      boringLine1: "Screens. Scrolls. Static.",
      boringLine2: "Nothing that feeds your soul.",
      reasonKicker: "What if Scripture…",
      reasonLine1: "…lit up your phone before anything else?",
      reasonLine2: "A Bible verse, glowing where the world used to.",
      promiseLine1: "Wake up to His Word, not the noise.",
      promiseLine2: "Let the Light of Christ open your eyes each morning.",
    },
  },
  {
    id: "renewal",
    seed: 2468,
    backgrounds: [
      "daily-verse-bg/bg-jesus-mountain-sunrise.jpg",
      "daily-verse-bg/bg-jesus-risen-angels.jpg",
      "daily-verse-bg/bg-open-bible-glow.jpg",
      "daily-verse-bg/bg-jesus-storm-calm.jpg",
    ],
    copy: {
      glintLine1: "Mornings can be more",
      glintLine2: "than just another day.",
      boringLine1: "Same alarm. Same scroll.",
      boringLine2: "Same heart, never refilled.",
      reasonKicker: "What if His Word…",
      reasonLine1: "…renewed you before the world drained you?",
      reasonLine2: "A Bible verse from Jesus, on every lock screen.",
      promiseLine1: "Be made new before the day begins.",
      promiseLine2: "One verse. One promise. One mercy at sunrise.",
    },
  },
  {
    id: "first-thing",
    seed: 9119,
    backgrounds: [
      "daily-verse-bg/bg-jesus-mountain-sunrise.jpg",
      "daily-verse-bg/bg-cross-dawn-rays.jpg",
      "daily-verse-bg/bg-open-bible-glow.jpg",
      "daily-verse-bg/bg-jesus-halo-sunset.jpg",
    ],
    copy: {
      glintLine1: "What's the first thing",
      glintLine2: "you see each morning?",
      boringLine1: "Emails. Algorithms.",
      boringLine2: "Other people's lives.",
      reasonKicker: "Imagine if…",
      reasonLine1: "…it was Jesus instead.",
      reasonLine2: "A new Bible verse, every time you unlock.",
      promiseLine1: "Let Him be the first voice you hear.",
      promiseLine2: "Before the world ever gets a word in.",
    },
  },
  {
    id: "tired-soul",
    seed: 6611,
    backgrounds: [
      "daily-verse-bg/bg-prayer-bible-candle.jpg",
      "daily-verse-bg/bg-prayer-folded-hands.jpg",
      "daily-verse-bg/bg-jesus-storm-calm.jpg",
      "daily-verse-bg/bg-jesus-dawn-prayer.jpg",
    ],
    copy: {
      glintLine1: "Tired of waking up",
      glintLine2: "already empty?",
      boringLine1: "Scroll. Compare. Numb.",
      boringLine2: "Repeat until exhausted.",
      reasonKicker: "What if mornings…",
      reasonLine1: "…began with God's voice?",
      reasonLine2: "One verse from Scripture, right on your lock screen.",
      promiseLine1: "His Word never runs dry.",
      promiseLine2: "Wake to peace from Jesus, not pressure from the world.",
    },
  },
  {
    id: "every-unlock",
    seed: 3030,
    backgrounds: [
      "daily-verse-bg/bg-jesus-risen-angels.jpg",
      "daily-verse-bg/bg-jesus-majestic.jpg",
      "daily-verse-bg/bg-cross-heavenly-light.jpg",
      "daily-verse-bg/bg-shepherd-sheep.jpg",
    ],
    copy: {
      glintLine1: "You unlock your phone",
      glintLine2: "100 times a day.",
      boringLine1: "100 chances to scroll.",
      boringLine2: "100 chances to forget Him.",
      reasonKicker: "What if every unlock…",
      reasonLine1: "…was a moment with Jesus?",
      reasonLine2: "A fresh Bible verse, waiting on your screen.",
      promiseLine1: "Turn every glance into a prayer.",
      promiseLine2: "Let His Word follow you through the whole day.",
    },
  },
];



console.log("Bundling…");
const bundled = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), webpackOverride: (c) => c });

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const { execSync } = await import("child_process");
const music = path.resolve(__dirname, "../public/audio/ReelAudio-10281.mp3");

// Optional: filter variants via CLI arg list, e.g. `node script.mjs out peace,wonder`
const filterArg = process.argv[3];
const toRender = filterArg
  ? VARIANTS.filter((v) => filterArg.split(",").includes(v.id))
  : VARIANTS;

for (const variant of toRender) {
  const inputProps = {
    verses: pickVerses(variant.seed, 4),
    backgrounds: variant.backgrounds,
    audioTrack: "ReelAudio-10281.mp3",
    copy: variant.copy,
  };

  const videoOnly = path.join(OUT_DIR, `meta-daily-verse-${variant.id}-video-only.mp4`);
  const out = path.join(OUT_DIR, `meta-daily-verse-${variant.id}.mp4`);
  console.log(`\n=== Variant: ${variant.id} ===`);
  console.log(`→ ${out}`);
  console.log(`verses: ${inputProps.verses.map(v => v.reference).join(", ")}`);

  const t0 = Date.now();
  const composition = await selectComposition({
    serveUrl: bundled, id: "meta-daily-verse", puppeteerInstance: browser, inputProps,
  });
  await renderMedia({
    composition, serveUrl: bundled, codec: "h264",
    outputLocation: videoOnly, inputProps, puppeteerInstance: browser,
    muted: true,
    concurrency: Number(process.env.REMOTION_RENDER_CONCURRENCY || 1),
  });
  console.log(`✓ video ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const duration = composition.durationInFrames / composition.fps;
  const filter = `[0:a]aloop=loop=-1:size=2e9,atrim=0:${duration},asetpts=N/SR/TB,afade=t=in:st=0:d=0.3,afade=t=out:st=${duration - 1.0}:d=1.0,volume=0.9[a]`;
  execSync(`ffmpeg -y -i "${music}" -i "${videoOnly}" -filter_complex "${filter}" -map 1:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest "${out}"`, { stdio: "inherit" });
  fs.unlinkSync(videoOnly);
  console.log(`Done → ${out}`);
}

await browser.close({ silent: false });
console.log("\nAll variants rendered.");
