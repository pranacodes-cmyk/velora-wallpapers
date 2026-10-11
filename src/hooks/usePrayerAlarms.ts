import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PrayerAlarm, { type PrayerTime, type PrayerAlarmStatus } from "@/plugins/prayer-alarm";

const STORAGE_KEY = "jwbp_prayer_alarms_v1";

export interface PrayerAlarmsConfig {
  enabled: boolean;
  soundEnabled: boolean;
  times: PrayerTime[];
}

export const DEFAULT_TIMES: PrayerTime[] = [
  { hour: 7, minute: 0, label: "Morning Prayer" },
  { hour: 21, minute: 0, label: "Evening Prayer" },
];

const DEFAULT_CONFIG: PrayerAlarmsConfig = {
  enabled: false,
  soundEnabled: true,
  times: DEFAULT_TIMES,
};

function load(): PrayerAlarmsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    const merged: PrayerAlarmsConfig = { ...DEFAULT_CONFIG, ...parsed };
    // One-time migration: legacy 18:00 Evening Prayer → 21:00 to match the
    // current default schedule (9pm bell). Anyone who deliberately customised
    // to a non-18:00 evening time is left untouched.
    let migrated = false;
    if (!merged.soundEnabled) {
      merged.soundEnabled = true;
      migrated = true;
    }
    merged.times = (merged.times || []).map((t) => {
      if (t && t.hour === 18 && t.minute === 0 && /evening/i.test(t.label || "")) {
        migrated = true;
        return { ...t, hour: 21 };
      }
      return t;
    });
    if (migrated) save(merged);
    return merged;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function save(c: PrayerAlarmsConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

export function getNextPrayer(times: PrayerTime[], now = new Date()): { time: PrayerTime; at: Date } | null {
  if (!times.length) return null;
  const today = now;
  const sorted = [...times].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  for (const t of sorted) {
    const at = new Date(today);
    at.setHours(t.hour, t.minute, 0, 0);
    if (at.getTime() > now.getTime()) return { time: t, at };
  }
  // tomorrow's first
  const first = sorted[0];
  const at = new Date(today);
  at.setDate(at.getDate() + 1);
  at.setHours(first.hour, first.minute, 0, 0);
  return { time: first, at };
}

export function formatCountdown(at: Date, now = new Date()): string {
  const diff = Math.max(0, at.getTime() - now.getTime());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

export function usePrayerAlarms() {
  const [config, setConfig] = useState<PrayerAlarmsConfig>(() => load());
  const [status, setStatus] = useState<PrayerAlarmStatus | null>(null);
  const repairKeyRef = useRef<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try { setStatus(await PrayerAlarm.getStatus()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // Restore the original alarm tone on existing schedules, keeping times.
  useEffect(() => {
    const flag = 'prayly:original-alarm-sound-restored';
    if (localStorage.getItem(flag)) return;
    if (!config.enabled) {
      localStorage.setItem(flag, '1');
      return;
    }
    PrayerAlarm.scheduleAll({ times: config.times, soundEnabled: true })
      .then(() => { localStorage.setItem(flag, '1'); return refreshStatus(); })
      .catch(() => { /* Retry on the next mount. */ });
  }, [config.enabled, config.times, refreshStatus]);

  // Self-heal: users can have JS config saying "enabled" while native
  // AlarmManager entries are missing after an app update, force-stop recovery,
  // or a previous failed schedule call. Normal content notifications can still
  // work in that state, but prayer bells will never fire until we re-arm them.
  useEffect(() => {
    if (!config.enabled || !status) return;
    const expected = config.times.length;
    if (!expected || status.scheduledCount >= expected) return;
    const key = JSON.stringify({ times: config.times, sound: config.soundEnabled, scheduled: status.scheduledCount });
    if (repairKeyRef.current === key) return;
    repairKeyRef.current = key;
    PrayerAlarm.scheduleAll({ times: config.times, soundEnabled: config.soundEnabled })
      .then(() => refreshStatus())
      .catch(() => { /* ignore — user can still use the setup sheet */ });
  }, [config.enabled, config.soundEnabled, config.times, refreshStatus, status]);

  // One-shot reschedule for the 18:00 → 21:00 evening-bell migration. Without
  // this the JS state already shows 21:00 but the native AlarmManager still
  // holds the legacy 18:00 PendingIntent until the user toggles settings.
  useEffect(() => {
    try {
      const FLAG = "prayly:evening-bell-21h-migrated";
      if (localStorage.getItem(FLAG)) return;
      localStorage.setItem(FLAG, "1");
      if (!config.enabled) return;
      const hasEvening21 = config.times.some(
        (t) => t.hour === 21 && t.minute === 0 && /evening/i.test(t.label || "")
      );
      if (!hasEvening21) return;
      PrayerAlarm.scheduleAll({ times: config.times, soundEnabled: config.soundEnabled })
        .catch(() => { /* ignore */ });
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = useCallback(async (next: Partial<PrayerAlarmsConfig> = {}) => {
    const merged = { ...config, ...next, enabled: true };
    save(merged);
    setConfig(merged);
    await PrayerAlarm.scheduleAll({ times: merged.times, soundEnabled: merged.soundEnabled });
    await refreshStatus();
  }, [config, refreshStatus]);

  const disable = useCallback(async () => {
    const next = { ...config, enabled: false };
    save(next);
    setConfig(next);
    await PrayerAlarm.cancelAll();
    await refreshStatus();
  }, [config, refreshStatus]);

  const update = useCallback(async (next: Partial<PrayerAlarmsConfig>) => {
    const merged = { ...config, ...next };
    save(merged);
    setConfig(merged);
    if (merged.enabled) {
      await PrayerAlarm.scheduleAll({ times: merged.times, soundEnabled: merged.soundEnabled });
    }
    await refreshStatus();
  }, [config, refreshStatus]);

  const addAlarm = useCallback(async (alarm: PrayerTime) => {
    if (config.times.length >= 8) return;
    await update({ times: [...config.times, alarm] });
  }, [config.times, update]);

  const removeAlarm = useCallback(async (idx: number) => {
    await update({ times: config.times.filter((_, i) => i !== idx) });
  }, [config.times, update]);

  const renameAlarm = useCallback(async (idx: number, label: string) => {
    await update({
      times: config.times.map((t, i) => (i === idx ? { ...t, label } : t)),
    });
  }, [config.times, update]);

  const next = useMemo(() => (config.enabled ? getNextPrayer(config.times) : null), [config]);

  return { config, status, next, enable, disable, update, addAlarm, removeAlarm, renameAlarm, refreshStatus };
}

