import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const locales = ["es", "pt", "fil", "hi", "id", "fr", "de"];
const domains = ["quiz", "journeys", "prayers", "reflections", "verses"];
const glossary = JSON.parse(fs.readFileSync(path.join(root, "scripts/localization-glossaries.json"), "utf8"));
const issues = [];

function parseDict(file) {
  const text = fs.readFileSync(file, "utf8");
  const entries = new Map();
  const re = /^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/gm;
  for (const match of text.matchAll(re)) entries.set(JSON.parse(match[1]), JSON.parse(match[2]));
  return { text, entries };
}

function placeholders(value) {
  return [...value.matchAll(/\{\{\s*([\w]+)\s*\}\}/g)].map((m) => m[1]).sort().join(",");
}

for (const domain of domains) {
  const packs = Object.fromEntries(locales.map((locale) => {
    const file = path.join(root, `src/i18n/content/${domain}/${locale}.ts`);
    return [locale, parseDict(file)];
  }));
  const baseline = new Set(packs.es.entries.keys());
  for (const locale of locales) {
    const keys = new Set(packs[locale].entries.keys());
    for (const key of baseline) if (!keys.has(key)) issues.push({ locale, domain, key, type: "missing_key" });
    for (const key of keys) if (!baseline.has(key)) issues.push({ locale, domain, key, type: "extra_key" });
    for (const [key, value] of packs[locale].entries) {
      if (!value.trim()) issues.push({ locale, domain, key, type: "empty_value" });
      const expected = placeholders(packs.es.entries.get(key) ?? "");
      if (expected !== placeholders(value)) issues.push({ locale, domain, key, type: "placeholder_mismatch" });
      const englishTokens = value.match(/\b(the|and|with|your|you|god|today|inhale|exhale)\b/gi) ?? [];
      if (locale !== "de" && englishTokens.length >= 2) {
        issues.push({ locale, domain, key, type: "likely_english" });
      }
    }
  }
}

const hiFiles = domains.map((domain) => path.join(root, `src/i18n/content/${domain}/hi.ts`));
for (const file of hiFiles) {
  const { entries } = parseDict(file);
  for (const [key, value] of entries) {
    for (const forbidden of glossary.hi.forbidden) {
      if (value.includes(forbidden)) issues.push({ locale: "hi", domain: path.basename(path.dirname(file)), key, type: "forbidden_term", value: forbidden });
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: issues.reduce((out, issue) => {
    const label = `${issue.locale}:${issue.domain}:${issue.type}`;
    out[label] = (out[label] ?? 0) + 1;
    return out;
  }, {}),
  issues,
};
const reportDir = path.join(root, "artifacts/localization");
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, "audit-report.json"), `${JSON.stringify(report, null, 2)}\n`);

if (issues.length) {
  console.error(`Localization audit failed with ${issues.length} issue(s). See artifacts/localization/audit-report.json`);
  console.error(JSON.stringify(report.summary, null, 2));
  process.exit(1);
}
console.log("Localization audit passed: all content packs have matching keys, placeholders, and terminology checks.");