import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default;
const root = process.cwd();
const locales = ["es", "pt", "fr", "de", "hi", "id", "fil"];
const languageRules = {
  es: "Natural Latin American Spanish, warm Christian devotional voice, singular tú. Avoid Spain-only phrasing and translationese.",
  pt: "Natural Brazilian Portuguese, warm Christian devotional voice, você. Avoid European Portuguese and literal English syntax.",
  fr: "Natural contemporary French, warm Christian devotional voice, singular tu. Scripture may retain established vous wording; prose must never switch to vous.",
  de: "Natural contemporary German, warm Christian devotional voice, singular du. Avoid English calques and bureaucratic or academic wording.",
  hi: "Natural everyday Hindi understood by Indian Christians, respectful आप in guidance. Use परमेश्वर, प्रभु, यीशु, पवित्र आत्मा, वचन, विश्वास, अनुग्रह. Avoid शुद्ध/archaic Hindi and English transliteration where a normal Christian Hindi term exists.",
  id: "Natural contemporary Indonesian Christian language, warm kamu register. Use Allah for God and Tuhan where idiomatic. Avoid stiff formal Anda and English syntax.",
  fil: "Natural conversational Filipino Christian language. Use familiar Filipino church vocabulary, not forced Tagalog coinages or word-for-word English syntax. Keep English only where native Filipino speakers naturally do.",
};

function ast(file) {
  return parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["typescript"] });
}

function value(node) {
  if (!node) return undefined;
  if (node.type === "StringLiteral" || node.type === "NumericLiteral" || node.type === "BooleanLiteral") return node.value;
  if (node.type === "ArrayExpression") return node.elements.map(value);
  if (node.type === "ObjectExpression") {
    return Object.fromEntries(node.properties.filter((p) => p.type === "ObjectProperty").map((p) => [p.key.name ?? p.key.value, value(p.value)]));
  }
  return undefined;
}

function declaration(file, name) {
  let out;
  traverse(ast(file), { VariableDeclarator(p) { if (p.node.id.type === "Identifier" && p.node.id.name === name) out = value(p.node.init); } });
  return out;
}

function englishMap() {
  const journeys = declaration(path.join(root, "src/data/journeys.ts"), "JOURNEYS");
  const rich = declaration(path.join(root, "src/data/journeyRichContent.ts"), "RICH_DAYS");
  const anxiety = declaration(path.join(root, "src/data/journeyGuides.ts"), "anxietyGuides");
  const fallbacks = declaration(path.join(root, "src/data/journeyGuides.ts"), "journeyFallbacks");
  const out = {};
  for (const journey of journeys) {
    const base = `j.${journey.id}`;
    for (const field of ["title", "subtitle", "description"]) out[`${base}.${field}`] = journey[field];
    for (const day of journey.days) for (const field of ["title", "opening", "verse", "reference", "explanation", "prayer"]) out[`${base}.d${day.day}.${field}`] = day[field];
    for (const day of journey.days) {
      const guide = journey.id === "anxiety-peace" ? anxiety[String(day.day)] : fallbacks[journey.id] ?? fallbacks["building-faith"];
      const reflection = guide.reflection ?? `Let "${day.title}" become personal for a moment. Where does this touch your real life today — not in theory, but right now?`;
      for (const [field, text] of Object.entries({ ...guide, reflection })) out[`jg.${journey.id}::${day.day}.${field}`] = text;
    }
  }
  for (const [id, richDay] of Object.entries(rich)) richDay.slides.forEach((slide, index) => {
    const base = `jr.${id}.s${index}`;
    for (const field of ["eyebrow", "title", "continueLabel", "verse", "reference", "prayer"]) if (slide[field]) out[`${base}.${field}`] = slide[field];
    slide.paragraphs?.forEach((text, i) => { out[`${base}.p${i}`] = text; });
    slide.tinyActions?.forEach((text, i) => { out[`${base}.a${i}`] = text; });
    if (slide.breathPrayer) {
      out[`${base}.breath.inhale`] = slide.breathPrayer.inhale;
      out[`${base}.breath.exhale`] = slide.breathPrayer.exhale;
    }
  });
  return out;
}

function parsePack(file) {
  const text = fs.readFileSync(file, "utf8");
  const entries = new Map();
  const re = /^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/gm;
  for (const match of text.matchAll(re)) entries.set(JSON.parse(match[1]), JSON.parse(match[2]));
  return { text, entries };
}

