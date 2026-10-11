#!/usr/bin/env node
/**
 * Modernize Bible verse translations in all non-English languages.
 *
 * Problem: verse strings were taken from 100+ year old formal Bible versions
 * (Hindi OV, RVR1960, Almeida, Segond 1910, Luther, TB) while the surrounding
 * devotional prose is modern and conversational. Readers cannot follow them.
 *
 * Fix: rewrite every verse string using the language's *contemporary* Bible
 * register (NVI / NTLH / Segond 21-BDS / NGÜ-HFA / IRV-Hindi / BIS / MBB style)
 * — meaning-faithful, naturally spoken, same informal address as the prose.
 *
 * Files touched (verse strings only, references untouched):
 *   src/i18n/content/verses/<lang>.ts    keys "v.<Reference>"
 *   src/i18n/content/journeys/<lang>.ts  keys ending in ".verse"
 *
 * Usage: LOVABLE_API_KEY=... node scripts/modernize-verses.mjs [lang...]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, "artifacts/localization/verse-cache");
const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const API_KEY = process.env.LOVABLE_API_KEY;
if (!API_KEY) {
  console.error("LOVABLE_API_KEY required (this script must never use OPENAI_API_KEY)");
  process.exit(1);
}

const BATCH = 20;
const CONCURRENCY = 4;

const LANGS = {
  hi: {
    name: "Hindi",
    version: "contemporary Hindi Bible (IRV / Hindi Contemporary Version style)",
    notes:
      "Use परमेश्वर / प्रभु for God (never भगवान). Avoid Sanskritised OV vocabulary like निवेदन, सम्मुख, उपस्थित किए जाएँ, व्याकुल, धीरज धरे. Use everyday spoken Hindi that a normal person understands on first read. Keep the 'तू/तुम' address that scripture uses; do not switch to आप inside verses.",
  },
  es: {
    name: "Spanish",
    version: "Nueva Versión Internacional (NVI) style contemporary Latin American Spanish",
    notes:
      "Never use vosotros/vuestro or archaic forms (estéis afanosos, no desmayes). Use ustedes/tú as the verse requires, modern vocabulary.",
  },
  pt: {
    name: "Brazilian Portuguese",
    version: "NVI / NTLH style contemporary Brazilian Portuguese",
    notes:
      "Never use andeis / vossos / assombre / vós. Use você/vocês and modern Brazilian vocabulary.",
  },
  fr: {
    name: "French",
    version: "Segond 21 / Bible du Semeur style contemporary French",
    notes:
      "Avoid Segond-1910 archaisms (ne promène pas des regards inquiets, L'Éternel where Le Seigneur reads better in devotional context is acceptable to keep as l'Éternel only in Psalms). Use natural modern French; keep tu when God addresses one person.",
  },
  de: {
    name: "German",
    version: "Neue Genfer Übersetzung / Hoffnung für Alle style contemporary German",
    notes:
      "Avoid Luther archaisms (mir wird nichts mangeln, kundwerden, sei nicht ängstlich). Use natural modern German, du-address where the verse speaks to one person.",
  },
  id: {
    name: "Indonesian",
    version: "BIS / AYT style contemporary Indonesian",
    notes:
      "Avoid TB-1974 stiffness (janganlah hendaknya, nyatakanlah, takkan kekurangan aku). Use natural modern Indonesian, 'kamu' address, Tuhan/Allah as appropriate.",
  },
  fil: {
    name: "Filipino (Tagalog)",
    version: "Magandang Balita Biblia / ASD style contemporary Filipino",
    notes:
      "Use natural conversational Filipino as spoken today; avoid overly deep or archaic Tagalog. Diyos for God, Panginoon for Lord.",
  },
};

const TARGETS = [
  { dir: "src/i18n/content/verses", match: (k) => k.startsWith("v.") },
  { dir: "src/i18n/content/journeys", match: (k) => k.endsWith(".verse") },
];

const KEY_RE = /^(\s*)"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)",?\s*$/;

function unescape(s) {
  return JSON.parse(`"${s}"`);
}
function escape(s) {
  return JSON.stringify(s).slice(1, -1);
}

function referenceFor(key, langFile) {
  // "v.Philippians 4:6" -> English reference; journey keys -> look up sibling ".reference"
  if (key.startsWith("v.")) return key.slice(2);
  const refKey = key.replace(/\.verse$/, ".reference");
  return langFile.get(refKey) ?? "";
}

function readEntries(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const map = new Map();
  lines.forEach((line, i) => {
    const m = KEY_RE.exec(line);
    if (m) map.set(unescape(m[2]), unescape(m[3]), i);
  });
  return { lines, map };
}

function lineIndexFor(lines) {
  const idx = new Map();
  lines.forEach((line, i) => {
    const m = KEY_RE.exec(line);
    if (m) idx.set(unescape(m[2]), i);
  });
  return idx;
}

async function callGateway(system, user, attempt = 0) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`gateway ${res.status} after retries`);
    const wait = Number(res.headers.get("retry-after") || 0) * 1000 || 2000 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, wait + Math.random() * 500));
    return callGateway(system, user, attempt + 1);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`TERMINAL gateway ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  return json.choices?.[0]?.message?.content ?? "";
}

function normalize(parsed) {
  const out = {};
  if (Array.isArray(parsed)) {
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const id = row.id ?? row.key;
      const text = row.text ?? row.verse ?? row.value ?? row.rewritten;
      if (typeof id === "string" && typeof text === "string") out[id] = text;
    }
    return out;
  }
  if (parsed && typeof parsed === "object") {
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") out[k] = v;
      else if (v && typeof v === "object") {
        const text = v.text ?? v.verse ?? v.value ?? v.rewritten;
        if (typeof text === "string") out[k] = text;
      } else if (Array.isArray(v)) {
        Object.assign(out, normalize(v));
      }
    }
    // shape: { verses: [...] }
    for (const v of Object.values(parsed)) if (Array.isArray(v)) Object.assign(out, normalize(v));
  }
  return out;
}

function parseJsonBlock(raw) {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const firstObj = cleaned.indexOf("{");
  const firstArr = cleaned.indexOf("[");
  const starts = [firstObj, firstArr].filter((i) => i >= 0);
  if (starts.length) {
    const start = Math.min(...starts);
    const closer = cleaned[start] === "[" ? "]" : "}";
    const end = cleaned.lastIndexOf(closer);
    if (end > start) {
      try {
        const got = normalize(JSON.parse(cleaned.slice(start, end + 1)));
        if (Object.keys(got).length) return got;
      } catch {
        /* fall through */
      }
    }
  }
  // Tolerant scan for both shapes.
  const out = {};
  const pairRe = /"(k\d+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = pairRe.exec(cleaned))) {
    try {
      out[m[1]] = JSON.parse(`"${m[2]}"`);
    } catch {
      out[m[1]] = m[2];
    }
  }
  const rowRe = /"id"\s*:\s*"(k\d+)"\s*,\s*"(?:text|verse|value|rewritten)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  while ((m = rowRe.exec(cleaned))) {
    try {
      out[m[1]] = JSON.parse(`"${m[2]}"`);
    } catch {
      out[m[1]] = m[2];
    }
  }
  if (!Object.keys(out).length) throw new Error("no verse pairs in response");
  return out;
}

