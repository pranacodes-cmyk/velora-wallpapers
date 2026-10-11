import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const output = process.argv[2] || "/mnt/documents/prayly-prayscreen-feature.mp4";
fs.mkdirSync(path.dirname(output), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), webpackOverride: (c) => c });
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: "chrome-for-testing",
});
const composition = await selectComposition({ serveUrl, id: "prayscreen-feature", puppeteerInstance: browser });
await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: output, puppeteerInstance: browser, concurrency: 1, crf: 18 });
await browser.close({ silent: false });
console.log(output);