const cacheDir = "/tmp/journey-rewrite/cache";

function systemPrompt(locale) {
  return `You are a senior native Christian devotional writer and Bible localization editor. Rewrite every supplied translation so it feels originally written by a caring native speaker, while preserving the English meaning and emotional force exactly. ${languageRules[locale]} Keep established Bible names and recognizable Scripture wording. Preserve the distinction between direct Scripture quotation and devotional prose. Never invent facts, intensify promises, alter theology, omit an idea, add denominational doctrine, or translate an English metaphor literally when the target language needs a natural equivalent. Commentary that discusses a quoted word must use the exact corresponding word found in that localized verse. Titles should be concise and emotionally natural; prayers must sound speakable aloud. Return strictly JSON of the shape {"items":[{"key":"...","text":"..."}]} with every supplied key exactly once and nothing else.`;
}

function extractJson(content) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : content;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(raw.slice(start, end + 1));
}

async function rewriteBatch(locale, items, attempt = 0) {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(15 * 60 * 1000),
      headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: systemPrompt(locale) },
          { role: "user", content: JSON.stringify(items) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
    const data = await response.json();
    const parsed = extractJson(data.choices?.[0]?.message?.content ?? "");
    const byKey = new Map(parsed.items.map((item) => [item.key, item.text]));
    const missing = items.filter((item) => typeof byKey.get(item.key) !== "string" || !byKey.get(item.key).trim());
    if (missing.length) throw new Error(`missing ${missing.length}/${items.length}`);
    return items.map((item) => ({ key: item.key, text: byKey.get(item.key) }));
  } catch (error) {
    if (attempt < 8) {
      await new Promise((r) => setTimeout(r, Math.min(60000, 3000 * 2 ** attempt)));
      return rewriteBatch(locale, items, attempt + 1);
    }
    throw new Error(`${locale}: ${error.message}`);
  }
}


async function cachedBatch(locale, batch) {
  const file = path.join(cacheDir, `${locale}-${batch.start}.json`);
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  }
  const result = await rewriteBatch(locale, batch.items);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(result));
  return result;
}


function writePack(locale, original, replacements) {
  let text = original;
  const re = /^(\s*)("(?:[^"\\]|\\.)*")(\s*:\s*)("(?:[^"\\]|\\.)*")(\s*,?\s*)$/gm;
  text = text.replace(re, (line, indent, rawKey, colon, rawValue, suffix) => {
    const key = JSON.parse(rawKey);
    return replacements.has(key) ? `${indent}${rawKey}${colon}${JSON.stringify(replacements.get(key))}${suffix}` : line;
  });
  fs.writeFileSync(path.join(root, `src/i18n/content/journeys/${locale}.ts`), text);
}

if (!process.env.LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is required");
const english = englishMap();
console.log(`Extracted ${Object.keys(english).length} English journey fields.`);
async function processLocale(locale) {
  const file = path.join(root, `src/i18n/content/journeys/${locale}.ts`);
  const pack = parsePack(file);
  const items = [...pack.entries].map(([key, current]) => ({ key, english: english[key], current }));
  const missing = items.filter((item) => typeof item.english !== "string");
  if (missing.length) throw new Error(`${locale}: ${missing.length} keys have no English source, first ${missing[0].key}`);
  const replacements = new Map();
  const batchSize = 40;
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) batches.push({ start: i, items: items.slice(i, i + batchSize) });
  for (let i = 0; i < batches.length; i += 5) {
    const group = batches.slice(i, i + 5);
    const results = await Promise.all(group.map((batch) => cachedBatch(locale, batch)));
    for (const result of results) for (const item of result) replacements.set(item.key, item.text);
    console.log(`${locale}: ${Math.min((i + group.length) * batchSize, items.length)}/${items.length}`);
  }
  if (replacements.size !== pack.entries.size) throw new Error(`${locale}: incomplete rewrite`);
  writePack(locale, pack.text, replacements);
  console.log(`${locale}: written`);
}
const settled = await Promise.allSettled(locales.map(processLocale));
settled.forEach((r, i) => { if (r.status === "rejected") console.log(`FAILED ${locales[i]}: ${r.reason?.message}`); });