async function rewriteBatch(lang, scope, items) {
  const cfg = LANGS[lang];
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${lang}|${scope}|${items.map((i) => `${i.key}=${i.current}`).join("|")}`)
    .digest("hex")
    .slice(0, 24);
  const cacheKey = `${lang}-${scope}-${fingerprint}`;
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    } catch {
      /* refetch */
    }
  }

  const system = `You are a Bible translation editor producing ${cfg.name} scripture text for a mobile devotional app.

Task: rewrite each verse into ${cfg.version}. The current text comes from an archaic Bible version that ordinary readers cannot understand. Your rewrite must be:
- MEANING-FAITHFUL to the biblical text at that reference (never paraphrase away doctrine, never add ideas)
- naturally readable aloud today by a regular person, first read, no dictionary
- similar length to the original (do not expand into commentary)
- scripture in tone: dignified but plain. Not slangy, not corporate.
${cfg.notes}

Output STRICT JSON only, a single flat object mapping every given id to its rewritten verse string: {"k0": "...", "k1": "..."}. Do not use arrays or nested objects. No markdown, no commentary, no extra keys. Keep any existing leading/trailing punctuation style natural for the language. Do not wrap verses in quotation marks.`;

  const user = JSON.stringify(
    items.map((i) => ({ id: i.id, reference: i.reference, current: i.current })),
    null,
    1
  );

  const raw = await callGateway(system, user);
  const out = parseJsonBlock(raw);
  const result = {};
  for (const item of items) {
    const v = out[item.id];
    if (typeof v !== "string" || !v.trim()) continue;
    const clean = v.replace(/\s+/g, " ").trim().replace(/^["“«„]|["”»]$/g, "").trim();
    if (!clean || clean.length < 5) continue;
    if (clean.length > item.current.length * 2.6 + 40) continue; // guard against commentary
    result[item.id] = clean;
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(result, null, 1));
  return result;
}

async function runPool(tasks, concurrency) {
  let next = 0;
  const results = [];
  const workers = Array.from({ length: concurrency }, async () => {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = await tasks[i]();
      } catch (e) {
        if (String(e.message).includes("TERMINAL")) throw e;
        console.error("  batch failed, retrying once:", e.message);
        try {
          results[i] = await tasks[i]();
        } catch (e2) {
          console.error("  batch failed again:", e2.message);
          results[i] = {};
        }
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function processLang(lang) {
  let changed = 0;
  for (const target of TARGETS) {
    const file = path.join(ROOT, target.dir, `${lang}.ts`);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, "utf8");
    const lines = src.split("\n");
    const entries = new Map();
    for (const line of lines) {
      const m = KEY_RE.exec(line);
      if (m) entries.set(unescape(m[2]), unescape(m[3]));
    }
    const items = [];
    let n = 0;
    for (const [key, value] of entries) {
      if (!target.match(key)) continue;
      const reference = key.startsWith("v.") ? key.slice(2) : entries.get(key.replace(/\.verse$/, ".reference")) ?? "";
      items.push({ id: `k${n++}`, key, reference, current: value });
    }
    if (!items.length) continue;

    const batches = [];
    for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
    console.log(`[${lang}] ${target.dir.split("/").pop()}: ${items.length} verses in ${batches.length} batches`);
    const results = await runPool(
      batches.map((b) => () => rewriteBatch(lang, target.dir.split("/").pop(), b)),
      CONCURRENCY
    );

    const patch = new Map();
    batches.forEach((batch, bi) => {
      const res = results[bi] || {};
      for (const item of batch) {
        const v = res[item.id];
        if (v && v !== item.current) patch.set(item.key, v);
      }
    });

    const idx = lineIndexFor(lines);
    for (const [key, value] of patch) {
      const li = idx.get(key);
      if (li == null) continue;
      const m = KEY_RE.exec(lines[li]);
      if (!m) continue;
      const trailing = lines[li].trimEnd().endsWith(",") ? "," : "";
      lines[li] = `${m[1]}"${escape(key)}": "${escape(value)}"${trailing}`;
      changed++;
    }
    fs.writeFileSync(file, lines.join("\n"));
    console.log(`[${lang}] ${path.relative(ROOT, file)}: ${patch.size} verses modernized`);
  }
  return changed;
}

const langs = process.argv.slice(2).filter((a) => LANGS[a]);
const targets = langs.length ? langs : Object.keys(LANGS);
let total = 0;
for (const lang of targets) {
  total += await processLang(lang);
}
console.log(`done. ${total} verse strings updated.`);
