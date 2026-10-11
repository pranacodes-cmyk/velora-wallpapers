import { motion } from "framer-motion";
import { Bell, ChevronRight, Star } from "lucide-react";
import { useT } from "@/i18n";

interface Props {
  onOpen: () => void;
}

/** Shown on the Daily tab BEFORE the user has set up prayer reminders. Big,
 *  beautiful, one-tap entry into the setup sheet. */
export function PrayerBellsHero({ onOpen }: Props) {
  const { t } = useT();
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      whileTap={{ scale: 0.985 }}
      onClick={onOpen}
      className="relative mx-3 mt-3 mb-2 w-[calc(100%-1.5rem)] overflow-hidden rounded-3xl text-left"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--primary) / 0.14) 0%, hsl(var(--accent) / 0.10) 60%, hsl(var(--background)) 100%)",
        border: "1px solid hsl(var(--primary) / 0.28)",
        boxShadow:
          "0 10px 40px -12px hsl(var(--primary) / 0.35), inset 0 1px 0 hsl(var(--primary) / 0.15)",
      }}
    >
      {/* Subtle glow */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-50"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 70%)" }}
      />

      <div className="relative flex items-center gap-4 px-4 py-4">
        <motion.div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary) / 0.95), hsl(var(--primary) / 0.75))",
            boxShadow: "0 6px 20px -4px hsl(var(--primary) / 0.5)",
          }}
        >
          <Bell className="h-5 w-5" strokeWidth={2.4} style={{ color: "hsl(var(--primary-foreground))" }} />
        </motion.div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Star className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">
              {t("pr.hero.badge")}
            </span>
          </div>
          <p className="mt-1 text-[15px] font-bold leading-tight text-foreground">
            {t("pr.hero.title")}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-foreground/55">
            {t("pr.hero.subtitle")}
          </p>
        </div>

        <ChevronRight className="h-5 w-5 flex-shrink-0 text-foreground/40" strokeWidth={2.2} />
      </div>
    </motion.button>
  );
}
