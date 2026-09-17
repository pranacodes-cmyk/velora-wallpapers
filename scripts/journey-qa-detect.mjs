// Detect localization QA issues in journey packs (read-only, no AI).
import fs from "node:fs";
import path from "node:path";

const LANGS = ["es", "pt", "fr", "de", "hi", "id", "fil"];
const DIR = "src/i18n/content/journeys";

export function loadPack(lang) {
  const src = fs.readFileSync(path.join(DIR, `${lang}.ts`), "utf8");
  const out = {};
  const re = /^\s*"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm;
  let m;
  while ((m = re.exec(src))) {
    out[JSON.parse(`"${m[1]}"`)] = JSON.parse(`"${m[2]}"`);
  }
  return out;
}

export function writePack(lang, pack, header) {
  const keys = Object.keys(pack).sort();
  const body = keys
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(pack[k])},`)
    .join("\n");
  const text = `${header}\nconst ${lang}: Record<string, string> = {\n${body}\n};\n\nexport default ${lang};\n`;
  fs.writeFileSync(path.join(DIR, `${lang}.ts`), text);
}

// ---------- detectors ----------

const ENGLISH_BOOKS = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
  "Samuel","Kings","Chronicles","Ezra","Nehemiah","Esther","Job","Psalm","Psalms",
  "Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations",
  "Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum",
  "Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke",
  "John","Acts","Romans","Corinthians","Galatians","Ephesians","Philippians",
  "Colossians","Thessalonians","Timothy","Titus","Philemon","Hebrews","James",
  "Peter","Jude","Revelation",
];

// Words that are legitimately identical across languages, so an English book
// token is only suspicious when the language has its own accepted form.
const LOCAL_BOOK_OK = {
  fil: new Set(["Genesis","Exodo","Levitico","Deuteronomio","Josue","Rut","Job","Daniel","Jonas","Amos","Joel","Micas","Nahum","Habakuk","Zefanias","Hagai","Zacarias","Malakias","Marcos","Lucas","Juan","Gawa","Roma","Galacia","Efeso","Filipos","Colosas","Tesalonica","Timoteo","Tito","Filemon","Hebreo","Santiago","Pedro","Judas","Pahayag","Awit","Mga","Kawikaan","Isaias","Jeremias","Panaghoy","Ezekiel","Oseas","Obadias","Mateo","Corinto","Samuel","Hari","Cronica","Ezra","Nehemias","Ester","Eclesiastes","Ruth"]),
  // German shares many spellings with English (Psalm, Daniel, Titus, Amos, ...)
  de: new Set(["Psalm","Psalmen","Genesis","Exodus","Leviticus","Numbers","Josua","Ruth","Job","Daniel","Joel","Amos","Jona","Micha","Nahum","Habakuk","Haggai","Titus","Philemon","Samuel","Timotheus","Jakobus","Judas","Ester","Esra"]),
  // French shares spellings too (Lamentations, Job, Daniel, Amos, ...)
  fr: new Set(["Lamentations","Job","Daniel","Joel","Amos","Nahum","Habakuk","Ruth","Esther","Samuel","Titus","Philemon","Jude","Michee","Jonas"]),
};

export function detectEnglishRefs(lang, pack) {
  const hits = [];
  for (const [k, v] of Object.entries(pack)) {
    if (!k.endsWith(".reference")) continue;
    const first = v.replace(/^\d+\s*\.?\s*/, "").split(/\s|\d/)[0];
    if (!first) continue;
    if (ENGLISH_BOOKS.includes(first)) {
      const ok = LOCAL_BOOK_OK[lang];
      if (ok && ok.has(first)) continue;
      hits.push({ key: k, value: v, book: first });
    }
  }
  return hits;
}

export function detectDeOrdinals(pack) {
  const hits = [];
  for (const [k, v] of Object.entries(pack)) {
    if (!k.endsWith(".reference")) continue;
    if (/^[123]\s+[A-ZÄÖÜ]/.test(v)) hits.push({ key: k, value: v });
  }
  return hits;
}

export function detectColonRefs(lang, pack) {
  // German convention uses a comma between chapter and verse.
  if (lang !== "de") return [];
  const hits = [];
  for (const [k, v] of Object.entries(pack)) {
    if (k.endsWith(".reference") && v.includes(":")) hits.push({ key: k, value: v });
  }
  return hits;
}

const QUOTE_RE = /['‘’„“”«»"]([^'‘’„“”«»"]{2,40})['‘’„“”«»"]/gu;
const NEGATION = /(no dice|não diz|ne dit pas|sagt nicht|nahin kahta|tidak berkata|hindi sinasabi|not\s+['‘])/i;

function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemish(w) {
  // crude: compare on the first 70% of the word so inflection differences pass
  return w.slice(0, Math.max(4, Math.ceil(w.length * 0.7)));
}

export function detectQuoteMismatch(lang, pack) {
  const hits = [];
  for (const [k, v] of Object.entries(pack)) {
    if (!k.endsWith(".explanation")) continue;
    const verseKey = k.replace(/\.explanation$/, ".verse");
    const verse = pack[verseKey];
    if (!verse) continue;
    if (NEGATION.test(v)) continue;
    const nv = normalize(verse);
    const bad = [];
    let m;
    QUOTE_RE.lastIndex = 0;
    while ((m = QUOTE_RE.exec(v))) {
      const q = normalize(m[1]);
      if (!q || q.length < 3) continue;
      const words = q.split(" ").filter((w) => w.length > 3);
      if (!words.length) continue;
      const found = words.some((w) => nv.includes(stemish(w)));
      if (!found) bad.push(m[1]);
    }
    if (bad.length) hits.push({ key: k, verseKey, quoted: bad, verse, explanation: v });
  }
  return hits;
}

// Formal-register markers that address the READER (not scripture quotes, and
// not third-person "sie/they"). Tuned to avoid false positives.
const FORMAL = {
  de: /(\b(?:Lassen|Nehmen|Denken|Atmen|Sprechen|Lesen|Bitten|Halten|Stellen|Fragen|Erlauben|Wiederholen|Beten|Bringen|Legen|Schauen|Achten|Beginnen|Setzen|Sagen|Machen|Geben|Öffnen|Schreiben|Suchen|Spüren|Merken|Vergeben|Danken|Ruhen|Warten|Hören|Sehen|Bleiben)\s+Sie\b|\bIhnen\b|\bIhre[nrms]?\b|\bSie\s+sich\b)/,
  fr: /\b(vous|vos|votre|Remarquez|Prenez|Respirez|Répétez|Soyez|Laissez|Demandez|Écrivez|Nommez|Choisissez|Dites|Priez|Restez)\b/,
  id: /\bAnda\b/,
  es: /\b(usted|ustedes)\b/i,
  pt: /\b(o senhor|a senhora|vós)\b/i,
  fil: /\b(ninyo|kayo)\b/i,
  hi: /(आप|आपको|आपने|आपका|आपकी|आपके)/,
};
const INFORMAL = {
  de: /\b(du|dich|dir|dein[e]?[nrms]?)\b/i,
  fr: /\b(tu|toi|ton|ta|tes)\b/i,
  id: /\b(kamu|kau)\b|-mu\b/i,
  es: /\b(tú|te|ti|tu)\b/i,
  pt: /\b(você|te|teu|tua)\b/i,
  fil: /\b(ka|mo|iyo)\b/i,
  hi: /(तुम|तुम्हें|तुम्हारा|तुम्हारी|तुम्हारे|तू\s|तेरा|तेरी|तुझे)/,
};

// App-wide register is INFORMAL/intimate in every language (Hindi uses the
// respectful "आप" as its intimate-but-warm norm, so its polarity is flipped).
export function detectRegisterMix(lang, pack) {
  const hits = [];
  const formal = FORMAL[lang];
  const informal = INFORMAL[lang];
  if (!formal || !informal) return hits;
  const hindiStyle = lang === "hi";
  for (const [k, v] of Object.entries(pack)) {
    if (k.endsWith(".reference")) continue;
    if (k.endsWith(".verse")) continue; // scripture keeps its own translation register
    const f = formal.test(v);
    const i = informal.test(v);
    if (hindiStyle) {
      // Hindi: narrative must stay on आप; तुम/तू outside a verse is the defect.
      if (i) hits.push({ key: k, value: v, mixed: f && i });
    } else if (f) {
      hits.push({ key: k, value: v, mixed: f && i });
    }
  }
  return hits;
}

const ANGLICISMS = {
  id: ["highlight", "feed-mu", "berperforma", "insecure", "mindset", "sharing"],
  fil: ["kadiri ka", "trabahuhin"],
  es: ["solo/a", "cansado/a", "amado/a"],
  pt: ["sozinha(o)", "cansada(o)"],
  fr: ["seul(e)", "fatigué(e)"],
};

export function detectAnglicisms(lang, pack) {
  const list = ANGLICISMS[lang] || [];
  const hits = [];
  for (const [k, v] of Object.entries(pack)) {
    for (const bad of list) {
      if (v.toLowerCase().includes(bad.toLowerCase())) hits.push({ key: k, value: v, bad });
    }
  }
  return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = {};
  for (const lang of LANGS) {
    const pack = loadPack(lang);
    report[lang] = {
      keys: Object.keys(pack).length,
      englishRefs: detectEnglishRefs(lang, pack),
      deOrdinals: lang === "de" ? detectDeOrdinals(pack) : [],
      colonRefs: detectColonRefs(lang, pack),
      quoteMismatch: detectQuoteMismatch(lang, pack),
      registerMix: detectRegisterMix(lang, pack),
      anglicisms: detectAnglicisms(lang, pack),
    };
  }
  fs.mkdirSync("artifacts/localization", { recursive: true });
  fs.writeFileSync("artifacts/localization/journey-qa.json", JSON.stringify(report, null, 2));
  for (const lang of LANGS) {
    const r = report[lang];
    console.log(
      `${lang.padEnd(4)} keys=${r.keys} engRefs=${r.englishRefs.length} deOrd=${r.deOrdinals.length} colon=${r.colonRefs.length} quoteMismatch=${r.quoteMismatch.length} registerMix=${r.registerMix.length} anglicism=${r.anglicisms.length}`,
    );
  }
}
