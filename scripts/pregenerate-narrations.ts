// One-off bulk pre-generation of every journey day's narration.
// Reads RICH_DAYS, composes each script with the SAME util the client uses,
// then sequentially calls the edge function (which uploads to R2 + caches).
// Sequential to respect ElevenLabs rate limits and avoid wasted spend on retries.
//
// Run: bun scripts/pregenerate-narrations.ts
//      bun scripts/pregenerate-narrations.ts --force   (re-generate everything)
//      bun scripts/pregenerate-narrations.ts anxiety-peace::1   (one key)
import { RICH_DAYS } from "../src/data/journeyRichContent";
import { composeNarrationScript } from "../src/lib/narrationScript";

const SUPABASE_URL = "https://jbwhlogvldhsnxtpxwih.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impid2hsb2d2bGRoc254dHB4d2loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDk5NjcsImV4cCI6MjA5MjU4NTk2N30.ghe30JyFFO7NZr8xwL_r8UOxURkEbmqwwwKTompUb7w";

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.find((a) => !a.startsWith("--"));

const entries = Object.entries(RICH_DAYS).filter(([k]) => !only || k === only);
console.log(`▶ ${entries.length} day(s) to process${force ? " (force)" : ""}`);

let ok = 0;
let cached = 0;
let failed = 0;
const failures: string[] = [];

for (const [key, rich] of entries) {
  const [journeyId, dayStr] = key.split("::");
  const day = Number(dayStr);
  const script = composeNarrationScript(rich);
  const label = `${key.padEnd(28)} ${String(script.length).padStart(5)} ch`;
  process.stdout.write(`${label} … `);

  const t0 = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-day-narration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ journeyId, day, script, force }),
    });
    const data = await res.json().catch(() => ({}));
    const ms = Date.now() - t0;
    if (!res.ok) {
      failed++;
      failures.push(`${key}: ${res.status} ${JSON.stringify(data)}`);
      console.log(`✗ ${res.status} (${ms}ms) ${JSON.stringify(data).slice(0, 200)}`);
    } else if (data.cached) {
      cached++;
      console.log(`◯ cached (${ms}ms)`);
    } else {
      ok++;
      console.log(`✓ ${data.bytes ?? "?"}B (${(ms / 1000).toFixed(1)}s)`);
    }
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`${key}: ${msg}`);
    console.log(`✗ ${msg}`);
  }
  // Small breather between calls — protects ElevenLabs rate limit.
  await new Promise((r) => setTimeout(r, 400));
}

console.log("");
console.log(`Done. generated=${ok}  cached=${cached}  failed=${failed}`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log("  -", f);
  process.exit(1);
}
