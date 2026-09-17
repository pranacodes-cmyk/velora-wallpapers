import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const locales = ["es", "pt", "fil", "hi", "id", "fr", "de"];
const keep = new Set(["Prayly", "Premium", "PRO", "Pro", "Live"]);
const issues = [];

function parseDict(file) {
  if (!fs.existsSync(file)) return new Map();
  const text = fs.readFileSync(file, "utf8");
  const entries = new Map();
  const re = /("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")/g;
  for (const m of text.matchAll(re)) entries.set(JSON.parse(m[1]), JSON.parse(m[2]));
  return entries;
}
const ph = (v) => [...v.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(",");

const screens = fs.readdirSync(path.join(root, "src/i18n/screens"));
const targets = [
  ...screens.map((s) => ({ label: `screens/${s}`, dir: `src/i18n/screens/${s}` })),
  { label: "base", dir: "src/i18n/locales" },
];

for (const { label, dir } of targets) {
  const en = parseDict(path.join(root, dir, "en.ts"));
  for (const locale of locales) {
    const d = parseDict(path.join(root, dir, `${locale}.ts`));
    for (const key of en.keys()) if (!d.has(key)) issues.push({ locale, label, key, type: "missing_key" });
    for (const [key, value] of d) {
      const src = en.get(key);
      if (src === undefined) { issues.push({ locale, label, key, type: "extra_key" }); continue; }
      if (!value.trim()) issues.push({ locale, label, key, type: "empty_value" });
      if (ph(src) !== ph(value)) issues.push({ locale, label, key, type: "placeholder_mismatch", value });
      if (/velora/i.test(value)) issues.push({ locale, label, key, type: "forbidden_brand", value });
      if (/watch ad/i.test(value)) issues.push({ locale, label, key, type: "forbidden_ad_copy", value });
      const stripped = value.replace(/[\p{L}]+/gu, (w) => (keep.has(w) ? "" : w));
      if (locale !== "de" && src.length > 3 && stripped === src && /\p{L}{4,}/u.test(src) && !/^[\d\s\p{P}]*$/u.test(src)) {
        issues.push({ locale, label, key, type: "untranslated", value });
      }
      // CTA/badge overflow: value much longer than English for short labels
      if (src.length <= 22 && value.length > src.length * 2 + 8) {
        issues.push({ locale, label, key, type: "cta_too_long", en: src, value });
      }
    }
  }
}

const summary = issues.reduce((o, i) => { const k = `${i.locale}:${i.type}`; o[k] = (o[k] ?? 0) + 1; return o; }, {});
fs.mkdirSync(path.join(root, "artifacts/localization"), { recursive: true });
fs.writeFileSync(path.join(root, "artifacts/localization/ui-audit-report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), summary, issues }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
console.log("total issues:", issues.length);
