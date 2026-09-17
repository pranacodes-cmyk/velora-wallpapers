import { motion } from "framer-motion";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { usePrayerAlarms, DEFAULT_TIMES } from "@/hooks/usePrayerAlarms";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";

/**
 * Pro/Trial-only quick toggle to silence or restore prayer bells in one tap.
 * Sits above the prayer section on the Today page.
 */
export function ProPrayerToggle() {
  const { t } = useT();
  const { config, enable, disable } = usePrayerAlarms();
  const enabled = config.enabled;

  const handleToggle = async () => {
    haptic("soft");
    try {
      if (enabled) {
        await disable();
        toast.success(t("prayer.toggle.pausedTitle"), {
          description: t("prayer.toggle.pausedDesc"),
        });
      } else {
        const times = config.times?.length ? config.times : DEFAULT_TIMES;
        await enable({ times, soundEnabled: config.soundEnabled ?? true });
        toast.success(t("prayer.toggle.onTitle"), {
          description: t("prayer.toggle.onDesc"),
        });
      }
    } catch {
      toast.error(t("prayer.toggle.error"));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 mt-3 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl px-3.5 py-2.5"
      style={{
        background: "hsl(var(--glass))",
        border: "1px solid hsl(var(--primary) / 0.22)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
        style={{
          background: enabled
            ? "hsl(var(--primary) / 0.18)"
            : "hsl(var(--foreground) / 0.08)",
        }}
      >
        {enabled ? (
          <Bell className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
        ) : (
          <BellOff className="h-3.5 w-3.5 text-foreground/60" strokeWidth={2.5} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] font-bold leading-tight text-foreground/90">
            {t("prayer.toggle.label")}
          </p>
          <span
            className="px-1.5 py-px rounded-full text-[8.5px] font-extrabold uppercase tracking-wider"
            style={{
              background: "hsl(var(--primary) / 0.18)",
              color: "hsl(var(--primary))",
            }}
          >
            {t("today.badge.pro")}
          </span>
        </div>
        <p className="text-[10.5px] text-foreground/55 mt-0.5">
          {enabled ? t("prayer.toggle.ringing") : t("prayer.toggle.silenced")}
        </p>
      </div>

      {/* iOS-style toggle */}
      <button
        onClick={handleToggle}
        role="switch"
        aria-checked={enabled}
        aria-label={enabled ? t("prayer.toggle.ariaOff") : t("prayer.toggle.ariaOn")}
        className="relative h-[26px] w-[44px] flex-shrink-0 rounded-full transition-colors"
        style={{
          background: enabled
            ? "hsl(var(--primary))"
            : "hsl(var(--foreground) / 0.18)",
        }}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="absolute top-[2px] h-[22px] w-[22px] rounded-full bg-white shadow-md"
          style={{ left: enabled ? 20 : 2 }}
        />
      </button>
    </motion.div>
  );
}
