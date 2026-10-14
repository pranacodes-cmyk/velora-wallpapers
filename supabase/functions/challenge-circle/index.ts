// 75 Days of Light — family & friend circles.
//
// No sign-up: each device creates a private identity (random 32-byte secret,
// only its SHA-256 hash is stored). Every request proves ownership with the
// secret, and all tables are service-role only, so nobody can read another
// person's identity or circles they do not belong to. Only a display name,
// an emoji and progress counts are ever shared — reflections never leave the
// device.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_CIRCLES_PER_MEMBER = 6;
const MAX_MEMBERS_PER_CIRCLE = 30;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const CHEER_KINDS = new Set(["cheer", "pray", "nudge"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Strip control characters / excessive whitespace and clamp length. */
function cleanText(value: unknown, max: number, fallback: string) {
  if (typeof value !== "string") return fallback;
  // deno-lint-ignore no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, "").replace(/\s+/g, " ").trim();
  const chars = Array.from(cleaned).slice(0, max).join("");
  return chars.length ? chars : fallback;
}

function cleanEmoji(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const chars = Array.from(value.trim()).slice(0, 4).join("");
  return chars.length ? chars : fallback;
}

function cleanDate(value: unknown): string | null {
  return typeof value === "string" && DATE_RE.test(value) ? value : null;
}

function clampInt(value: unknown, min: number, max: number) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Member = {
  id: string;
  display_name: string;
  avatar: string;
  mode: string;
  started_on: string | null;
  completed_days: number;
  current_streak: number;
  best_streak: number;
  last_lit_on: string | null;
  today_on: string | null;
  today_done: number;
  attempts: number;
  updated_at: string;
};

const MEMBER_COLUMNS =
  "id, display_name, avatar, mode, started_on, completed_days, current_streak, best_streak, last_lit_on, today_on, today_done, attempts, updated_at";

async function authenticate(body: Record<string, unknown>): Promise<Member> {
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const secret = typeof body.secret === "string" ? body.secret : "";
  if (!/^[0-9a-f-]{36}$/i.test(memberId) || !/^[0-9a-f]{64}$/i.test(secret)) {
    throw new HttpError(401, "unauthorized");
  }
  const hash = await sha256(secret);
  const { data, error } = await db
    .from("challenge_members")
    .select(MEMBER_COLUMNS + ", secret_hash")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new HttpError(500, "lookup_failed");
  if (!data || (data as { secret_hash: string }).secret_hash !== hash) throw new HttpError(401, "unauthorized");
  const { secret_hash: _ignored, ...member } = data as Member & { secret_hash: string };
  return member;
}

function progressPatch(progress: Record<string, unknown> | undefined) {
  if (!progress || typeof progress !== "object") return {};
  const patch: Record<string, unknown> = {};
  if (progress.mode === "grace" || progress.mode === "covenant") patch.mode = progress.mode;
  if ("startedOn" in progress) patch.started_on = cleanDate(progress.startedOn);
  if ("completedDays" in progress) patch.completed_days = clampInt(progress.completedDays, 0, 75);
  if ("currentStreak" in progress) patch.current_streak = clampInt(progress.currentStreak, 0, 10000);
  if ("bestStreak" in progress) patch.best_streak = clampInt(progress.bestStreak, 0, 10000);
  if ("lastLitOn" in progress) patch.last_lit_on = cleanDate(progress.lastLitOn);
  if ("todayOn" in progress) patch.today_on = cleanDate(progress.todayOn);
  if ("todayDone" in progress) patch.today_done = clampInt(progress.todayDone, 0, 4);
  if ("attempts" in progress) patch.attempts = clampInt(progress.attempts, 1, 1000);
  return patch;
}

function publicMember(m: Member, viewerToday: string, meId: string) {
  // Members live in different time zones: "lit today" means their last lit
  // day matches the most recent day they synced, and that day is current.
  const recent = m.today_on !== null && m.today_on >= addDays(viewerToday, -1);
  const litToday = recent && m.last_lit_on !== null && m.last_lit_on === m.today_on;
  const streakAlive = m.last_lit_on !== null && m.last_lit_on >= addDays(viewerToday, -1);
  return {
    id: m.id,
    name: m.display_name,
    avatar: m.avatar,
    mode: m.mode,
    started: m.started_on !== null,
    completedDays: m.completed_days,
    streak: streakAlive ? m.current_streak : 0,
    bestStreak: m.best_streak,
    litToday,
    todayDone: recent ? (litToday ? 4 : m.today_done) : 0,
    lastLitOn: m.last_lit_on,
    isMe: m.id === meId,
  };
}

async function overview(me: Member, viewerToday: string) {
  const { data: links, error: linkError } = await db
    .from("challenge_circle_members")
    .select("circle_id, joined_at")
    .eq("member_id", me.id)
    .order("joined_at", { ascending: true });
  if (linkError) throw new HttpError(500, "lookup_failed");
  const circleIds = (links ?? []).map((l) => l.circle_id as string);

  let circles: unknown[] = [];
  if (circleIds.length) {
    const [{ data: circleRows }, { data: memberLinks }] = await Promise.all([
      db.from("challenge_circles").select("id, code, name, emoji, created_by, created_at").in("id", circleIds),
      db.from("challenge_circle_members").select("circle_id, member_id, joined_at").in("circle_id", circleIds),
    ]);
    const memberIds = Array.from(new Set((memberLinks ?? []).map((l) => l.member_id as string)));
    const { data: memberRows } = memberIds.length
      ? await db.from("challenge_members").select(MEMBER_COLUMNS).in("id", memberIds)
      : { data: [] as Member[] };
    const byId = new Map((memberRows as Member[] | null ?? []).map((m) => [m.id, m]));

    // Cheers I already sent today, so the UI can show them as sent.
    const { data: sentRows } = await db
      .from("challenge_cheers")
      .select("to_member, kind")
      .eq("from_member", me.id)
      .gte("sent_on", addDays(viewerToday, -1));
    const sent = new Map<string, string[]>();
    for (const row of sentRows ?? []) {
      const list = sent.get(row.to_member as string) ?? [];
      list.push(row.kind as string);
      sent.set(row.to_member as string, list);
    }

    const order = new Map(circleIds.map((id, i) => [id, i]));
    circles = (circleRows ?? [])
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((c) => {
        const members = (memberLinks ?? [])
          .filter((l) => l.circle_id === c.id)
          .map((l) => byId.get(l.member_id as string))
          .filter((m): m is Member => Boolean(m))
          .map((m) => ({ ...publicMember(m, viewerToday, me.id), sentToday: sent.get(m.id) ?? [] }))
          .sort((a, b) => b.completedDays - a.completedDays || b.streak - a.streak || a.name.localeCompare(b.name));
        const litToday = members.filter((m) => m.litToday).length;
        const totalDays = members.reduce((sum, m) => sum + m.completedDays, 0);
        return {
          id: c.id,
          code: c.code,
          name: c.name,
          emoji: c.emoji,
          isOwner: c.created_by === me.id,
          members,
          litToday,
          totalDays,
          flame: members.length ? totalDays / (members.length * 75) : 0,
        };
      });
  }

  const { data: cheerRows } = await db
    .from("challenge_cheers")
    .select("id, kind, from_member, circle_id, created_at")
    .eq("to_member", me.id)
    .is("seen_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  let cheers: unknown[] = [];
  if (cheerRows?.length) {
    const fromIds = Array.from(new Set(cheerRows.map((r) => r.from_member as string)));
    const { data: fromRows } = await db.from("challenge_members").select("id, display_name, avatar").in("id", fromIds);
    const names = new Map((fromRows ?? []).map((r) => [r.id as string, r]));
    cheers = cheerRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      circleId: r.circle_id,
      fromName: (names.get(r.from_member as string)?.display_name as string) ?? "Friend",
      fromAvatar: (names.get(r.from_member as string)?.avatar as string) ?? "🕊️",
      at: r.created_at,
    }));
  }

  return {
    me: { ...publicMember(me, viewerToday, me.id), name: me.display_name, avatar: me.avatar },
    circles,
    cheers,
  };
}

