// Renders the full Prayly pitch ad with voiceover hook + lockscreen mockup + impact + CTA.
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

const ALL = loadVerses();
console.log(`Loaded ${ALL.length} verses`);

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function pickVerses(seed, n = 4) {
  const rng = mulberry32(seed);
  const pool = [...ALL];
  const out = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * pool.length);
    const v = pool.splice(idx, 1)[0];
    const d = new Date(today); d.setDate(today.getDate() + i);
    out.push({ text: v.text, reference: v.reference, weekday: WEEKDAYS[d.getDay()], date: `${MONTHS[d.getMonth()]} ${d.getDate()}` });
  }
  return out;
}

const BGS = ["daily-verse-bg/bg-03.jpg", "daily-verse-bg/bg-12.jpg", "daily-verse-bg/bg-18.jpg", "daily-verse-bg/bg-07.jpg"];

console.log("Bundling…");
const bundled = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), webpackOverride: (c) => c });

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const inputProps = {
  verses: pickVerses(909, 3),
  backgrounds: BGS.slice(0, 3),
  audioTrack: "ReelAudio-1283.mp3",
};

const videoOnly = path.join(OUT_DIR, "07-prayly-pitch-video-only.mp4");
const out = path.join(OUT_DIR, "07-prayly-pitch-voiceover.mp4");
console.log(`→ ${out}`);
console.log(`verses: ${inputProps.verses.map(v => v.reference).join(", ")}`);

const t0 = Date.now();
const composition = await selectComposition({
  serveUrl: bundled, id: "prayly-pitch", puppeteerInstance: browser, inputProps,
});
await renderMedia({
  composition, serveUrl: bundled, codec: "h264",
  outputLocation: videoOnly, inputProps, puppeteerInstance: browser,
  muted: true,
  concurrency: Number(process.env.REMOTION_RENDER_CONCURRENCY || 1),
});
console.log(`✓ video ${((Date.now() - t0) / 1000).toFixed(1)}s`);

await browser.close({ silent: false });

// Mix audio externally (system ffmpeg lacks libfdk_aac so we can't let remotion handle it)
const { execSync } = await import("child_process");
const vo = path.resolve(__dirname, "../public/audio/vo-hook.wav");
const music = path.resolve(__dirname, "../public/audio/ReelAudio-1283.mp3");
const duration = composition.durationInFrames / composition.fps;
console.log(`Mixing audio (${duration}s)…`);
const filter = `[1:a]aloop=loop=-1:size=2e9,atrim=0:${duration},volume='if(lt(t,2.5),0.18,if(lt(t,3.2),0.18+(t-2.5)/0.7*0.42,0.6))':eval=frame[bg];[0:a]apad,atrim=0:${duration},volume=1.0[voc];[voc][bg]amix=inputs=2:duration=first:dropout_transition=0[a]`;
execSync(`ffmpeg -y -i "${vo}" -i "${music}" -i "${videoOnly}" -filter_complex "${filter}" -map 2:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest "${out}"`, { stdio: "inherit" });
fs.unlinkSync(videoOnly);
console.log("Done.");
console.log("Done.");
