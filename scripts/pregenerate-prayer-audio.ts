// One-off bulk pre-generation of every daily prayer narration.
// Run AFTER ElevenLabs credits are topped up:
//
//   bun scripts/pregenerate-prayer-audio.ts
//   bun scripts/pregenerate-prayer-audio.ts --force      # re-generate all
//   bun scripts/pregenerate-prayer-audio.ts 42           # only index 42
//   bun scripts/pregenerate-prayer-audio.ts --range=0-50 # only first 50
//
// Sequential w/ small breather → respects ElevenLabs rate limits.
// Uses the SAME enriched text the user sees (getDailyPrayer reproduces the
// in-app rendering by feeding a synthetic date that resolves to the index).
import { getDailyPrayer, PRAYER_COUNT } from "../src/data/dailyVerses";

const SUPABASE_URL = "https://jbwhlogvldhsnxtpxwih.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impid2hsb2d2bGRoc254dHB4d2loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDk5NjcsImV4cCI6MjA5MjU4NTk2N30.ghe30JyFFO7NZr8xwL_r8UOxURkEbmqwwwKTompUb7w";

const args = process.argv.slice(2);
const force = args.includes("--force");
const rangeArg = args.find((a) => a.startsWith("--range="));
const onlyArg = args.find((a) => !a.startsWith("--") && /^\d+$/.test(a));

// Build the list of indexes to process
let indexes: number[];
if (onlyArg) {
  indexes = [Number(onlyArg)];
} else if (rangeArg) {
  const [from, to] = rangeArg.replace("--range=", "").split("-").map(Number);
  indexes = [];
  for (let i = from; i <= to && i < PRAYER_COUNT; i++) indexes.push(i);
} else {
  indexes = Array.from({ length: PRAYER_COUNT }, (_, i) => i);
}

// Helper: reproduce the exact enriched text for index N by feeding a date
// that maps to that day-of-year (getDailyPrayer keys on dayOfYear % length).
function textForIndex(i: number): string {
  const d = new Date(2025, 0, 0);
  d.setDate(d.getDate() + i + 1);
  return getDailyPrayer(d);
}

console.log(`▶ ${indexes.length} prayer(s) to process${force ? " (force)" : ""}`);

// Sanity threshold: a real ~370-char prayer MP3 @ 128kbps ≈ 200-400 KB.
// Anything under 20 KB is almost certainly a truncated / failed render.
const MIN_BYTES = 20_000;
const BATCH_SIZE = 25;

let ok = 0;
let cached = 0;
let failed = 0;
let suspicious = 0;
const failures: string[] = [];
const suspicious_list: string[] = [];

async function processOne(i: number, attempt = 1): Promise<void> {
  const text = textForIndex(i);
  const label = `#${String(i).padStart(3, "0")} (${String(text.length).padStart(4)}ch)`;
  const t0 = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-prayer-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ index: i, text, force }),
    });
    const data = await res.json().catch(() => ({}));
    const ms = Date.now() - t0;
    if (!res.ok) {
      if (attempt < 2) {
        console.log(`${label} retry (${res.status})`);
        await new Promise((r) => setTimeout(r, 1500));
        return processOne(i, attempt + 1);
      }
      failed++;
      failures.push(`#${i}: ${res.status} ${JSON.stringify(data)}`);
      console.log(`${label} ✗ ${res.status} (${ms}ms)`);
      return;
    }
    if (data.cached) {
      cached++;
      console.log(`${label} ◯ cached (${ms}ms)`);
      return;
    }
    const bytes = Number(data.bytes ?? 0);
    if (bytes < MIN_BYTES) {
      suspicious++;
      suspicious_list.push(`#${i}: only ${bytes}B`);
      console.log(`${label} ⚠ tiny ${bytes}B (${(ms / 1000).toFixed(1)}s)`);
    } else {
      ok++;
      console.log(`${label} ✓ ${(bytes / 1024).toFixed(0)}KB (${(ms / 1000).toFixed(1)}s)`);
    }
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500));
      return processOne(i, attempt + 1);
    }
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`#${i}: ${msg}`);
    console.log(`${label} ✗ ${msg}`);
  }
}

for (let b = 0; b < indexes.length; b += BATCH_SIZE) {
  const batch = indexes.slice(b, b + BATCH_SIZE);
  console.log(`\n── batch ${b / BATCH_SIZE + 1}: prayers ${batch[0]}–${batch[batch.length - 1]} ──`);
  for (const i of batch) {
    await processOne(i);
    await new Promise((r) => setTimeout(r, 350));
  }
  console.log(`   batch done. running totals → ok=${ok} cached=${cached} tiny=${suspicious} failed=${failed}`);
}

console.log("");
console.log(`Done. generated=${ok}  cached=${cached}  tiny=${suspicious}  failed=${failed}`);
if (suspicious_list.length) {
  console.log("\nSuspiciously small (review on R2, may need --force re-render):");
  for (const s of suspicious_list) console.log("  -", s);
}
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log("  -", f);
  process.exit(1);
}