async function requireMembership(circleId: string, memberId: string) {
  const { data } = await db
    .from("challenge_circle_members")
    .select("circle_id")
    .eq("circle_id", circleId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (!data) throw new HttpError(403, "not_member");
}

async function handle(body: Record<string, unknown>) {
  const action = body.action;
  const today = cleanDate(body.today) ?? new Date().toISOString().slice(0, 10);

  if (action === "register") {
    const secret = typeof body.secret === "string" ? body.secret : "";
    if (!/^[0-9a-f]{64}$/i.test(secret)) throw new HttpError(400, "bad_secret");
    const row = {
      secret_hash: await sha256(secret),
      display_name: cleanText(body.name, 24, "Friend"),
      avatar: cleanEmoji(body.avatar, "🕊️"),
      lang: cleanText(body.lang, 5, "en"),
      ...progressPatch(body.progress as Record<string, unknown> | undefined),
    };
    const { data, error } = await db.from("challenge_members").insert(row).select("id").single();
    if (error) {
      if (error.code === "23505") throw new HttpError(409, "already_registered");
      throw new HttpError(500, "register_failed");
    }
    return { memberId: data.id };
  }

  const me = await authenticate(body);

  switch (action) {
    case "overview":
      return overview(me, today);

    case "profile": {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ("name" in body) patch.display_name = cleanText(body.name, 24, me.display_name);
      if ("avatar" in body) patch.avatar = cleanEmoji(body.avatar, me.avatar);
      if (typeof body.lang === "string") patch.lang = cleanText(body.lang, 5, "en");
      const { error } = await db.from("challenge_members").update(patch).eq("id", me.id);
      if (error) throw new HttpError(500, "update_failed");
      return { ok: true };
    }

    case "sync": {
      const patch = { ...progressPatch(body.progress as Record<string, unknown> | undefined), updated_at: new Date().toISOString() };
      const { error } = await db.from("challenge_members").update(patch).eq("id", me.id);
      if (error) throw new HttpError(500, "sync_failed");
      return { ok: true };
    }

    case "create_circle": {
      const { count } = await db
        .from("challenge_circle_members")
        .select("circle_id", { count: "exact", head: true })
        .eq("member_id", me.id);
      if ((count ?? 0) >= MAX_CIRCLES_PER_MEMBER) throw new HttpError(409, "too_many_circles");
      const name = cleanText(body.name, 32, "My circle");
      const emoji = cleanEmoji(body.emoji, "🪔");
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = randomCode();
        const { data, error } = await db
          .from("challenge_circles")
          .insert({ code, name, emoji, created_by: me.id })
          .select("id, code")
          .single();
        if (error) {
          if (error.code === "23505") continue; // code collision, retry
          throw new HttpError(500, "create_failed");
        }
        const { error: joinError } = await db.from("challenge_circle_members").insert({ circle_id: data.id, member_id: me.id });
        if (joinError) throw new HttpError(500, "create_failed");
        return { circleId: data.id, code: data.code, ...(await overview(me, today)) };
      }
      throw new HttpError(500, "create_failed");
    }

    case "join_circle": {
      const code = typeof body.code === "string" ? body.code.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
      if (code.length !== 6) throw new HttpError(400, "bad_code");
      const { data: circle } = await db.from("challenge_circles").select("id").eq("code", code).maybeSingle();
      if (!circle) throw new HttpError(404, "circle_not_found");
      const { data: existing } = await db
        .from("challenge_circle_members")
        .select("circle_id")
        .eq("circle_id", circle.id)
        .eq("member_id", me.id)
        .maybeSingle();
      if (!existing) {
        const [{ count: mine }, { count: size }] = await Promise.all([
          db.from("challenge_circle_members").select("circle_id", { count: "exact", head: true }).eq("member_id", me.id),
          db.from("challenge_circle_members").select("member_id", { count: "exact", head: true }).eq("circle_id", circle.id),
        ]);
        if ((mine ?? 0) >= MAX_CIRCLES_PER_MEMBER) throw new HttpError(409, "too_many_circles");
        if ((size ?? 0) >= MAX_MEMBERS_PER_CIRCLE) throw new HttpError(409, "circle_full");
        const { error } = await db.from("challenge_circle_members").insert({ circle_id: circle.id, member_id: me.id });
        if (error && error.code !== "23505") throw new HttpError(500, "join_failed");
      }
      return { circleId: circle.id, ...(await overview(me, today)) };
    }

    case "leave_circle": {
      const circleId = typeof body.circleId === "string" ? body.circleId : "";
      await requireMembership(circleId, me.id);
      await db.from("challenge_circle_members").delete().eq("circle_id", circleId).eq("member_id", me.id);
      // Remove circles nobody is left in.
      const { count } = await db
        .from("challenge_circle_members")
        .select("member_id", { count: "exact", head: true })
        .eq("circle_id", circleId);
      if ((count ?? 0) === 0) await db.from("challenge_circles").delete().eq("id", circleId);
      return overview(me, today);
    }

    case "rename_circle": {
      const circleId = typeof body.circleId === "string" ? body.circleId : "";
      await requireMembership(circleId, me.id);
      const patch: Record<string, unknown> = {};
      if ("name" in body) patch.name = cleanText(body.name, 32, "My circle");
      if ("emoji" in body) patch.emoji = cleanEmoji(body.emoji, "🪔");
      const { error } = await db.from("challenge_circles").update(patch).eq("id", circleId).eq("created_by", me.id);
      if (error) throw new HttpError(500, "update_failed");
      return overview(me, today);
    }

    case "cheer": {
      const circleId = typeof body.circleId === "string" ? body.circleId : "";
      const toMember = typeof body.toMember === "string" ? body.toMember : "";
      const kind = typeof body.kind === "string" ? body.kind : "";
      if (!CHEER_KINDS.has(kind) || toMember === me.id) throw new HttpError(400, "bad_cheer");
      await requireMembership(circleId, me.id);
      await requireMembership(circleId, toMember);
      const { error } = await db
        .from("challenge_cheers")
        .insert({ circle_id: circleId, from_member: me.id, to_member: toMember, kind, sent_on: today });
      if (error && error.code !== "23505") throw new HttpError(500, "cheer_failed");
      return { ok: true, alreadySent: error?.code === "23505" };
    }

    case "seen": {
      const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 50) : [];
      if (ids.length) {
        await db.from("challenge_cheers").update({ seen_at: new Date().toISOString() }).eq("to_member", me.id).in("id", ids);
      }
      return { ok: true };
    }

    case "delete_me": {
      await db.from("challenge_members").delete().eq("id", me.id);
      return { ok: true };
    }

    default:
      throw new HttpError(400, "unknown_action");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  try {
    return json(await handle(body ?? {}));
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.code }, err.status);
    console.error("challenge-circle failed", err);
    return json({ error: "server_error" }, 500);
  }
});
