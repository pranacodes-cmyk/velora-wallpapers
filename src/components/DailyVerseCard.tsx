import { motion } from "framer-motion";
import { Smartphone, Sun, Share2 } from "lucide-react";
import { forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDailyVerse } from "@/hooks/useDailyVerse";
import { haptic } from "@/utils/haptics";
import { nativeShare } from "@/utils/nativeShare";
import { track } from "@/services/analytics";
import { useT } from "@/i18n";

// Optimized WebP crop from the original uploaded golden tree image.
import heroThumb from "@/assets/verse-bg-thumb/daily-verse-tree-card.webp";

export const DailyVerseCard = forwardRef<HTMLDivElement>(function DailyVerseCard(_props, ref) {
  const navigate = useNavigate();
  const { verse } = useDailyVerse();
  const { t, lang } = useT();

  const handleShareApp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic("soft");
    track("daily_verse_card_share_tapped", { surface: "today_home" });
    await nativeShare({
      text: t("ov.card.shareText", { text: verse.text, ref: verse.reference }),
      dialogTitle: t("ov.card.shareDialogTitle"),
    });
  };

  const handleCardClick = () => {
    track("daily_verse_card_clicked", { surface: "today_home", reference: verse.reference });
    navigate("/daily-verse");
  };

  const today = new Date();
  const monthLabel = (() => {
    try {
      return new Intl.DateTimeFormat(lang === "fil" ? "fil-PH" : lang, { month: "short" })
        .format(today)
        .replace(/\.$/, "");
    } catch {
      return t(`today.month.${today.getMonth()}`).slice(0, 3);
    }
  })();
  const dayLabel = today.getDate();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mx-3 mb-3"
    >
      <motion.div
        whileTap={{ scale: 0.985 }}
        onClick={handleCardClick}
        className="relative overflow-hidden rounded-[24px] cursor-pointer bg-card"
        style={{
          border: "1px solid hsl(42 70% 55% / 0.28)",
          boxShadow:
            "0 22px 48px -18px hsl(0 0% 0% / 0.55), 0 6px 18px -8px hsl(0 0% 0% / 0.35), 0 0 0 1px hsl(42 88% 46% / 0.06), inset 0 1px 0 hsl(42 90% 70% / 0.12)",
        }}
      >
        {/* Hero photo — locked crop, wider lane with premium ease-out fade. */}
        <div
          className="absolute inset-y-0 left-0 pointer-events-none overflow-hidden"
          style={{ width: "40%" }}
        >
          <img
            src={heroThumb}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            width={720}
            height={556}
            style={{ objectPosition: "32% center" }}
          />
          {/* Soft golden vignette over hero for richness */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 25% 50%, hsl(42 90% 55% / 0.10), transparent 65%)",
            }}
          />
          {/* Premium ease-out fade — long, multi-stop, no visible seam */}
          <div
            className="absolute inset-y-0 right-0 w-[78%]"
            style={{
              background:
                "linear-gradient(90deg, hsl(var(--card) / 0) 0%, hsl(var(--card) / 0.06) 18%, hsl(var(--card) / 0.20) 34%, hsl(var(--card) / 0.42) 50%, hsl(var(--card) / 0.68) 66%, hsl(var(--card) / 0.88) 82%, hsl(var(--card)) 100%)",
            }}
          />
        </div>

        {/* Top sheen highlight */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(42 90% 70% / 0.55), transparent)",
          }}
        />

        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, hsl(42 95% 75% / 0.16), transparent)" }}
        />

        <div className="relative flex items-stretch">
          {/* ── LEFT spacer: matches image lane (light overlap into fade is intentional) ── */}
          <div className="w-[32%] flex-shrink-0" aria-hidden="true" />

          {/* ── MIDDLE: title, description, verse card ── */}
          <div className="flex-1 min-w-0 flex flex-col justify-center pl-2 pr-1.5 py-2.5 gap-1 overflow-hidden">
            {/* AUTO-CHANGING pill */}
            <div
              className="inline-flex max-w-full items-center gap-1 whitespace-nowrap self-start rounded-full px-1.5 py-[2px]"
              style={{
                background: "hsl(var(--primary) / 0.14)",
                border: "1px solid hsl(var(--primary) / 0.32)",
              }}
            >
              <Sun className="w-2 h-2 text-primary flex-shrink-0" strokeWidth={2.6} />
              <span className="min-w-0 truncate text-[7px] font-extrabold tracking-[0.13em] uppercase leading-none text-primary">
                {t("ov.card.autoChanging")}
              </span>
            </div>

            <h2 className="max-w-full text-[12px] font-extrabold leading-[1.1] tracking-tight text-foreground">
              {t("ov.card.title")}
            </h2>

            <p className="text-[8.5px] font-semibold leading-[1.32] text-foreground/80 line-clamp-2">
              {t("ov.card.desc")}
            </p>

            <div
              className="relative max-w-full rounded-[10px] px-1.5 py-1 mt-0.5 overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--muted) / 0.6), hsl(var(--muted) / 0.35))",
                border: "1px solid hsl(var(--primary) / 0.28)",
                boxShadow:
                  "inset 0 1px 0 hsl(42 90% 70% / 0.10), 0 2px 8px -4px hsl(0 0% 0% / 0.3)",
              }}
            >
              <p className="text-[8.5px] font-semibold leading-[1.32] line-clamp-2 text-foreground">
                <span
                  className="font-bold mr-0.5 align-top text-primary"
                  style={{ fontSize: "10.5px", lineHeight: 1 }}
                >
                  &ldquo;
                </span>
                {verse.text}
              </p>
              <p className="text-[7.5px] font-bold mt-0.5 ml-2.5 text-primary">
                — {verse.reference}
              </p>
            </div>
          </div>

          {/* ── RIGHT: hairline + Today/date + calendar icon + CTA ── */}
          <div
            className="relative flex flex-col flex-shrink-0 items-center px-1.5 py-2.5 gap-1"
            style={{ width: "74px" }}
          >
            {/* Gold-tinted hairline divider */}
            <div
              className="absolute left-0 top-2.5 bottom-2.5 w-px"
              style={{
                background:
                  "linear-gradient(180deg, transparent, hsl(42 70% 55% / 0.45) 30%, hsl(42 70% 55% / 0.45) 70%, transparent)",
              }}
            />

            {/* Date block */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[8.5px] font-medium leading-none text-muted-foreground tracking-wide">
                {t("ov.card.today")}
              </span>
              <span
                className="text-[11px] font-extrabold text-primary leading-none whitespace-nowrap"
                style={{ textShadow: "0 0 12px hsl(42 88% 55% / 0.45)" }}
              >
                {monthLabel} {dayLabel}
              </span>
            </div>

            {/* Share App pill — placed right above CTA so it's always noticed */}
            <div className="flex-1 flex items-center justify-center w-full">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleShareApp}
                aria-label={t("ov.card.shareAria")}
                className="relative flex items-center justify-center gap-1 rounded-full px-2 py-[5px] active:opacity-90"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(42 90% 55% / 0.18), hsl(42 90% 55% / 0.08))",
                  border: "1px solid hsl(42 88% 55% / 0.55)",
                  boxShadow:
                    "0 0 0 1px hsl(42 90% 55% / 0.10), 0 4px 10px -4px hsl(42 88% 46% / 0.45), inset 0 1px 0 hsl(42 95% 75% / 0.25)",
                }}
              >
                <Share2 className="relative w-2.5 h-2.5 text-primary" strokeWidth={2.8} />
                <span className="relative text-[7.5px] font-extrabold tracking-[0.1em] uppercase text-primary leading-none">
                  {t("ov.card.shareLabel")}
                </span>
              </motion.button>
            </div>

            {/* CTA — compact stacked button */}
            <motion.div
              whileTap={{ scale: 0.94 }}
              className="relative flex flex-col items-center justify-center gap-0 rounded-[10px] text-primary-foreground mt-auto overflow-hidden w-[58px] py-1"
              style={{
                background:
                  "linear-gradient(135deg, hsl(42 95% 62%) 0%, hsl(42 88% 50%) 50%, hsl(38 85% 45%) 100%)",
                boxShadow:
                  "0 4px 10px hsl(42 88% 46% / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.35), inset 0 -1px 0 hsl(0 0% 0% / 0.12)",
              }}
            >
              <Smartphone className="relative w-2.5 h-2.5 mb-0.5" strokeWidth={2.6} />
              <span className="relative text-[6.5px] font-bold tracking-[0.08em] uppercase opacity-90 leading-none">
                {t("ov.card.setLabel")}
              </span>
              <span className="relative text-[7.5px] font-extrabold tracking-tight leading-[1.15] mt-0.5">
                {t("ov.card.wallpaper")}
              </span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
