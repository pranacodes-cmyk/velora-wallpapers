// 75 Days of Light reminders for the Capacitor build (Flutter uses the native
// ChallengeReminderScheduler). State-aware: evening and night reminders are
// only scheduled for days that are not lit yet.
import { Capacitor } from "@capacitor/core";
import { challengeDay } from "@/data/challenge75";
import {
  addDays, currentDay, getChallenge, litToday, localDate, type ChallengeState,
} from "@/services/challenge";

const BASE_ID = 7500;
const DAYS_AHEAD = 3;
const MORNING = [7, 0] as const;
const NIGHT = [21, 0] as const;

type Translate = (k: string, v?: Record<string, string | number>) => string;

function at(date: string, h: number, m: number) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

export async function requestChallengeNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const res = await LocalNotifications.requestPermissions();
    return res.display === "granted";
  } catch {
    return false;
  }
}

export async function syncChallengeReminders(t: Translate, state: ChallengeState = getChallenge()) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const ids = Array.from({ length: DAYS_AHEAD * 3 }, (_, i) => ({ id: BASE_ID + i }));
    await LocalNotifications.cancel({ notifications: ids });
    if (state.status !== "active") return;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;

    const today = localDate();
    const lit = litToday(state, today);
    const pending = lit ? currentDay(state, today) + 1 : currentDay(state, today);
    const now = Date.now();
    const out: { id: number; title: string; body: string; schedule: { at: Date; allowWhileIdle: boolean }; extra: { route: string } }[] = [];

    for (let i = 0; i < DAYS_AHEAD; i++) {
      const date = addDays(today, i);
      // Days after today assume the pending day is still waiting.
      const day = i === 0 ? pending : pending + (lit ? i - 1 : 0);
      if (day > 75) break;
      const morning = at(date, MORNING[0], MORNING[1]);
      if (morning.getTime() > now && !(i === 0 && lit)) {
        out.push({
          id: BASE_ID + i * 3,
          title: t("ch.notif.morning.title", { day }),
          body: t("ch.notif.morning.body", { title: challengeDay(day).title }),
          schedule: { at: morning, allowWhileIdle: true },
          extra: { route: "/challenge" },
        });
      }
      if (i === 0 && lit) continue;
      const night = at(date, NIGHT[0], NIGHT[1]);
      if (night.getTime() > now) {
        out.push({
          id: BASE_ID + i * 3 + 1,
          title: t("ch.notif.night.title"),
          body: state.mode === "covenant" ? t("ch.notif.night.covenant", { day }) : t("ch.notif.night.body", { day }),
          schedule: { at: night, allowWhileIdle: true },
          extra: { route: "/challenge/day" },
        });
      }
    }
    if (out.length) await LocalNotifications.schedule({ notifications: out });
  } catch {
    /* notifications unavailable */
  }
}
