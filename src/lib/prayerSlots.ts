/**
 * Per-slot prayer tracking. A "slot" is either "morning" or "evening".
 * - opened: the user has actually viewed the prayer in the Devotional page
 * - unlocked: the user has paid (rewarded ad) to early-unlock a future slot
 *
 * Both are scoped to the current day (YYYY-MM-DD) and auto-reset at midnight.
 */
export type PrayerSlot = "morning" | "evening";

export const EVENING_UNLOCK_HOUR = 18;

const OPEN_KEY = "cw_prayer_slot_opened";
const UNLOCK_KEY = "cw_prayer_slot_unlocked";
export const PRAYER_SLOT_EVENT = "cw_prayer_slot_changed";

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function read(key: string): Set<PrayerSlot> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (parsed?.date !== todayKey()) return new Set();
    return new Set(parsed.slots || []);
  } catch {
    return new Set();
  }
}

function write(key: string, slots: Set<PrayerSlot>) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ date: todayKey(), slots: Array.from(slots) })
    );
    window.dispatchEvent(new Event(PRAYER_SLOT_EVENT));
  } catch {}
}

export function getCurrentSlot(now = new Date()): PrayerSlot {
  return now.getHours() >= EVENING_UNLOCK_HOUR ? "evening" : "morning";
}

export function getOtherSlot(slot: PrayerSlot): PrayerSlot {
  return slot === "morning" ? "evening" : "morning";
}

/** Is this slot at-or-past its natural unlock time today? */
export function isSlotAtTime(slot: PrayerSlot, now = new Date()): boolean {
  if (slot === "morning") return true;
  return now.getHours() >= EVENING_UNLOCK_HOUR;
}

export function isOpened(slot: PrayerSlot): boolean {
  return read(OPEN_KEY).has(slot);
}

export function markOpened(slot: PrayerSlot) {
  const s = read(OPEN_KEY);
  if (!s.has(slot)) {
    s.add(slot);
    write(OPEN_KEY, s);
  }
  // Back-compat: legacy "prayers opened today" flag drives the Today checklist.
  try {
    localStorage.setItem(
      "cw_prayers_unlocked",
      JSON.stringify({ date: todayKey() })
    );
    window.dispatchEvent(new Event("cw_today_tasks_changed"));
  } catch {}
}

export function isUnlocked(slot: PrayerSlot): boolean {
  // Only the slot for the CURRENT part of the day is freely unlocked.
  // The "other" slot (morning when it's evening, or evening when it's morning)
  // always requires an explicit reveal (rewarded ad) — even if its natural
  // time has already passed earlier in the day. This prevents users from
  // scrolling to a second prayer for free in the evening.
  if (slot === getCurrentSlot()) return true;
  // If they already opened it earlier today, keep it unlocked.
  if (read(OPEN_KEY).has(slot)) return true;
  return read(UNLOCK_KEY).has(slot);
}

export function markUnlocked(slot: PrayerSlot) {
  const s = read(UNLOCK_KEY);
  if (s.has(slot)) return;
  s.add(slot);
  write(UNLOCK_KEY, s);
}
