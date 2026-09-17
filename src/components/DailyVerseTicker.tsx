import { motion } from "framer-motion";
import { useDailyVerse } from "@/hooks/useDailyVerse";
import { BookOpen, Share2 } from "lucide-react";
import { haptic } from "@/utils/haptics";
import { nativeShare } from "@/utils/nativeShare";
import { useT } from "@/i18n";

export function DailyVerseTicker() {
  const { verse } = useDailyVerse();
  const { t } = useT();

  const handleShare = async () => {
    haptic("soft");
    const text = `"${verse.text}" — ${verse.reference} ✝️`;
    await nativeShare({ text, dialogTitle: t("ov.ticker.shareDialogTitle") });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="flex items-center gap-2 px-3 py-2 mx-3 rounded-2xl overflow-hidden"
      style={{
        background: "hsl(var(--primary) / 0.06)",
        border: "1px solid hsl(var(--primary) / 0.1)",
      }}
    >
      <BookOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" strokeWidth={2} />
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="animate-verse-scroll whitespace-nowrap">
          <span className="text-[11px] font-medium text-foreground/80 italic">
            "{verse.text}"
          </span>
          <span className="text-[10px] font-bold text-primary ml-2">
            — {verse.reference}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); handleShare(); }}
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
        style={{ background: "hsl(var(--primary) / 0.1)" }}
      >
        <Share2 className="w-3 h-3 text-primary" />
      </button>
    </motion.div>
  );
}
