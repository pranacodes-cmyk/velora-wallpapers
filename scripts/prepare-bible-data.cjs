// Build shared book-wise compressed Scripture assets from verified source files.
// Source acquisition stays in /tmp; the generated editions carry attribution.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const usfm = require('usfm-js');
const root = '/tmp/bible-source';
const names = {
es: 'Génesis|Éxodo|Levítico|Números|Deuteronomio|Josué|Jueces|Rut|1 Samuel|2 Samuel|1 Reyes|2 Reyes|1 Crónicas|2 Crónicas|Esdras|Nehemías|Ester|Job|Salmos|Proverbios|Eclesiastés|Cantares|Isaías|Jeremías|Lamentaciones|Ezequiel|Daniel|Oseas|Joel|Amós|Abdías|Jonás|Miqueas|Nahúm|Habacuc|Sofonías|Hageo|Zacarías|Malaquías|Mateo|Marcos|Lucas|Juan|Hechos|Romanos|1 Corintios|2 Corintios|Gálatas|Efesios|Filipenses|Colosenses|1 Tesalonicenses|2 Tesalonicenses|1 Timoteo|2 Timoteo|Tito|Filemón|Hebreos|Santiago|1 Pedro|2 Pedro|1 Juan|2 Juan|3 Juan|Judas|Apocalipsis',
pt: 'Gênesis|Êxodo|Levítico|Números|Deuteronômio|Josué|Juízes|Rute|1 Samuel|2 Samuel|1 Reis|2 Reis|1 Crônicas|2 Crônicas|Esdras|Neemias|Ester|Jó|Salmos|Provérbios|Eclesiastes|Cânticos|Isaías|Jeremias|Lamentações|Ezequiel|Daniel|Oseias|Joel|Amós|Obadias|Jonas|Miqueias|Naum|Habacuque|Sofonias|Ageu|Zacarias|Malaquias|Mateus|Marcos|Lucas|João|Atos|Romanos|1 Coríntios|2 Coríntios|Gálatas|Efésios|Filipenses|Colossenses|1 Tessalonicenses|2 Tessalonicenses|1 Timóteo|2 Timóteo|Tito|Filemom|Hebreus|Tiago|1 Pedro|2 Pedro|1 João|2 João|3 João|Judas|Apocalipse',
fr: 'Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|1 Samuel|2 Samuel|1 Rois|2 Rois|1 Chroniques|2 Chroniques|Esdras|Néhémie|Esther|Job|Psaumes|Proverbes|Ecclésiaste|Cantique des cantiques|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Actes|Romains|1 Corinthiens|2 Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|1 Thessaloniciens|2 Thessaloniciens|1 Timothée|2 Timothée|Tite|Philémon|Hébreux|Jacques|1 Pierre|2 Pierre|1 Jean|2 Jean|3 Jean|Jude|Apocalypse',
de: '1 Mose|2 Mose|3 Mose|4 Mose|5 Mose|Josua|Richter|Ruth|1 Samuel|2 Samuel|1 Könige|2 Könige|1 Chronik|2 Chronik|Esra|Nehemia|Esther|Hiob|Psalmen|Sprüche|Prediger|Hohelied|Jesaja|Jeremia|Klagelieder|Hesekiel|Daniel|Hosea|Joel|Amos|Obadja|Jona|Micha|Nahum|Habakuk|Zephanja|Haggai|Sacharja|Maleachi|Matthäus|Markus|Lukas|Johannes|Apostelgeschichte|Römer|1 Korinther|2 Korinther|Galater|Epheser|Philipper|Kolosser|1 Thessalonicher|2 Thessalonicher|1 Timotheus|2 Timotheus|Titus|Philemon|Hebräer|Jakobus|1 Petrus|2 Petrus|1 Johannes|2 Johannes|3 Johannes|Judas|Offenbarung',
fil: 'Genesis|Exodo|Levitico|Mga Bilang|Deuteronomio|Josue|Mga Hukom|Ruth|1 Samuel|2 Samuel|1 Mga Hari|2 Mga Hari|1 Mga Cronica|2 Mga Cronica|Ezra|Nehemias|Esther|Job|Mga Awit|Mga Kawikaan|Eclesiastes|Awit ni Solomon|Isaias|Jeremias|Mga Panaghoy|Ezekiel|Daniel|Oseas|Joel|Amos|Obadias|Jonas|Mikas|Nahum|Habacuc|Sofonias|Hagai|Zacarias|Malakias|Mateo|Marcos|Lucas|Juan|Mga Gawa|Mga Taga-Roma|1 Mga Taga-Corinto|2 Mga Taga-Corinto|Mga Taga-Galacia|Mga Taga-Efeso|Mga Taga-Filipos|Mga Taga-Colosas|1 Mga Taga-Tesalonica|2 Mga Taga-Tesalonica|1 Timoteo|2 Timoteo|Tito|Filemon|Mga Hebreo|Santiago|1 Pedro|2 Pedro|1 Juan|2 Juan|3 Juan|Judas|Apocalipsis',
};
const urls = {
en: 'https://github.com/midvash/bible-data/tree/main/versions/en/kjv',
es: 'https://github.com/scrollmapper/bible_databases/blob/master/formats/json/SpaRV.json',
pt: 'https://github.com/midvash/bible-data/tree/main/versions/pt/almeida-livre',
fr: 'https://github.com/midvash/bible-data/tree/main/versions/fr/lsg',
de: 'https://github.com/midvash/bible-data/tree/main/versions/de/luth1912',
fil: 'https://github.com/scrollmapper/bible_databases/blob/master/formats/json/TagAngBiblia.json',
hi: 'https://ebible.org/hin2017/', id: 'https://git.door43.org/Door43-Catalog/id_ulb',
};
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]); }
function verseText(objects) {
  return (objects ?? []).map(o => {
    if (['f','fe','x','bdit','f*','x*'].includes(o.tag)) return '';
    if (o.type === 'text') return o.text ?? '';
    if (o.type === 'word' || ['wj','add','nd','it','bd','qt'].includes(o.tag)) return (o.text ?? '') + verseText(o.children);
    if (/^(it|wj|add|nd|bd|qt)\*$/.test(o.tag ?? '')) return o.content ?? '';
    if (o.children) return verseText(o.children);
    return '';
  }).join('');
}
for (const lang of ['en','es','pt','fil','hi','id','fr','de']) {
  let books, name, license;
  if (lang === 'hi' || lang === 'id') {
    books = walk(path.join(root, lang)).filter(f => f.endsWith('.usfm')).sort().map(f => {
      const parsed = usfm.toJSON(fs.readFileSync(f, 'utf8'));
      const name = parsed.headers.find(h => h.tag === 'toc2')?.content?.trim() ?? parsed.headers.find(h => h.tag === 'h')?.content?.trim();
      const chapters = Object.entries(parsed.chapters).filter(([c]) => /^\d+$/.test(c)).sort((a,b) => Number(a[0])-Number(b[0])).map(([,c]) => {
        const verses = [];
        for (const [num,v] of Object.entries(c)) {
          if (!/^\d+(?:-\d+)?$/.test(num)) continue;
          const text = verseText(v.verseObjects).replace(/\s+/g,' ').trim();
          const [start,end] = num.split('-').map(Number);
          for (let i=start; i<=(end ?? start); i++) verses[i-1]=text;
        }
        if (verses.some((v,i) => !v && !(lang === 'id' && /menghilangkan|Lihat catatan di ayat|Beberapa salinan kuno memiliki ayat/i.test(JSON.stringify(c[String(i+1)]))))) throw new Error(`Missing verse ${f}`);
        return verses;
      });
      return { name, chapters };
    });
    name = lang === 'hi' ? 'Indian Revised Version · Hindi 2017' : 'Unlocked Literal Bible · Perjanjian Baru';
    license = lang === 'hi' ? 'CC BY-SA 4.0 · © 2017–2019 Bridge Connectivity Solutions' : 'CC BY-SA 4.0 · Door43 World Missions Community';
  } else {
    const source = JSON.parse(fs.readFileSync(path.join(root, lang+'.json'), 'utf8'));
    name = source.name ?? (lang === 'es' ? 'Reina-Valera 1909' : 'Ang Biblia 1905');
    license = 'Public domain';
    books = source.books.map((b,i) => ({ name: names[lang]?.split('|')[i] ?? b.englishName ?? b.name, chapters: b.chapters.map(c => c.verses.map(v => v.text.trim())) }));
  }
  if (books.length !== (lang === 'id' ? 27 : 66)) throw new Error(`Incomplete ${lang}: ${books.length}`);
  const meta = { language: lang, name, license, source: urls[lang], testament: lang === 'id' ? 'new' : 'both', books: books.map((b,i) => ({ name: b.name, canonicalId: i + (lang === 'id' ? 39 : 0), chapters: b.chapters.length })) };
  for (const base of ['public/bible', 'flutter_app/assets/bible']) {
    const dir = path.join(base,lang); fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'index.json'), JSON.stringify(meta));
    books.forEach((b,i) => fs.writeFileSync(path.join(dir,i+'.json.gz'), zlib.gzipSync(JSON.stringify(b.chapters), {level:9})));
    fs.writeFileSync(path.join(dir,'LICENSE.txt'), `${name}\n${license}\n${urls[lang]}\n${lang === 'id' ? 'Original work available at https://door43.org/. New Testament only. Verses absent from the source manuscripts are not filled with invented text.\n' : ''}${['hi','id'].includes(lang) ? 'https://creativecommons.org/licenses/by-sa/4.0/\nText extracted from USFM; notes and headings omitted; verse wording unchanged. This text adaptation is distributed under CC BY-SA 4.0.\n' : ''}`);
  }
  console.log(lang,books.length,books.reduce((n,b) => n+b.chapters.flat().length,0));
}