import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, ChevronRight } from "lucide-react";
import { getNextPrayer, formatCountdown } from "@/hooks/usePrayerAlarms";
import { useT } from "@/i18n";
import { type PrayerTime } from "@/plugins/prayer-alarm";

interface Props {
  times: PrayerTime[];
  onOpen: () => void;
}

/** Compact one-line status pill shown AFTER reminders are set up. Quiet,
 *  always-present, taps open the setup sheet to edit. */
export function PrayerBellsPill({ times, onOpen }: Props) {
  const { t } = useT();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const next = getNextPrayer(times, now);
  if (!next) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.985 }}
      onClick={onOpen}
      className="mx-3 mt-3 mb-1 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left"
      style={{
        background: "hsl(var(--glass))",
        border: "1px solid hsl(var(--primary) / 0.18)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: "hsl(var(--primary) / 0.18)" }}
      >
        <Bell className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold leading-tight text-foreground/90 truncate">
          {next.time.label} · {formatTime(next.time)}
        </p>
        <p className="text-[10.5px] text-foreground/50">{t("pr.pill.in", { countdown: formatCountdown(next.at, now) })}</p>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-foreground/40" />
    </motion.button>
  );
}

function formatTime(t: PrayerTime): string {
  const h = t.hour % 12 || 12;
  const m = t.minute.toString().padStart(2, "0");
  const ap = t.hour < 12 ? "AM" : "PM";
  return `${h}:${m} ${ap}`;
}
