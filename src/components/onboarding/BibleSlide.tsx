import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Heart, MessageCircle, Share2, Languages, Layers, Lock } from "lucide-react";
import { useT } from "@/i18n";
import { loadEdition, loadBibleBook } from "@/services/bibleReader";
import {
  ONB_IN_DELAY, ONB_IN_DUR, ONB_SLIDE_EXIT, ONB_SLIDE_FADE_SECONDS, ONB_REPEAT,
  headlineStyle, goldSpan, bgSunrise,
} from "./onboardingShared";

// John 3:16, John 14:27, John 8:12 — John is present in every bundled edition.
const PICKS: Array<[number, number]> = [[2, 15], [13, 26], [7, 11]];
const JOHN = 42;

export function BibleSlide({ active, exiting }: { active: boolean; exiting?: boolean }) {
  const { t, lang } = useT();
  const [cards, setCards] = useState<{ ref: string; text: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    let alive = true;
    loadEdition(lang).then(async (e) => {
      const bi = e.books.findIndex((b) => b.canonicalId === JOHN);
      if (bi < 0) return;
      const ch = await loadBibleBook(lang, bi);
      if (!alive) return;
      setCards(PICKS.map(([c, v]) => ({ ref: `${e.books[bi].name} ${c + 1}:${v + 1}`, text: (ch[c]?.[v] ?? "").replace(/^[\s,;:.]+/, "") })).filter((x) => x.text));
    }).catch(() => {});
    return () => { alive = false; };
  }, [lang]);

  useEffect(() => {
    if (!active || cards.length < 2) return;
    const id = window.setInterval(() => { setIdx((i) => (i + 1) % cards.length); setLiked(false); }, 2800);
    const like = window.setInterval(() => setLiked(true), 2800);
    const first = window.setTimeout(() => setLiked(true), 1300);
    return () => { clearInterval(id); clearInterval(like); clearTimeout(first); };
  }, [active, cards.length]);

  if (!active) return null;
  const card = cards[idx];
  const features = [
    { icon: Languages, label: t("onb.bible.f1") },
    { icon: Layers, label: t("onb.bible.f2") },
    { icon: Lock, label: t("onb.bible.f3") },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      exit={ONB_SLIDE_EXIT}
      transition={{ duration: ONB_SLIDE_FADE_SECONDS, ease: "easeOut" }}
      className="onb-slide-layer absolute inset-0 flex flex-col items-center overflow-hidden"
    >
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 70% at 50% 30%, hsl(222 55% 13%) 0%, hsl(222 65% 5%) 75%)" }} />
      <motion.div
        animate={{ opacity: [0.3, 0.55, 0.3], scale: [1, 1.08, 1] }}
        transition={{ duration: 5, repeat: ONB_REPEAT, ease: "easeInOut" }}
        className="pointer-events-none absolute rounded-full"
        style={{ width: 460, height: 460, top: "14%", background: "radial-gradient(circle, hsl(42 90% 55% / 0.2) 0%, transparent 65%)" }}
      />

      <div className="relative z-10 flex max-h-full w-full flex-col items-center overflow-y-auto px-7 pb-36 pt-[max(env(safe-area-inset-top),36px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-full max-w-[420px] flex-col items-center">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 0.75, y: 0 }} transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR }}
            className="mb-3 text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: "hsl(42 75% 60%)" }}>
            {t("onb.bible.kicker")}
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ONB_IN_DELAY, duration: ONB_IN_DUR, ease: [0.22, 1, 0.36, 1] }}
            className="mb-5 text-center text-[25px] font-bold leading-[1.18]" style={headlineStyle}>
            {t("onb.bible.headlinePre")}<br /><span style={goldSpan}>{t("onb.bible.headlineGold")}</span>
          </motion.h2>

          {/* Mini reader — vertical verse feed */}
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: ONB_IN_DELAY + 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-[230px] overflow-hidden rounded-[28px]"
            style={{ height: 300, border: "1px solid hsl(42 80% 60% / 0.35)", boxShadow: "0 24px 60px -18px hsl(42 90% 50% / 0.35), 0 0 0 6px hsl(222 50% 10% / 0.8)" }}>
            <img src={bgSunrise} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(222 60% 6% / 0.55), hsl(222 60% 5% / 0.92))" }} />
            <div className="absolute left-0 right-0 top-3 flex justify-center gap-4 text-[10px] font-bold">
              <span style={{ color: "hsl(42 95% 66%)" }} className="border-b-2 border-primary pb-0.5">{t("bible.feed")}</span>
              <span className="text-foreground/50">{t("bible.normal")}</span>
            </div>
            <AnimatePresence mode="popLayout">
              {card && (
                <motion.div key={idx} initial={{ y: 300, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -300, opacity: 0 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex flex-col justify-center py-10 pl-5 pr-12">
                  <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "hsl(42 95% 66%)" }}>{card.ref}</p>
                  <p className="line-clamp-6 font-serif text-[15px] leading-[1.45] text-foreground/95">{card.text}</p>
                </motion.div>
              )}
            </AnimatePresence>
            {!card && <div className="absolute inset-0 flex items-center justify-center"><BookOpen className="h-8 w-8 text-primary" /></div>}
            <div className="absolute bottom-6 right-3 flex flex-col items-center gap-4 text-foreground/80">
              <motion.div animate={liked ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.4 }}>
                <Heart className="h-5 w-5" style={{ color: liked ? "hsl(42 95% 62%)" : undefined }} fill={liked ? "currentColor" : "none"} />
              </motion.div>
              <MessageCircle className="h-5 w-5" />
              <Share2 className="h-[18px] w-[18px]" />
            </div>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: ONB_IN_DELAY + 0.1, duration: ONB_IN_DUR }}
            className="mt-5 max-w-[310px] text-center text-[12.5px] leading-relaxed" style={{ color: "hsl(40 22% 82%)" }}>
            {t("onb.bible.subcopy")}
          </motion.p>

          <div className="mt-4 flex w-full max-w-[320px] flex-col gap-2">
            {features.map(({ icon: Icon, label }, i) => (
              <motion.div key={label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ONB_IN_DELAY + 0.15 + i * 0.06, duration: ONB_IN_DUR }}
                className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
                style={{ background: "hsl(222 45% 12% / 0.7)", border: "1px solid hsl(42 70% 60% / 0.18)" }}>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: "hsl(42 90% 55% / 0.16)" }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: "hsl(42 95% 64%)" }} />
                </span>
                <span className="text-[12.5px] font-semibold text-foreground/90">{label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
