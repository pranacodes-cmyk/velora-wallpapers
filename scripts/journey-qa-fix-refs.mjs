// Deterministic reference fixes: localized book names + per-language citation style.
import { loadPack, writePack } from "./journey-qa-detect.mjs";

const HEADER = (lang) => `// ${lang} — localized journey content (days, rich slides, guides).`;

// Filipino: normalize to the majority form already used in the pack.
const FIL_BOOKS = {
  Psalm: "Awit",
  Psalms: "Awit",
  Salmo: "Awit",
  "Mga Awit": "Awit",
  Matthew: "Mateo",
  Mark: "Marcos",
  Markos: "Marcos",
  Luke: "Lucas",
  John: "Juan",
  Acts: "Gawa",
  Romans: "Roma",
  Corinthians: "Corinto",
  Galatians: "Galacia",
  Ephesians: "Efeso",
  Philippians: "Filipos",
  Colossians: "Colosas",
  Thessalonians: "Tesalonica",
  Timothy: "Timoteo",
  Hebrews: "Hebreo",
  James: "Santiago",
  Peter: "Pedro",
  Revelation: "Pahayag",
  Apocalipsis: "Pahayag",
  Isaiah: "Isaias",
  Jeremiah: "Jeremias",
  Lamentations: "Panaghoy",
  Proverbs: "Kawikaan",
  Ecclesiastes: "Eclesiastes",
  Joshua: "Josue",
  Judges: "Hukom",
  Ruth: "Rut",
  Nehemiah: "Nehemias",
  Esther: "Ester",
  Deuteronomy: "Deuteronomio",
  Exodus: "Exodo",
  Leviticus: "Levitico",
  Numbers: "Mga Bilang",
  Daniel: "Daniel",
  Jonah: "Jonas",
  Micah: "Micas",
  Zechariah: "Zacarias",
  Malachi: "Malakias",
  Hosea: "Oseas",
  Genesis: "Genesis",
  Job: "Job",
};

function fixFil(value) {
  let v = value;
  // longest-first so "Mga Awit" wins over "Awit"
  for (const from of Object.keys(FIL_BOOKS).sort((a, b) => b.length - a.length)) {
    const to = FIL_BOOKS[from];
    if (from === to) continue;
    v = v.replace(new RegExp(`(^|\\d\\s|\\s)${from}\\b`), (m, p1) => `${p1}${to}`);
  }
  return v;
}

function fixDe(value) {
  let v = value;
  // Ordinal books take a period: "1 Petrus" -> "1. Petrus"
  v = v.replace(/^([123])\s+(?=[A-ZÄÖÜ])/, "$1. ");
  // Chapter:verse uses a comma in German citation style.
  v = v.replace(/(\d)\s*:\s*(\d)/, "$1,$2");
  return v;
}

const FIXERS = { fil: fixFil, de: fixDe };

let total = 0;
for (const [lang, fixer] of Object.entries(FIXERS)) {
  const pack = loadPack(lang);
  let changed = 0;
  for (const [k, v] of Object.entries(pack)) {
    if (!k.endsWith(".reference")) continue;
    const next = fixer(v);
    if (next !== v) {
      pack[k] = next;
      changed += 1;
      console.log(`${lang} ${k}: "${v}" -> "${next}"`);
    }
  }
  if (changed) writePack(lang, pack, HEADER(lang));
  total += changed;
  console.log(`${lang}: ${changed} references fixed`);
}
console.log(`total: ${total}`);
