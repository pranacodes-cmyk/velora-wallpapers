import { Flame, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { forwardRef, useEffect, useState } from "react";
import { useT } from "@/i18n";

function getTodayCount(): number {
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return (seed % 12) + 3;
}

function getTodayKey(): string {
  const now = new Date();
  return `velora.banner.dismissed.${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export const NewTodayBanner = forwardRef<HTMLDivElement>(function NewTodayBanner(_props, ref) {
  const { t } = useT();
  const count = getTodayCount();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(getTodayKey()) === "1";
    if (dismissed) return;
    setVisible(true);
    const t = setTimeout(() => handleDismiss(), 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(getTodayKey(), "1");
    } catch {}
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.3 }}
          className="mx-3 mb-3 overflow-hidden"
        >
          <div
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.06))",
              border: "1px solid hsl(var(--primary) / 0.1)",
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "hsl(var(--primary) / 0.12)" }}
            >
              <Flame className="w-3.5 h-3.5 text-primary" strokeWidth={2.2} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground/80 leading-tight">
                {t("ov.banner.count", { count })}
              </p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">
                {t("ov.banner.subtitle")}
              </p>
            </div>

            <span
              className="text-[8px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: "hsl(var(--primary) / 0.1)",
                color: "hsl(var(--primary))",
              }}
            >
              {t("ov.banner.new")}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              aria-label={t("ov.banner.dismissAria")}
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-foreground/10 active:bg-foreground/15"
            >
              <X className="w-3.5 h-3.5 text-foreground/55" strokeWidth={2.2} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
