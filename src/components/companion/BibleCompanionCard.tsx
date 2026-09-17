import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, Feather, MessageCircleHeart } from "lucide-react";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";

/**
 * Inline "Talk with Jesus" entry card on Today.
 * - Tap a chip → instantly opens the chat page with that prompt pre-sent.
 * - Type + send → opens the chat page with the typed text pre-sent.
 * Theme-aware via semantic tokens so it adapts to both light and dark modes.
 */

const CHIP_KEYS = ["anxious", "family", "hope", "forgiveness", "lost"] as const;

export function BibleCompanionCard() {
  const { t } = useT();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const CHIPS = CHIP_KEYS.map((k) => ({
    label: t(`ov.companion.chip.${k}.label`),
    text: t(`ov.companion.chip.${k}.text`),
  }));

  const go = (text: string) => {
    const t = text.trim();
    if (!t) return;
    haptic("medium");
    navigate(`/companion?q=${encodeURIComponent(t)}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15 }}
      className="px-4 mt-7 mb-3"
    >
      {/* Feature headline — same hierarchy as the Journey card */}
      <div className="px-1 mb-3.5">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[10px] font-extrabold tracking-[0.22em] uppercase px-2 py-[3px] rounded-full inline-flex items-center gap-1.5"
            style={{
              color: "hsl(var(--primary))",
              background: "hsl(var(--primary) / 0.12)",
              border: "1px solid hsl(var(--primary) / 0.35)",
            }}
          >
            <span
              className="inline-block w-[6px] h-[6px] rounded-full animate-pulse"
              style={{ background: "hsl(var(--primary))", boxShadow: "0 0 8px hsl(var(--primary))" }}
            />
            {t("ov.companion.badge")}
          </span>
        </div>
        <h2
          className="text-[26px] font-black leading-[1.05] tracking-tight text-foreground"
          style={{ fontFamily: "'Georgia','Times New Roman',serif" }}
        >
          {t("ov.companion.title1")}
          <br />
          <span
            style={{
              background:
                "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(42 95% 65%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {t("ov.companion.title2")}
          </span>
        </h2>
        <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground max-w-[300px]">
          {t("ov.companion.subtitle")}
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-[26px] p-4"
        style={{
          background:
            "var(--tile-grad, linear-gradient(155deg, hsl(220 45% 14%) 0%, hsl(225 55% 10%) 60%, hsl(230 60% 8%) 100%))",
          border: "1.5px solid var(--tile-border, hsl(var(--primary) / 0.45))",
          boxShadow:
            "var(--tile-shadow, 0 22px 50px -18px hsl(var(--primary) / 0.55)), inset 0 1px 0 hsl(var(--primary) / 0.18), 0 0 0 1px hsl(var(--primary) / 0.08)",
        }}
      >
        {/* Soft gold aura — top right */}
        <div
          aria-hidden
          className="absolute -top-20 -right-12 w-52 h-52 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, var(--tile-aurora, hsl(45 95% 58% / 0.5)), transparent 70%)",
            filter: "blur(8px)",
          }}
        />
        {/* Second royal-blue aura — bottom left, for depth */}
        <div
          aria-hidden
          className="absolute -bottom-24 -left-14 w-52 h-52 rounded-full pointer-events-none opacity-80"
          style={{
            background:
              "radial-gradient(circle, hsl(220 80% 55% / 0.28) 0%, transparent 65%)",
            filter: "blur(40px)",
          }}
        />
        {/* Subtle shimmer in dark mode */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-0 dark:opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 20% 30%, white, transparent), radial-gradient(1px 1px at 70% 60%, white, transparent), radial-gradient(1px 1px at 40% 80%, white, transparent)",
          }}
        />

        {/* Title row */}
        <div className="relative flex items-center gap-2.5 mb-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background:
                "radial-gradient(120% 120% at 30% 20%, hsl(var(--primary) / 0.55), hsl(var(--primary) / 0.12) 70%)",
              border: "1px solid hsl(var(--primary) / 0.55)",
              boxShadow:
                "inset 0 1px 0 hsl(0 0% 100% / 0.35), 0 6px 18px -8px hsl(var(--primary) / 0.6)",
            }}
          >
            <MessageCircleHeart className="w-[18px] h-[18px] text-primary" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[17px] font-black tracking-[-0.01em] text-foreground leading-none">
                {t("ov.companion.cardTitle")}
              </h3>
              <Feather
                className="w-3.5 h-3.5"
                style={{ color: "hsl(42 95% 55%)" }}
                strokeWidth={2.4}
              />
            </div>
            <p className="text-[11.5px] leading-tight text-foreground/65 mt-1">
              {t("ov.companion.cardSubtitle")}
            </p>
          </div>
        </div>

        {/* Chips — wrap so nothing gets cut off */}
        <div className="relative mb-3">
          <div className="flex flex-wrap gap-1.5">
            {CHIPS.map((c) => (
              <motion.button
                key={c.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => go(c.text)}
                className="px-2.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                style={{
                  background: "hsl(var(--primary) / 0.14)",
                  color: "hsl(var(--primary))",
                  border: "1px solid hsl(var(--primary) / 0.32)",
                }}
              >
                {c.label}
              </motion.button>
            ))}
          </div>
        </div>


        {/* Input + send */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(input);
          }}
          className="relative flex items-center gap-2 rounded-[18px] p-1.5 pl-3.5"
          style={{
            background: "hsl(var(--background) / 0.5)",
            backdropFilter: "blur(20px)",
            border: "1px solid hsl(var(--primary) / 0.28)",
            boxShadow: "inset 0 1px 0 hsl(var(--primary) / 0.08)",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("ov.companion.inputPlaceholder")}
            className="flex-1 bg-transparent outline-none text-[14px] text-foreground placeholder:text-foreground/45 py-2"
            maxLength={400}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="submit"
            disabled={!input.trim()}
            aria-label={t("ov.companion.sendAria")}
            className="flex-shrink-0 w-9 h-9 rounded-[14px] flex items-center justify-center transition-opacity disabled:opacity-40"
            style={{
              background:
                "linear-gradient(135deg, hsl(42 95% 55%) 0%, hsl(38 100% 50%) 100%)",
              boxShadow:
                "0 6px 14px -4px hsl(42 90% 50% / 0.55), inset 0 1px 0 hsl(48 100% 80% / 0.6)",
            }}
          >
            <Send className="w-4 h-4" style={{ color: "hsl(222 55% 14%)" }} strokeWidth={2.6} />
          </motion.button>
        </form>
      </div>
    </motion.div>
  );
}
