// 75 Days of Light — family & friend circles (web mirror of
// flutter_app/lib/core/services/challenge_circle_service.dart).
//
// No account needed: the device keeps a private random secret; the backend
// stores only its hash. Shared with a circle: display name, emoji avatar and
// progress counts. Reflections stay on the device.
import { supabase } from "@/integrations/supabase/client";
import {
  completedCount, getChallenge, liveStreak, localDate, tasksDoneToday, type ChallengeState,
} from "@/services/challenge";

const IDENTITY_KEY = "prayly_challenge_identity_v1";
const OVERVIEW_KEY = "prayly_challenge_circles_cache_v1";
export const CIRCLE_EVENT = "prayly:circle-change";

export type CircleIdentity = { memberId: string; secret: string; name: string; avatar: string };

export type CircleMember = {
  id: string;
  name: string;
  avatar: string;
  mode: string;
  started: boolean;
  completedDays: number;
  streak: number;
  bestStreak: number;
  litToday: boolean;
  todayDone: number;
  lastLitOn: string | null;
  isMe: boolean;
  sentToday: string[];
  isPro: boolean;
};

export type Circle = {
  id: string;
  code: string;
  name: string;
  emoji: string;
  isOwner: boolean;
  members: CircleMember[];
  litToday: number;
  totalDays: number;
  flame: number;
};

export type Cheer = { id: string; kind: CheerKind; circleId: string; fromName: string; fromAvatar: string; at: string };
export type CheerKind = "cheer" | "pray" | "nudge";
export type CircleOverview = { circles: Circle[]; cheers: Cheer[]; fetchedAt: number };

export const AVATARS = ["🐑", "🕊️", "🦁", "⭐", "🌊", "🌿", "🔥", "🌻", "⛰️", "🌸", "🌙", "☀️"];
export const CIRCLE_EMOJIS = ["🪔", "🏡", "❤️", "⛪", "🙏", "✨", "🌿", "👨‍👩‍👧"];

export class CircleError extends Error {
  constructor(public code: string) { super(code); }
}

/* ── identity ────────────────────────────────────────────────────────────── */

export function getIdentity(): CircleIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as CircleIdentity;
    return v?.memberId && v?.secret ? v : null;
  } catch {
    return null;
  }
}

function saveIdentity(identity: CircleIdentity) {
  try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity)); } catch { /* storage blocked */ }
  emit();
}

function randomSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getCachedOverview(): CircleOverview | null {
  try {
    const raw = localStorage.getItem(OVERVIEW_KEY);
    return raw ? (JSON.parse(raw) as CircleOverview) : null;
  } catch {
    return null;
  }
}

function cacheOverview(o: { circles: Circle[]; cheers: Cheer[] }): CircleOverview {
  const value = { circles: o.circles ?? [], cheers: o.cheers ?? [], fetchedAt: Date.now() };
  try { localStorage.setItem(OVERVIEW_KEY, JSON.stringify(value)); } catch { /* storage blocked */ }
  emit();
  return value;
}

function emit() {
  try { window.dispatchEvent(new CustomEvent(CIRCLE_EVENT)); } catch { /* SSR */ }
}

/* ── transport ───────────────────────────────────────────────────────────── */

async function call<T>(action: string, payload: Record<string, unknown> = {}, auth = true): Promise<T> {
  const identity = auth ? getIdentity() : null;
  if (auth && !identity) throw new CircleError("no_identity");
  const body = {
    action,
    today: localDate(),
    ...(identity ? { memberId: identity.memberId, secret: identity.secret } : {}),
    ...payload,
  };
  const { data, error } = await supabase.functions.invoke("challenge-circle", { body });
  if (error) {
    let code = "network";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") code = ((await ctx.json()) as { error?: string }).error ?? code;
    } catch { /* not JSON */ }
    throw new CircleError(code);
  }
  if (data && typeof data === "object" && "error" in data) throw new CircleError(String((data as { error: string }).error));
  return data as T;
}

export function progressPayload(s: ChallengeState = getChallenge()) {
  const today = localDate();
  return {
    mode: s.mode,
    startedOn: s.startedOn,
    completedDays: completedCount(s),
    currentStreak: liveStreak(s, today),
    bestStreak: s.bestStreak,
    lastLitOn: s.lastLitOn,
    todayOn: today,
    todayDone: tasksDoneToday(s, today).length,
    attempts: s.attempts,
    isPro: (() => { try { return localStorage.getItem("cw_premium_unlocked") === "true"; } catch { return false; } })(),
  };
}

/* ── actions ─────────────────────────────────────────────────────────────── */

