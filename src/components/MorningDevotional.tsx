import { motion } from "framer-motion";
import { getDailyPrayer } from "@/data/dailyVerses";
import { Sun } from "lucide-react";
import { useT } from "@/i18n";

export function MorningDevotional() {
  const { t } = useT();
  const prayer = getDailyPrayer();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("ov.greeting.morning") : hour < 17 ? t("ov.greeting.afternoon") : t("ov.greeting.evening");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="mx-3 rounded-2xl p-3.5 overflow-hidden relative"
      style={{
        background: "linear-gradient(135deg, hsl(var(--accent) / 0.08), hsl(var(--primary) / 0.06))",
        border: "1px solid hsl(var(--accent) / 0.1)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            background: "linear-gradient(135deg, hsl(var(--accent) / 0.15), hsl(var(--primary) / 0.1))",
          }}
        >
          <Sun className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider">{greeting}</p>
          <p className="text-[12px] text-foreground/70 mt-1 leading-relaxed">{prayer}</p>
        </div>
      </div>
    </motion.div>
  );
}
