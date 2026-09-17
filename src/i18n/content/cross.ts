// Short engraved lines for the personalized 3D cross.
// These are intentionally SHORT paraphrase-style lines (not full verse text)
// so they engrave cleanly on the cross in every language.

import type { LangCode } from "../config";

type CrossPack = Record<string, string>;

const PACKS: Partial<Record<LangCode, CrossPack>> = {
  es: {
    "john-3-16": "Porque tanto amó Dios al mundo.",
    "phil-4-13": "Todo lo puedo en Cristo.",
    "psalm-23-1": "El Señor es mi pastor.",
    "jer-29-11": "Planes de bien, no de mal.",
    "prov-3-5": "Confía en el Señor de todo corazón.",
    "isa-41-10": "No temas, yo estoy contigo.",
    "rom-8-28": "Todo obra para bien.",
    "psalm-46-10": "Quédate quieto y conoce a Dios.",
    "matt-11-28": "Ven a mí y te daré descanso.",
    "john-14-6": "Yo soy el camino, la verdad y la vida.",
  },
  pt: {
    "john-3-16": "Porque Deus amou o mundo.",
    "phil-4-13": "Tudo posso em Cristo.",
    "psalm-23-1": "O Senhor é meu pastor.",
    "jer-29-11": "Planos de bem, não de mal.",
    "prov-3-5": "Confie no Senhor de todo o coração.",
    "isa-41-10": "Não temas, eu estou contigo.",
    "rom-8-28": "Tudo coopera para o bem.",
    "psalm-46-10": "Acalme-se e saiba que Eu sou Deus.",
    "matt-11-28": "Venha a mim e eu te darei descanso.",
    "john-14-6": "Eu sou o caminho, a verdade e a vida.",
  },
  fil: {
    "john-3-16": "Sobrang inibig ng Diyos ang mundo.",
    "phil-4-13": "Kaya ko ang lahat sa kay Cristo.",
    "psalm-23-1": "Ang Panginoon ang aking pastol.",
    "jer-29-11": "Plano ng kabutihan, hindi kapahamakan.",
    "prov-3-5": "Magtiwala sa Panginoon ng buong puso.",
    "isa-41-10": "Huwag matakot, kasama mo Ako.",
    "rom-8-28": "Lahat ay para sa kabutihan.",
    "psalm-46-10": "Tumahimik at kilalanin ang Diyos.",
    "matt-11-28": "Lumapit sa Akin at pagpapahingahin kita.",
    "john-14-6": "Ako ang daan, katotohanan at buhay.",
  },
  hi: {
    "john-3-16": "परमेश्वर ने जगत से ऐसा प्रेम किया।",
    "phil-4-13": "मसीह में मैं सब कुछ कर सकता हूँ।",
    "psalm-23-1": "यहोवा मेरा चरवाहा है।",
    "jer-29-11": "भलाई की योजना, हानि की नहीं।",
    "prov-3-5": "पूरे मन से प्रभु पर भरोसा रखो।",
    "isa-41-10": "मत डर, मैं तेरे साथ हूँ।",
    "rom-8-28": "सब कुछ भलाई के लिए होता है।",
    "psalm-46-10": "शांत रहो और जानो मैं परमेश्वर हूँ।",
    "matt-11-28": "मेरे पास आ, मैं तुझे विश्राम दूँगा।",
    "john-14-6": "मैं मार्ग, सत्य और जीवन हूँ।",
  },
  id: {
    "john-3-16": "Begitu besar kasih Allah akan dunia.",
    "phil-4-13": "Segala hal kutanggung dalam Kristus.",
    "psalm-23-1": "Tuhan adalah gembalaku.",
    "jer-29-11": "Rancangan damai, bukan kecelakaan.",
    "prov-3-5": "Percayalah kepada Tuhan dengan segenap hati.",
    "isa-41-10": "Jangan takut, Aku menyertaimu.",
    "rom-8-28": "Segala sesuatu mendatangkan kebaikan.",
    "psalm-46-10": "Diamlah dan ketahuilah Aku Allah.",
    "matt-11-28": "Datanglah kepada-Ku, Aku beri kelegaan.",
    "john-14-6": "Akulah jalan, kebenaran dan hidup.",
  },
  fr: {
    "john-3-16": "Dieu a tant aimé le monde.",
    "phil-4-13": "Je puis tout en Christ.",
    "psalm-23-1": "L'Éternel est mon berger.",
    "jer-29-11": "Des projets de paix, non de malheur.",
    "prov-3-5": "Confie-toi en l'Éternel de tout ton cœur.",
    "isa-41-10": "Ne crains rien, je suis avec toi.",
    "rom-8-28": "Tout concourt à ton bien.",
    "psalm-46-10": "Arrête-toi et sache que je suis Dieu.",
    "matt-11-28": "Venez à moi, je vous donnerai du repos.",
    "john-14-6": "Je suis le chemin, la vérité et la vie.",
  },
  de: {
    "john-3-16": "So sehr hat Gott die Welt geliebt.",
    "phil-4-13": "Alles kann ich durch Christus.",
    "psalm-23-1": "Der Herr ist mein Hirte.",
    "jer-29-11": "Pläne zum Guten, nicht zum Bösen.",
    "prov-3-5": "Vertraue dem Herrn von ganzem Herzen.",
    "isa-41-10": "Fürchte dich nicht, ich bin bei dir.",
    "rom-8-28": "Alles dient zum Guten.",
    "psalm-46-10": "Sei still und erkenne: Ich bin Gott.",
    "matt-11-28": "Komm zu mir, ich gebe dir Ruhe.",
    "john-14-6": "Ich bin der Weg, die Wahrheit und das Leben.",
  },
};

/** Short engraved line for a personal-cross verse id in the given language. */
export function crossLine(lang: LangCode, id: string): string | undefined {
  return PACKS[lang]?.[id];
}
