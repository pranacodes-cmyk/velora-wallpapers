// Two-part translation polish:
//  1. Hindi register unification — every second-person address to the reader/God
//     uses the तुम family (never the archaic तू family), so verses and prose match.
//  2. Rhythm pass for es/pt/id — break sentences longer than 170 chars into
//     natural shorter ones without changing meaning.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const KINDS = ["verses", "reflections", "prayers", "journeys", "quiz"];
const cacheDir = "/tmp/polish-cache";
const LINE_RE = /^(\s*)("(?:[^"\\]|\\.)*")(\s*:\s*)("(?:[^"\\]|\\.)*")(\s*,?\s*)$/gm;

function parsePack(file) {
  const text = fs.readFileSync(file, "utf8");
  const entries = new Map();
  for (const m of text.matchAll(LINE_RE)) entries.set(JSON.parse(m[2]), JSON.parse(m[4]));
  return { text, entries };
}

function writePack(file, original, replacements) {
  const text = original.replace(LINE_RE, (line, indent, rawKey, colon, rawValue, suffix) => {
    const key = JSON.parse(rawKey);
    return replacements.has(key)
      ? `${indent}${rawKey}${colon}${JSON.stringify(replacements.get(key))}${suffix}`
      : line;
  });
  fs.writeFileSync(file, text);
}

const TU = /(^|[\s"“(—-])(तू|तुझ|तेरा|तेरी|तेरे|तुझे|तुझको|तुझसे|तूने)/;

const HINDI_SYSTEM = `You are a native Hindi Christian editor. Rewrite each Hindi string so that every second-person address uses the तुम family (तुम, तुम्हारा, तुम्हें, तुमने) instead of the archaic तू family (तू, तेरा, तुझे, तूने), adjusting verb conjugation correctly (तू है → तुम हो, तू करेगा → तुम करोगे). Keep meaning, tone and Scripture sense identical. Keep the Christian glossary: परमेश्वर, प्रभु, यीशु, पवित्र आत्मा, वचन, अनुग्रह, विश्वास — never भगवान. Everyday spoken Hindi, no Sanskritized or archaic words. Preserve any {{placeholders}} exactly. Preserve punctuation style and line breaks. Return strictly JSON {"items":[{"key":"...","text":"..."}]} with every supplied key exactly once.`;

const RHYTHM_RULES = {
  es: "Natural Latin American Spanish, warm Christian devotional voice, singular tú.",
  pt: "Natural Brazilian Portuguese, warm Christian devotional voice, você.",
  id: "Natural contemporary Indonesian Christian language, warm kamu register, Tuhan/Allah for God.",
};
function rhythmSystem(lang) {
  return `You are a native Christian devotional editor. Each supplied string contains at least one sentence that is too long to read comfortably aloud. Rewrite it so no sentence runs long: split into two or three shorter sentences, cut filler, and keep the rhythm speakable. ${RHYTHM_RULES[lang]} Do not change meaning, theology, emotional force, names, or Scripture wording — if a long sentence is a direct Scripture quotation, keep the quoted wording intact and only adjust surrounding prose. Preserve any {{placeholders}} exactly. Return strictly JSON {"items":[{"key":"...","text":"..."}]} with every supplied key exactly once.`;
}

function extractJson(content) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : content;
  return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
}

async function callAI(system, items, attempt = 0) {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(10 * 60 * 1000),
      headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(items) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    const data = await res.json();
    const byKey = new Map(extractJson(data.choices?.[0]?.message?.content ?? "").items.map((i) => [i.key, i.text]));
    const missing = items.filter((i) => typeof byKey.get(i.key) !== "string" || !byKey.get(i.key).trim());
    if (missing.length) throw new Error(`missing ${missing.length}/${items.length}`);
    return items.map((i) => ({ key: i.key, text: byKey.get(i.key) }));
  } catch (e) {
    if (attempt < 7) {
      await new Promise((r) => setTimeout(r, Math.min(45000, 2500 * 2 ** attempt)));
      return callAI(system, items, attempt + 1);
    }
    throw e;
  }
}

async function cached(tag, system, batch) {
  const file = path.join(cacheDir, `${tag}.json`);
  if (fs.existsSync(file)) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch {} }
  const out = await callAI(system, batch);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  return out;
}

// placeholder + safety guard
function safe(before, after) {
  const ph = (s) => (s.match(/{{[^}]+}}/g) ?? []).sort().join("|");
  if (ph(before) !== ph(after)) return false;
  if (!after.trim()) return false;
  if (after.length > before.length * 1.9 + 40) return false;
  return true;
}

async function runJob({ tag, file, system, pick }) {
  const pack = parsePack(file);
  const items = [...pack.entries].filter(([k, v]) => pick(v)).map(([key, current]) => ({ key, current }));
  if (!items.length) { console.log(`${tag}: nothing to do`); return 0; }
  const batches = [];
  for (let i = 0; i < items.length; i += 25) batches.push(items.slice(i, i + 25));
  const replacements = new Map();
  for (let i = 0; i < batches.length; i += 4) {
    const group = batches.slice(i, i + 4);
    const results = await Promise.all(group.map((b, j) => cached(`${tag}-${i + j}`, system, b)));
    for (const r of results) for (const it of r) {
      const before = pack.entries.get(it.key);
      if (safe(before, it.text)) replacements.set(it.key, it.text);
    }
    console.log(`${tag}: ${Math.min((i + group.length) * 25, items.length)}/${items.length}`);
  }
  writePack(file, pack.text, replacements);
  console.log(`${tag}: wrote ${replacements.size}/${items.length}`);
  return replacements.size;
}

if (!process.env.LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY required");

const jobs = [];
for (const kind of KINDS) {
  jobs.push({
    tag: `hi-${kind}`,
    file: path.join(root, `src/i18n/content/${kind}/hi.ts`),
    system: HINDI_SYSTEM,
    pick: (v) => TU.test(v),
  });
}
for (const lang of ["es", "pt", "id"]) {
  for (const kind of ["reflections", "prayers", "journeys"]) {
    jobs.push({
      tag: `${lang}-${kind}`,
      file: path.join(root, `src/i18n/content/${kind}/${lang}.ts`),
      system: rhythmSystem(lang),
      pick: (v) => v.split(/(?<=[.!?])\s+/).some((s) => s.length > 170),
    });
  }
}

const settled = await Promise.allSettled(jobs.map(runJob));
settled.forEach((r, i) => { if (r.status === "rejected") console.log(`FAILED ${jobs[i].tag}: ${r.reason?.message}`); });
console.log("done");
