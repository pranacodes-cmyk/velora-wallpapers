import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Pencil } from "lucide-react";

import { usePrayerAlarms } from "@/hooks/usePrayerAlarms";
import type { PrayerTime } from "@/plugins/prayer-alarm";
import { toast } from "sonner";
import { track } from "@/services/analytics";
import { useT } from "@/i18n";

type Slot = "morning" | "evening";

const LABELS: Record<Slot, string> = {
  morning: "Morning Prayer",
  evening: "Evening Prayer",
};
const DEFAULTS: Record<Slot, { hour: number; minute: number }> = {
  morning: { hour: 7, minute: 0 },
  evening: { hour: 21, minute: 0 },
};

/** User-chosen times survive turning a bell off and back on. */
const CUSTOM_KEY = "prayly_alarm_custom_times_v1";

function loadCustom(): Partial<Record<Slot, { hour: number; minute: number }>> {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveCustom(next: Partial<Record<Slot, { hour: number; minute: number }>>) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function fmt(t: { hour: number; minute: number }) {
  const h12 = ((t.hour + 11) % 12) + 1;
  const ampm = t.hour >= 12 ? "PM" : "AM";
  const mm = String(t.minute).padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}
function toInputValue(t: { hour: number; minute: number }) {
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

/**
 * Compact Today-page card. Two prayer bells the user opts INTO with a tap,
 * each with an editable time (tap the pencil / the time to change it).
 */
export function PrayerAlarmToggles() {
  const { t } = useT();
  const { config, enable, disable, update } = usePrayerAlarms();
  const [custom, setCustom] = useState(() => loadCustom());
  const displayLabel = (slot: Slot) =>
    slot === "morning" ? t("prayer.slot.morning") : t("prayer.slot.evening");

  /** Scheduled entry for a slot, matched by its label. */
  const scheduled = useMemo(() => {
    const find = (slot: Slot) =>
      config.times.find((t) => (t.label || "").toLowerCase() === LABELS[slot].toLowerCase());
    return { morning: find("morning"), evening: find("evening") };
  }, [config.times]);

  const isOn = (slot: Slot) => config.enabled && !!scheduled[slot];

  /** While a bell is OFF the user's freshly picked time must win over the
   *  stale scheduled entry left in config — otherwise the row snaps back to
   *  the old default right after the picker closes. */
  const timeFor = (slot: Slot) =>
    isOn(slot)
      ? scheduled[slot] ?? custom[slot] ?? DEFAULTS[slot]
      : custom[slot] ?? scheduled[slot] ?? DEFAULTS[slot];

  const applyTimes = async (next: PrayerTime[]) => {
    try {
      if (next.length === 0) {
        await disable();
      } else if (!config.enabled) {
        await enable({ times: next, soundEnabled: true });
      } else {
        await update({ times: next, soundEnabled: true });
      }
    } catch {
      toast.error(t("prayer.toast.updateError"));
    }
  };

  /** Everything except this slot's entry, order preserved. */
  const othersOf = (slot: Slot) =>
    config.times.filter((t) => (t.label || "").toLowerCase() !== LABELS[slot].toLowerCase());

  const toggle = async (slot: Slot, on: boolean) => {
    const tm = timeFor(slot);
    const entry: PrayerTime = { hour: tm.hour, minute: tm.minute, label: LABELS[slot] };
    const others = othersOf(slot);
    const next = on ? (slot === "morning" ? [entry, ...others] : [...others, entry]) : others;
    track("prayer_alarm_toggle", { slot, on, hour: tm.hour, minute: tm.minute });
    if (on) toast.success(t("prayer.toast.bellOn", { slot: displayLabel(slot), time: fmt(tm) }));
    await applyTimes(next);
  };

  const changeTime = async (slot: Slot, value: string) => {
    const [h, m] = value.split(":").map((n) => parseInt(n, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    const picked = { hour: Math.min(23, Math.max(0, h)), minute: Math.min(59, Math.max(0, m)) };

    const nextCustom = { ...custom, [slot]: picked };
    setCustom(nextCustom);
    saveCustom(nextCustom);
    track("prayer_alarm_time_edit", { slot, hour: picked.hour, minute: picked.minute });

    // Picking a time is an explicit "I want this bell" — standard clock-app
    // behaviour. A bell that was OFF turns itself ON so the promised toast is
    // always true (before, the toast claimed a time that was never armed).
    const wasOn = isOn(slot);
    const entry: PrayerTime = { ...picked, label: LABELS[slot] };
    const others = othersOf(slot);
    const next = slot === "morning" ? [entry, ...others] : [...others, entry];
    await applyTimes(next);
    toast.success(
      wasOn
        ? t("prayer.toast.timeMoved", { label: displayLabel(slot), time: fmt(picked) })
        : t("prayer.toast.bellOn", { slot: displayLabel(slot), time: fmt(picked) }),
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mx-3 mt-3 mb-2 rounded-3xl overflow-hidden"
      style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--glass-border))",
        boxShadow: "0 6px 20px -14px hsl(222 40% 20% / 0.28)",
      }}
      aria-label={t("prayer.ariaSection")}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-lg"
          style={{ background: "hsl(var(--primary) / 0.18)", color: "hsl(var(--primary))" }}
          aria-hidden
        >
          <Bell className="w-3.5 h-3.5" strokeWidth={2.4} />
        </span>
        <h3 className="text-[11px] font-black tracking-[0.22em] uppercase text-primary/85">
          {t("prayer.header")} <span aria-hidden>⏰</span>
        </h3>
      </div>

      <p className="px-4 text-[11.5px] text-foreground/55 leading-snug -mt-0.5 mb-1">
        {t("prayer.subtitle")}
      </p>

      <ul className="px-2 pb-2">
        <AlarmRow
          slot="morning"
          time={timeFor("morning")}
          label={displayLabel("morning")}
          on={isOn("morning")}
          onToggle={(on) => toggle("morning", on)}
          onTimeChange={(v) => changeTime("morning", v)}
        />
        <div className="mx-4 h-px" style={{ background: "hsl(var(--glass-border))" }} />
        <AlarmRow
          slot="evening"
          time={timeFor("evening")}
          label={displayLabel("evening")}
          on={isOn("evening")}
          onToggle={(on) => toggle("evening", on)}
          onTimeChange={(v) => changeTime("evening", v)}
        />
      </ul>
    </motion.section>
  );
}

function AlarmRow({
  slot,
  time,
  label,
  on,
  onToggle,
  onTimeChange,
}: {
  slot: Slot;
  time: { hour: number; minute: number };
  label: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  onTimeChange: (value: string) => void;
}) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    // showPicker() is the reliable path in modern Chromium / Android WebView.
    const anyEl = el as HTMLInputElement & { showPicker?: () => void };
    if (typeof anyEl.showPicker === "function") {
      try {
        anyEl.showPicker();
        return;
      } catch {
        /* fall through to focus/click */
      }
    }
    el.focus();
    el.click();
  };

  return (
    <li className="flex items-center justify-between gap-2 px-2 py-2.5">
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={openPicker}
          aria-label={t("prayer.ariaChangeTime", { label })}
          className="-mx-1 flex items-center gap-1.5 px-1 py-1 text-left active:scale-[0.99] transition-transform"
        >
          <span className="text-[15px] font-extrabold text-foreground tracking-tight">
            {fmt(time)}
          </span>
          <Pencil className="w-3 h-3 text-primary/70" strokeWidth={2.6} aria-hidden />
          {on && (
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-primary ml-0.5">
              {t("prayer.on")}
            </span>
          )}
        </button>
        <div className="text-[11px] text-foreground/55 mt-0.5 px-0.5">{label}</div>

        {/* Native time picker — visually hidden but focusable/clickable. */}
        <input
          ref={inputRef}
          type="time"
          value={toInputValue(time)}
          onChange={(e) => onTimeChange(e.target.value)}
          aria-label={t("prayer.ariaTimeInput", { label })}
          tabIndex={-1}
          className="absolute left-2 bottom-0 w-px h-px opacity-0"
          id={`prayer-alarm-time-${slot}`}
        />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t("prayer.ariaToggle", { label })}
        onClick={() => onToggle(!on)}
        className="relative shrink-0 w-[42px] h-[24px] rounded-full transition-colors overflow-hidden"
        style={{
          background: on ? "hsl(var(--primary))" : "hsl(var(--glass-border))",
          boxShadow: on
            ? "0 0 0 1px hsl(var(--primary) / 0.5), 0 4px 14px -4px hsl(var(--primary) / 0.55)"
            : "inset 0 0 0 1px hsl(var(--glass-border))",
        }}
      >
        <span
          className="absolute left-0 top-[2px] w-[20px] h-[20px] rounded-full bg-primary-foreground transition-transform"
          style={{ transform: on ? "translateX(20px)" : "translateX(2px)" }}
        />
      </button>
    </li>
  );
}

export default PrayerAlarmToggles;
