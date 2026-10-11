// Writes the 40 Sacred Pause prayers (artifacts/prayscreen/pauses-<lang>.json)
// into the bundled i18n packs and emits the backend migration SQL.
import { readFileSync, writeFileSync } from "node:fs";

const LANGS = ["en", "es", "pt", "fil", "hi", "id", "fr", "de"];
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const sq = (s) => s.replace(/'/g, "''");
const rows = [];

for (const lang of LANGS) {
  const data = JSON.parse(readFileSync(`artifacts/prayscreen/pauses-${lang}.json`, "utf8"));
  if (data.length !== 40) throw new Error(`${lang}: expected 40, got ${data.length}`);
  const lines = data
    .map((p, i) => {
      const n = i + 1;
      for (const k of ["verse", "reference", "prayer"]) {
        if (!p[k] || !String(p[k]).trim()) throw new Error(`${lang} slot ${n}: empty ${k}`);
      }
      return [
        `  "ps.pause${n}.verse": "${esc(p.verse.trim())}",`,
        `  "ps.pause${n}.ref": "${esc(p.reference.trim())}",`,
        `  "ps.pause${n}.prayer": "${esc(p.prayer.trim())}",`,
      ].join("\n");
    })
    .join("\n");

  const file = `src/i18n/screens/prayscreen/${lang}.ts`;
  const src = readFileSync(file, "utf8");
  const start = src.indexOf('  "ps.pause1.verse"');
  const endMarker = src.lastIndexOf('.prayer": "');
  const endLine = src.indexOf("\n", endMarker);
  if (start < 0 || endLine < 0) throw new Error(`${file}: pause block not found`);
  writeFileSync(file, src.slice(0, start) + lines + src.slice(endLine + 1));

  data.forEach((p, i) =>
    rows.push(
      `('${lang}', ${i + 1}, '${sq(p.verse.trim())}', '${sq(p.reference.trim())}', '${sq(p.prayer.trim())}', true)`,
    ),
  );
}

const sql = `DELETE FROM public.pray_pauses;
INSERT INTO public.pray_pauses (lang, slot, verse, reference, prayer, active) VALUES
${rows.join(",\n")};
`;
writeFileSync("/tmp/pray_pauses.sql", sql);
console.log(`ok: ${rows.length} rows, ${LANGS.length} packs updated`);
