/**
 * Lightweight user profile captured during onboarding.
 * Drives personalization on the Today tab.
 */

export type UserFocus =
  | "anxiety"
  | "gratitude"
  | "strength"
  | "healing"
  | "doubt"
  | "closer";

export type UserTime = "morning" | "evening" | "both";

const FOCUS_KEY = "cw_user_focus";
const TIME_KEY = "cw_user_time";
const NAME_KEY = "cw_user_name";
const UNLOCKED_JOURNEYS_KEY = "cw_unlocked_journeys"; // premium journeys granted free via onboarding focus

export const USER_PROFILE_EVENT = "cw-user-profile-changed";

function emitChange() {
  try { window.dispatchEvent(new Event(USER_PROFILE_EVENT)); } catch {}
}

export function setUserFocus(focus: UserFocus) {
  try {
    localStorage.setItem(FOCUS_KEY, focus);
    // Free-unlock the journey that best matches the user's onboarding focus.
    // If that journey is already free, this is a harmless no-op.
    addUnlockedJourney(focusToJourneyId(focus));
    emitChange();
  } catch {}
}
export function getUserFocus(): UserFocus | null {
  try { return (localStorage.getItem(FOCUS_KEY) as UserFocus) || null; } catch { return null; }
}
export function setUserTime(time: UserTime) {
  try { localStorage.setItem(TIME_KEY, time); emitChange(); } catch {}
}
export function getUserTime(): UserTime | null {
  try { return (localStorage.getItem(TIME_KEY) as UserTime) || null; } catch { return null; }
}
export function setUserName(name: string) {
  try { localStorage.setItem(NAME_KEY, name.trim()); emitChange(); } catch {}
}
export function getUserName(): string | null {
  try { return (localStorage.getItem(NAME_KEY) || "").trim() || null; } catch { return null; }
}


/** Premium journeys unlocked for free based on onboarding focus. */
export function getUnlockedJourneys(): string[] {
  try {
    const raw = localStorage.getItem(UNLOCKED_JOURNEYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addUnlockedJourney(journeyId: string) {
  try {
    const cur = getUnlockedJourneys();
    if (cur.includes(journeyId)) return;
    cur.push(journeyId);
    localStorage.setItem(UNLOCKED_JOURNEYS_KEY, JSON.stringify(cur));
    emitChange();
  } catch { /* noop */ }
}

/** True if the user can enter this journey without Premium — either it's
 *  already a free journey in the data, or they earned it via onboarding. */
export function isJourneyFreeForUser(
  journey: { id: string; isPremium?: boolean },
): boolean {
  if (!journey.isPremium) return true;
  return getUnlockedJourneys().includes(journey.id);
}
/** Map a chosen focus to the best-fit journey id in src/data/journeys.ts */
export function focusToJourneyId(focus: UserFocus | null): string {
  switch (focus) {
    case "anxiety":   return "anxiety-peace";
    case "strength":  return "strength-hard-times";
    case "healing":   return "healing";
    case "gratitude": return "gratitude-joy";
    case "doubt":     return "building-faith";
    case "closer":    return "purpose-calling";
    default:          return "anxiety-peace";
  }
}


/** Friendly meta about each focus for UI copy. */
export const FOCUS_META: Record<UserFocus, { label: string; emoji: string; line: string }> = {
  anxiety:   { label: "Peace",     emoji: "🌊", line: "Quieting an anxious mind" },
  gratitude: { label: "Gratitude", emoji: "🌅", line: "A heart that gives thanks" },
  strength:  { label: "Strength",  emoji: "🛡️", line: "Courage for what's ahead" },
  healing:   { label: "Healing",   emoji: "🌿", line: "Mending a heavy heart" },
  doubt:     { label: "Faith",     emoji: "🕊️", line: "Rebuilding belief, gently" },
  closer:    { label: "Closer",    emoji: "✝️", line: "A deeper walk with God" },
};
