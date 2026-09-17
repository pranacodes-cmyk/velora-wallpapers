// Renders Prayly "Wow" ad (23s, beat-locked, cinematic).
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.argv[2] || "/mnt/documents/wow-ad";
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log("Bundling…");
const bundled = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), webpackOverride: (c) => c });

const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});

const { execSync } = await import("child_process");
const music = path.resolve(__dirname, "../public/audio/ReelAudio-10281.mp3");

const videoOnly = path.join(OUT_DIR, "meta-wow-video-only.mp4");
const out = path.join(OUT_DIR, "meta-wow.mp4");

const t0 = Date.now();
const composition = await selectComposition({ serveUrl: bundled, id: "meta-wow", puppeteerInstance: browser });
await renderMedia({
  composition, serveUrl: bundled, codec: "h264",
  outputLocation: videoOnly, puppeteerInstance: browser,
  muted: true,
  concurrency: Number(process.env.REMOTION_RENDER_CONCURRENCY || 1),
});
console.log(`✓ video ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const duration = composition.durationInFrames / composition.fps;
const filter = `[0:a]atrim=0:${duration},asetpts=N/SR/TB,afade=t=in:st=0:d=0.2,afade=t=out:st=${duration - 0.8}:d=0.8,volume=0.95[a]`;
execSync(`ffmpeg -y -i "${music}" -i "${videoOnly}" -filter_complex "${filter}" -map 1:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest "${out}"`, { stdio: "inherit" });
fs.unlinkSync(videoOnly);
console.log(`Done → ${out}`);

await browser.close({ silent: false });
