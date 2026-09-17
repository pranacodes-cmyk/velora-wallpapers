// Mood-based verse packs.
// Each mood = 30 curated verses. When a user activates a pack, the daily
// verse rotates through those 30 verses by day-of-month and loops every
// 30 days. Selection persists in localStorage and emits an event so all
// listeners (today screen, wallpaper canvas, ticker, splash) re-render.

import type { DailyVerse } from "@/data/dailyVerses";
import type { VerseMood } from "@/data/verseBackgrounds";

export const ACTIVE_MOOD_PACK_STORAGE_KEY = "jwbp_active_mood_pack_v1";
export const ACTIVE_MOOD_PACK_EVENT = "cw:verse-mood-pack-change";

// 30 verses per mood — KJV/NIV blend, sized for the wallpaper canvas.
const PACKS: Record<VerseMood, DailyVerse[]> = {
  peace: [
    { text: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you.", reference: "John 14:27" },
    { text: "Be still, and know that I am God.", reference: "Psalm 46:10" },
    { text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", reference: "Matthew 11:28" },
    { text: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1" },
    { text: "He maketh me to lie down in green pastures.", reference: "Psalm 23:2" },
    { text: "Thou wilt keep him in perfect peace, whose mind is stayed on thee.", reference: "Isaiah 26:3" },
    { text: "Let not your heart be troubled, neither let it be afraid.", reference: "John 14:27" },
    { text: "He leadeth me beside the still waters.", reference: "Psalm 23:2" },
    { text: "The peace of God, which passeth all understanding, shall keep your hearts.", reference: "Philippians 4:7" },
    { text: "In quietness and confidence shall be your strength.", reference: "Isaiah 30:15" },
    { text: "Cast all your anxiety on him because he cares for you.", reference: "1 Peter 5:7" },
    { text: "When I am afraid, I put my trust in you.", reference: "Psalm 56:3" },
    { text: "Yea, though I walk through the valley of the shadow of death, I will fear no evil.", reference: "Psalm 23:4" },
    { text: "He is our peace, who hath made both one.", reference: "Ephesians 2:14" },
    { text: "And the work of righteousness shall be peace.", reference: "Isaiah 32:17" },
    { text: "I will both lay me down in peace, and sleep.", reference: "Psalm 4:8" },
    { text: "Blessed are the peacemakers: for they shall be called the children of God.", reference: "Matthew 5:9" },
    { text: "Great peace have they which love thy law.", reference: "Psalm 119:165" },
    { text: "Let the peace of Christ rule in your hearts.", reference: "Colossians 3:15" },
    { text: "He calmed the storm to a whisper.", reference: "Psalm 107:29" },
    { text: "The Lord will give strength unto his people; the Lord will bless his people with peace.", reference: "Psalm 29:11" },
    { text: "Thou shalt hide them in the secret of thy presence.", reference: "Psalm 31:20" },
    { text: "Mercy unto you, and peace, and love, be multiplied.", reference: "Jude 1:2" },
    { text: "And he arose, and rebuked the wind, and said unto the sea, Peace, be still.", reference: "Mark 4:39" },
    { text: "The Lord lift up his countenance upon thee, and give thee peace.", reference: "Numbers 6:26" },
    { text: "He shall cover thee with his feathers, and under his wings shalt thou trust.", reference: "Psalm 91:4" },
    { text: "My presence shall go with thee, and I will give thee rest.", reference: "Exodus 33:14" },
    { text: "Acquaint now thyself with him, and be at peace.", reference: "Job 22:21" },
    { text: "I have learned, in whatsoever state I am, therewith to be content.", reference: "Philippians 4:11" },
    { text: "And let us run with patience the race that is set before us.", reference: "Hebrews 12:1" },
  ],
  hope: [
    { text: "For I know the plans I have for you, saith the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", reference: "Jeremiah 29:11" },
    { text: "They that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles.", reference: "Isaiah 40:31" },
    { text: "And we know that all things work together for good to them that love God.", reference: "Romans 8:28" },
    { text: "Now faith is the substance of things hoped for, the evidence of things not seen.", reference: "Hebrews 11:1" },
    { text: "Weeping may endure for a night, but joy cometh in the morning.", reference: "Psalm 30:5" },
    { text: "Why art thou cast down, O my soul? hope thou in God.", reference: "Psalm 42:11" },
    { text: "The Lord is my light and my salvation; whom shall I fear?", reference: "Psalm 27:1" },
    { text: "Hope deferred maketh the heart sick: but when the desire cometh, it is a tree of life.", reference: "Proverbs 13:12" },
    { text: "Behold, I make all things new.", reference: "Revelation 21:5" },
    { text: "His mercies are new every morning: great is thy faithfulness.", reference: "Lamentations 3:23" },
    { text: "Now the God of hope fill you with all joy and peace in believing.", reference: "Romans 15:13" },
    { text: "Eye hath not seen what God hath prepared for them that love him.", reference: "1 Corinthians 2:9" },
    { text: "Sorrow may last for a night, but joy comes in the morning.", reference: "Psalm 30:5" },
    { text: "Let us hold fast the profession of our faith without wavering; for he is faithful.", reference: "Hebrews 10:23" },
    { text: "The light shineth in darkness; and the darkness comprehended it not.", reference: "John 1:5" },
    { text: "I have set the Lord always before me: he is at my right hand, I shall not be moved.", reference: "Psalm 16:8" },
    { text: "Cast not away therefore your confidence, which hath great recompense of reward.", reference: "Hebrews 10:35" },
    { text: "The Lord is good unto them that wait for him.", reference: "Lamentations 3:25" },
    { text: "Wait on the Lord: be of good courage, and he shall strengthen thine heart.", reference: "Psalm 27:14" },
    { text: "Through him we have access by faith into this grace wherein we stand, and rejoice in hope.", reference: "Romans 5:2" },
    { text: "For we are saved by hope.", reference: "Romans 8:24" },
    { text: "Faithful is he that calleth you, who also will do it.", reference: "1 Thessalonians 5:24" },
    { text: "Thou art my hope, O Lord God: thou art my trust from my youth.", reference: "Psalm 71:5" },
    { text: "I waited patiently for the Lord; and he inclined unto me, and heard my cry.", reference: "Psalm 40:1" },
    { text: "Blessed is the man that trusteth in the Lord, and whose hope the Lord is.", reference: "Jeremiah 17:7" },
    { text: "The hope of the righteous shall be gladness.", reference: "Proverbs 10:28" },
    { text: "Begotten us again unto a lively hope by the resurrection of Jesus Christ.", reference: "1 Peter 1:3" },
    { text: "Behold, the eye of the Lord is upon them that hope in his mercy.", reference: "Psalm 33:18" },
    { text: "I will hope continually, and will yet praise thee more and more.", reference: "Psalm 71:14" },
    { text: "He giveth power to the faint; and to them that have no might he increaseth strength.", reference: "Isaiah 40:29" },
  ],
  strength: [
    { text: "I can do all things through Christ which strengtheneth me.", reference: "Philippians 4:13" },
    { text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee.", reference: "Isaiah 41:10" },
    { text: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.", reference: "Joshua 1:9" },
    { text: "He giveth power to the faint; and to them that have no might he increaseth strength.", reference: "Isaiah 40:29" },
    { text: "Greater is he that is in you, than he that is in the world.", reference: "1 John 4:4" },
    { text: "The joy of the Lord is your strength.", reference: "Nehemiah 8:10" },
    { text: "God is our refuge and strength, a very present help in trouble.", reference: "Psalm 46:1" },
    { text: "My grace is sufficient for thee: for my strength is made perfect in weakness.", reference: "2 Corinthians 12:9" },
    { text: "The Lord is my strength and my shield; my heart trusted in him, and I am helped.", reference: "Psalm 28:7" },
    { text: "If God be for us, who can be against us?", reference: "Romans 8:31" },
    { text: "No weapon that is formed against thee shall prosper.", reference: "Isaiah 54:17" },
    { text: "The Lord shall fight for you, and ye shall hold your peace.", reference: "Exodus 14:14" },
    { text: "Wait on the Lord, and he shall strengthen thine heart.", reference: "Psalm 27:14" },
    { text: "Thou hast girded me with strength unto the battle.", reference: "Psalm 18:39" },
    { text: "Be strong in the Lord, and in the power of his might.", reference: "Ephesians 6:10" },
    { text: "The Lord is the strength of my life; of whom shall I be afraid?", reference: "Psalm 27:1" },
    { text: "I will strengthen thee; yea, I will help thee.", reference: "Isaiah 41:10" },
    { text: "Watch ye, stand fast in the faith, quit you like men, be strong.", reference: "1 Corinthians 16:13" },
    { text: "I sought the Lord, and he heard me, and delivered me from all my fears.", reference: "Psalm 34:4" },
    { text: "Thou hast loosed my bonds. I will offer to thee the sacrifice of thanksgiving.", reference: "Psalm 116:16-17" },
    { text: "Underneath are the everlasting arms.", reference: "Deuteronomy 33:27" },
    { text: "The Lord is my rock, and my fortress, and my deliverer.", reference: "Psalm 18:2" },
    { text: "Thanks be to God, which giveth us the victory.", reference: "1 Corinthians 15:57" },
    { text: "Though a host should encamp against me, my heart shall not fear.", reference: "Psalm 27:3" },
    { text: "He shall give his angels charge over thee, to keep thee in all thy ways.", reference: "Psalm 91:11" },
    { text: "The name of the Lord is a strong tower: the righteous runneth into it, and is safe.", reference: "Proverbs 18:10" },
    { text: "Trust in the Lord with all thine heart; and lean not unto thine own understanding.", reference: "Proverbs 3:5" },
    { text: "He maketh my feet like hinds' feet, and setteth me upon my high places.", reference: "Psalm 18:33" },
    { text: "Resist the devil, and he will flee from you.", reference: "James 4:7" },
    { text: "When I am weak, then am I strong.", reference: "2 Corinthians 12:10" },
  ],
  worship: [
    { text: "O come, let us worship and bow down: let us kneel before the Lord our maker.", reference: "Psalm 95:6" },
    { text: "Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.", reference: "Psalm 100:4" },
    { text: "Let every thing that hath breath praise the Lord. Praise ye the Lord.", reference: "Psalm 150:6" },
    { text: "I will bless the Lord at all times: his praise shall continually be in my mouth.", reference: "Psalm 34:1" },
    { text: "Worship the Lord in the beauty of holiness.", reference: "Psalm 96:9" },
    { text: "God is a Spirit: and they that worship him must worship him in spirit and in truth.", reference: "John 4:24" },
    { text: "Give unto the Lord the glory due unto his name.", reference: "Psalm 29:2" },
    { text: "I will sing unto the Lord as long as I live.", reference: "Psalm 104:33" },
    { text: "Sing unto the Lord a new song.", reference: "Psalm 96:1" },
    { text: "Make a joyful noise unto the Lord, all ye lands.", reference: "Psalm 100:1" },
    { text: "Enter into his gates with thanksgiving, and into his courts with praise.", reference: "Psalm 100:4" },
    { text: "In every thing give thanks: for this is the will of God in Christ Jesus.", reference: "1 Thessalonians 5:18" },
    { text: "I will lift up mine eyes unto the hills, from whence cometh my help.", reference: "Psalm 121:1" },
    { text: "The Lord is great, and greatly to be praised.", reference: "Psalm 145:3" },
    { text: "My soul doth magnify the Lord.", reference: "Luke 1:46" },
    { text: "I will praise thee, O Lord, with my whole heart.", reference: "Psalm 9:1" },
    { text: "Let the words of my mouth, and the meditation of my heart, be acceptable in thy sight.", reference: "Psalm 19:14" },
    { text: "Praise ye the Lord. Praise God in his sanctuary.", reference: "Psalm 150:1" },
    { text: "Bless the Lord, O my soul: and all that is within me, bless his holy name.", reference: "Psalm 103:1" },
    { text: "Holy, holy, holy, is the Lord of hosts: the whole earth is full of his glory.", reference: "Isaiah 6:3" },
    { text: "Serve the Lord with gladness: come before his presence with singing.", reference: "Psalm 100:2" },
    { text: "I will offer to thee the sacrifice of thanksgiving.", reference: "Psalm 116:17" },
    { text: "Sing aloud unto God our strength.", reference: "Psalm 81:1" },
    { text: "Worthy is the Lamb that was slain to receive power, and riches, and wisdom.", reference: "Revelation 5:12" },
    { text: "Praise him with the sound of the trumpet: praise him with the psaltery and harp.", reference: "Psalm 150:3" },
    { text: "I will declare thy name unto my brethren: in the midst of the congregation will I praise thee.", reference: "Psalm 22:22" },
    { text: "Sing forth the honour of his name: make his praise glorious.", reference: "Psalm 66:2" },
    { text: "O magnify the Lord with me, and let us exalt his name together.", reference: "Psalm 34:3" },
    { text: "It is a good thing to give thanks unto the Lord.", reference: "Psalm 92:1" },
    { text: "Praise is comely for the upright.", reference: "Psalm 33:1" },
    { text: "Let them praise his name in the dance: let them sing praises unto him with the timbrel.", reference: "Psalm 149:3" },
  ],
  majesty: [
    { text: "KING OF KINGS, AND LORD OF LORDS.", reference: "Revelation 19:16" },
    { text: "For unto us a child is born, unto us a son is given: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.", reference: "Isaiah 9:6" },
    { text: "That at the name of Jesus every knee should bow, and every tongue confess that Jesus Christ is Lord.", reference: "Philippians 2:10-11" },
    { text: "The Lord reigneth, he is clothed with majesty; the Lord is clothed with strength.", reference: "Psalm 93:1" },
    { text: "The earth is the Lord's, and the fulness thereof; the world, and they that dwell therein.", reference: "Psalm 24:1" },
    { text: "The heavens declare the glory of God; and the firmament sheweth his handywork.", reference: "Psalm 19:1" },
    { text: "He hath made every thing beautiful in his time.", reference: "Ecclesiastes 3:11" },
    { text: "Great is the Lord, and greatly to be praised in the city of our God.", reference: "Psalm 48:1" },
    { text: "I am Alpha and Omega, the beginning and the end.", reference: "Revelation 22:13" },
    { text: "For of him, and through him, and to him, are all things: to whom be glory for ever.", reference: "Romans 11:36" },
    { text: "Thine, O Lord, is the greatness, and the power, and the glory, and the victory.", reference: "1 Chronicles 29:11" },
    { text: "He shall reign for ever and ever.", reference: "Revelation 11:15" },
    { text: "The Lord hath prepared his throne in the heavens; and his kingdom ruleth over all.", reference: "Psalm 103:19" },
    { text: "Who is the King of glory? The Lord strong and mighty.", reference: "Psalm 24:8" },
    { text: "Honour and majesty are before him: strength and beauty are in his sanctuary.", reference: "Psalm 96:6" },
    { text: "The Lord on high is mightier than the noise of many waters.", reference: "Psalm 93:4" },
    { text: "His glory covered the heavens, and the earth was full of his praise.", reference: "Habakkuk 3:3" },
    { text: "He is before all things, and by him all things consist.", reference: "Colossians 1:17" },
    { text: "Lift up your heads, O ye gates; and the King of glory shall come in.", reference: "Psalm 24:7" },
    { text: "Of his kingdom there shall be no end.", reference: "Luke 1:33" },
    { text: "Worthy is the Lamb that was slain to receive power, and riches, and wisdom, and strength.", reference: "Revelation 5:12" },
    { text: "Let God arise, let his enemies be scattered.", reference: "Psalm 68:1" },
    { text: "The Lord shall be king over all the earth.", reference: "Zechariah 14:9" },
    { text: "In him dwelleth all the fulness of the Godhead bodily.", reference: "Colossians 2:9" },
    { text: "His dominion is an everlasting dominion.", reference: "Daniel 7:14" },
    { text: "I am the Lord, and there is none else, there is no God beside me.", reference: "Isaiah 45:5" },
    { text: "The Lord hath done great things for us; whereof we are glad.", reference: "Psalm 126:3" },
    { text: "He is the King of kings, and Lord of lords.", reference: "1 Timothy 6:15" },
    { text: "All power is given unto me in heaven and in earth.", reference: "Matthew 28:18" },
    { text: "The Lord is great, and greatly to be praised: he is to be feared above all gods.", reference: "Psalm 96:4" },
    { text: "Behold, I come quickly; and my reward is with me, to give every man according as his work shall be.", reference: "Revelation 22:12" },
  ],
};

/** Lower-cased mood ids, in stable order, for analytics & UI. */
export const MOOD_PACK_IDS: VerseMood[] = ["peace", "hope", "strength", "worship", "majesty"];

export const MOOD_PACK_VERSE_COUNT = 30;

/** Returns the verse for a mood pack on the given date (rotates every 30 days). */
export function getMoodPackVerse(mood: VerseMood, date?: Date): DailyVerse {
  const d = date || new Date();
  const epochDay = Math.floor(d.getTime() / 86400000);
  const idx = ((epochDay % MOOD_PACK_VERSE_COUNT) + MOOD_PACK_VERSE_COUNT) % MOOD_PACK_VERSE_COUNT;
  return PACKS[mood][idx];
}

export function getMoodPackVerses(mood: VerseMood): DailyVerse[] {
  return PACKS[mood];
}

// ---------- Active mood-pack store (localStorage + window event) ----------

// NOTE: validation of the stored id lives in @/data/versePacks (the registry),
// so this store stays free of import cycles and accepts any pack id.
export function readActiveMoodPack(): string | null {
  try {
    const v = localStorage.getItem(ACTIVE_MOOD_PACK_STORAGE_KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function setActiveMoodPack(mood: string | null) {
  try {
    if (mood) localStorage.setItem(ACTIVE_MOOD_PACK_STORAGE_KEY, mood);
    else localStorage.removeItem(ACTIVE_MOOD_PACK_STORAGE_KEY);
  } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(ACTIVE_MOOD_PACK_EVENT)); } catch { /* ssr */ }
}

export function subscribeActiveMoodPack(cb: () => void): () => void {
  const onCustom = () => cb();
  const onStorage = (e: StorageEvent) => { if (e.key === ACTIVE_MOOD_PACK_STORAGE_KEY) cb(); };
  window.addEventListener(ACTIVE_MOOD_PACK_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ACTIVE_MOOD_PACK_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
