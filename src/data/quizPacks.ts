/**
 * Pro-only Quiz Packs & Book Mastery selectors.
 * Pulls from the existing question bank (quizQuestions + quizQuestionsExtra).
 */
import { quizQuestions, type QuizQuestion } from "./quizQuestions";

/** Read the same recent-ids list quizQuestions.ts uses so book/pack picks
 *  also avoid recently-seen questions. */
function getRecentIdsSafe(): Set<string> {
  try {
    const raw = localStorage.getItem("cw_quiz_recent_ids");
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch { return new Set<string>(); }
}

/** Prefer unseen; fall back to the full pool if not enough fresh ones remain. */
function pickFresh<T extends { id: string }>(pool: T[], count: number): T[] {
  const recent = getRecentIdsSafe();
  const fresh = pool.filter((q) => !recent.has(q.id));
  const source = fresh.length >= count ? fresh : pool;
  return shuffle(source).slice(0, Math.min(count, source.length));
}


/** Extract the book name from a reference like "1 Samuel 17:50" or "John 3:16". */
function bookOf(reference: string): string {
  // Strip trailing chapter/verse numbers and ranges.
  const m = reference.match(/^([1-3]?\s?[A-Za-z]+(?:\s[A-Za-z]+)?)\s+\d/);
  if (m) return m[1].trim();
  return reference.trim();
}

/** All books actually represented in the question bank, with counts. */
export interface BookEntry {
  book: string;
  count: number;
  testament: "Old" | "New" | "Other";
}

const OT_BOOKS = new Set([
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
  "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra",
  "Nehemiah","Esther","Job","Psalms","Psalm","Proverbs","Ecclesiastes","Song of Solomon",
  "Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah",
  "Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi",
]);
const NT_BOOKS = new Set([
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians",
  "Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians",
  "1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter",
  "1 John","2 John","3 John","Jude","Revelation",
]);

export function listBooksWithCounts(minCount = 4): BookEntry[] {
  const counts = new Map<string, number>();
  for (const q of quizQuestions) {
    const b = bookOf(q.reference);
    const key = b === "Psalm" ? "Psalms" : b;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const entries: BookEntry[] = [];
  for (const [book, count] of counts) {
    if (count < minCount) continue;
    const testament: BookEntry["testament"] =
      OT_BOOKS.has(book) ? "Old" : NT_BOOKS.has(book) ? "New" : "Other";
    if (testament === "Other") continue;
    entries.push({ book, count, testament });
  }
  // Canonical order: OT first, NT second, alphabetical within.
  entries.sort((a, b) => {
    if (a.testament !== b.testament) return a.testament === "Old" ? -1 : 1;
    return a.book.localeCompare(b.book);
  });
  return entries;
}

export function getQuestionsByBook(book: string, count = 15): QuizQuestion[] {
  const want = book === "Psalms" ? new Set(["Psalms", "Psalm"]) : new Set([book]);
  const pool = quizQuestions.filter((q) => want.has(bookOf(q.reference)));
  return pickFresh(pool, count);
}


// ---------- Themed Packs ----------

export interface QuizPack {
  id: string;
  title: string;
  emoji: string;
  description: string;
  /** Keywords matched against question text + explanation (case-insensitive). */
  keywords: string[];
  /** Optional book filter. */
  books?: string[];
  /** Optional explicit question IDs to force-include. */
  forceIds?: string[];
}

export const QUIZ_PACKS: QuizPack[] = [
  {
    id: "parables",
    title: "Parables of Jesus",
    emoji: "🌾",
    description: "Prodigal Son, Good Samaritan, the Sower & more.",
    keywords: ["parable","prodigal","sower","samaritan","mustard seed","lost sheep","talents","vineyard","ten virgins","pharisee and the tax"],
  },
  {
    id: "miracles",
    title: "Miracles of Jesus",
    emoji: "✨",
    description: "Water to wine, walking on water, feeding the 5,000.",
    keywords: ["miracle","walked on water","water into wine","fed 5,000","fed 5000","raised","healed","leper","blind","lazarus","calmed the storm","loaves"],
  },
  {
    id: "prophets",
    title: "The Prophets",
    emoji: "🔥",
    description: "Elijah, Isaiah, Jeremiah, Daniel — voices of God.",
    keywords: ["prophet","elijah","elisha","isaiah","jeremiah","ezekiel","daniel","jonah","hosea","amos"],
    books: ["Isaiah","Jeremiah","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","1 Kings","2 Kings"],
  },
  {
    id: "kings",
    title: "Kings & Kingdoms",
    emoji: "👑",
    description: "David, Solomon, Saul — the throne of Israel.",
    keywords: ["king","kingdom","throne","david","solomon","saul","hezekiah","josiah","goliath"],
    books: ["1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles"],
  },
  {
    id: "women",
    title: "Women of the Bible",
    emoji: "🌷",
    description: "Mary, Ruth, Esther, Hannah, Deborah.",
    keywords: ["mary","ruth","esther","hannah","deborah","sarah","rebekah","rachel","leah","miriam","elizabeth","martha","priscilla","lydia","eve","first woman"],
  },
  {
    id: "endtimes",
    title: "End Times & Revelation",
    emoji: "⚡",
    description: "Prophecies, the return of Christ, new heaven.",
    keywords: ["revelation","end times","second coming","return","new jerusalem","heaven","hell","judgment","beast","antichrist","tribulation","alpha","omega"],
    books: ["Revelation","Daniel","2 Thessalonians"],
  },
  {
    id: "holyspirit",
    title: "The Holy Spirit",
    emoji: "🕊️",
    description: "Pentecost, gifts, fruits, the Helper.",
    keywords: ["holy spirit","pentecost","tongues","fruit of the spirit","gifts","comforter","helper","baptism","dove"],
  },
  {
    id: "psalms",
    title: "Psalms of David",
    emoji: "🎵",
    description: "Worship, lament, the shepherd's heart.",
    keywords: ["psalm","shepherd","praise","worship"],
    books: ["Psalms","Psalm"],
  },
  {
    id: "creation",
    title: "Creation & Beginnings",
    emoji: "🌍",
    description: "Eden, the Fall, Noah, the Tower of Babel.",
    keywords: ["creation","created","beginning","adam","eve","eden","noah","ark","flood","babel","cain","abel"],
    books: ["Genesis"],
  },
  {
    id: "moses",
    title: "Moses & the Exodus",
    emoji: "🌊",
    description: "Plagues, Red Sea, Ten Commandments, wilderness.",
    keywords: ["moses","pharaoh","plague","exodus","red sea","commandment","wilderness","manna","sinai","aaron","tabernacle","passover"],
    books: ["Exodus","Leviticus","Numbers","Deuteronomy"],
  },
  {
    id: "easter",
    title: "The Passion & Resurrection",
    emoji: "✝️",
    description: "Last Supper, the cross, the empty tomb.",
    keywords: ["crucified","crucifixion","cross","resurrection","rose","tomb","last supper","passover","golgotha","calvary","pilate","gethsemane","third day"],
  },
  {
    id: "love",
    title: "Love, Faith & Hope",
    emoji: "❤️",
    description: "1 Corinthians 13 and the heart of Scripture.",
    keywords: ["love","faith","hope","grace","mercy","forgive","forgiveness","peace","joy","kindness"],
  },
];

export function getPackById(id: string): QuizPack | undefined {
  return QUIZ_PACKS.find((p) => p.id === id);
}

export function getQuestionsByPack(packId: string, count = 10): QuizQuestion[] {
  const pack = getPackById(packId);
  if (!pack) return [];
  const kws = pack.keywords.map((k) => k.toLowerCase());
  const books = new Set(pack.books || []);
  const forced = new Set(pack.forceIds || []);
  const matched = quizQuestions.filter((q) => {
    if (forced.has(q.id)) return true;
    const hay = `${q.question} ${q.explanation}`.toLowerCase();
    if (kws.some((k) => hay.includes(k))) return true;
    if (books.size && books.has(bookOf(q.reference))) return true;
    return false;
  });
  // De-dupe then prefer unseen so replays surface fresh questions
  const seen = new Set<string>();
  const unique = matched.filter((q) => (seen.has(q.id) ? false : (seen.add(q.id), true)));
  return pickFresh(unique, count);

}

/** Count how many questions each pack can actually produce — used in the UI. */
export function getPackSize(packId: string): number {
  const pack = getPackById(packId);
  if (!pack) return 0;
  const kws = pack.keywords.map((k) => k.toLowerCase());
  const books = new Set(pack.books || []);
  let n = 0;
  for (const q of quizQuestions) {
    const hay = `${q.question} ${q.explanation}`.toLowerCase();
    if (kws.some((k) => hay.includes(k)) || (books.size && books.has(bookOf(q.reference)))) n++;
  }
  return n;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