export async function ensureIdentity(name: string, avatar: string, lang: string): Promise<CircleIdentity> {
  const existing = getIdentity();
  if (existing) {
    if (existing.name !== name || existing.avatar !== avatar) {
      await call("profile", { name, avatar, lang });
      saveIdentity({ ...existing, name, avatar });
    }
    return { ...existing, name, avatar };
  }
  const secret = randomSecret();
  const res = await call<{ memberId: string }>("register", { secret, name, avatar, lang, progress: progressPayload() }, false);
  const identity = { memberId: res.memberId, secret, name, avatar };
  saveIdentity(identity);
  return identity;
}

export async function fetchOverview(): Promise<CircleOverview> {
  const res = await call<{ circles: Circle[]; cheers: Cheer[] }>("overview");
  return cacheOverview(res);
}

export async function createCircle(name: string, emoji: string): Promise<{ code: string; circleId: string; overview: CircleOverview }> {
  const res = await call<{ code: string; circleId: string; circles: Circle[]; cheers: Cheer[] }>("create_circle", { name, emoji });
  return { code: res.code, circleId: res.circleId, overview: cacheOverview(res) };
}

export async function joinCircle(code: string): Promise<{ circleId: string; overview: CircleOverview }> {
  const res = await call<{ circleId: string; circles: Circle[]; cheers: Cheer[] }>("join_circle", { code });
  return { circleId: res.circleId, overview: cacheOverview(res) };
}

export async function leaveCircle(circleId: string): Promise<CircleOverview> {
  return cacheOverview(await call("leave_circle", { circleId }));
}

export async function renameCircle(circleId: string, name: string, emoji: string): Promise<CircleOverview> {
  return cacheOverview(await call("rename_circle", { circleId, name, emoji }));
}

export async function sendCheer(circleId: string, toMember: string, kind: CheerKind) {
  return call<{ ok: boolean; alreadySent: boolean }>("cheer", { circleId, toMember, kind });
}

export async function markCheersSeen(ids: string[]) {
  if (!ids.length) return;
  await call("seen", { ids });
  const cached = getCachedOverview();
  if (cached) cacheOverview({ ...cached, cheers: cached.cheers.filter((c) => !ids.includes(c.id)) });
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Push local progress to the backend (debounced, silent on failure). */
export function scheduleProgressSync(delay = 1200) {
  if (!getIdentity()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    call("sync", { progress: progressPayload() }).catch(() => { /* offline — next change retries */ });
  }, delay);
}

export function inviteText(circleName: string, code: string, t: (k: string, v?: Record<string, string | number>) => string) {
  return t("ch.invite.share", { name: circleName, code });
}

/** Personal 6-character invite code shown in the one-tap invite share. */
export function myInviteCode(): string {
  const KEY = "prayly_invite_code_v1";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const src = (getIdentity()?.memberId || crypto.randomUUID()).replace(/[^a-z0-9]/gi, "").toUpperCase();
    const code = src.slice(0, 6).padEnd(6, "7");
    localStorage.setItem(KEY, code);
    return code;
  } catch {
    return "PRAYLY";
  }
}

/* ── Journey buddies ─────────────────────────────────────────────────────── */
// Each person owns one private "walk" circle; its code is their buddy code.
// Everyone in any circle with me appears as a buddy.

const BUDDY_CODE_KEY = "prayly_buddy_code_v1";
const PENDING_BUDDY_KEY = "prayly_pending_buddy_v1";

export type Buddy = CircleMember & { circleId: string };

export function buddiesOf(o: CircleOverview | null): Buddy[] {
  const seen = new Map<string, Buddy>();
  for (const c of o?.circles ?? []) for (const m of c.members) {
    if (!m.isMe && !seen.has(m.id)) seen.set(m.id, { ...m, circleId: c.id });
  }
  return [...seen.values()].sort((a, b) => b.completedDays - a.completedDays);
}

export async function myBuddyCode(): Promise<string> {
  try { const saved = localStorage.getItem(BUDDY_CODE_KEY); if (saved) return saved; } catch { /* blocked */ }
  const o = getCachedOverview() ?? (await fetchOverview().catch(() => null));
  const own = o?.circles.find((c) => c.isOwner);
  const code = own?.code ?? (await createCircle("Journey", "🐑")).code;
  try { localStorage.setItem(BUDDY_CODE_KEY, code); } catch { /* blocked */ }
  return code;
}

export function setPendingBuddy(code: string) {
  try { localStorage.setItem(PENDING_BUDDY_KEY, code.toUpperCase()); } catch { /* blocked */ }
}
export function takePendingBuddy(): string | null {
  try { const v = localStorage.getItem(PENDING_BUDDY_KEY); localStorage.removeItem(PENDING_BUDDY_KEY); return v; } catch { return null; }
}
