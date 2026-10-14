// 75 Days of Light — pilgrimage geometry shared by every lamb/path surface.
//
// The artwork is one fixed wide daytime mountain path with five milestones. The route
// below is measured on that artwork (normalized 0–1), so overlays stay pinned
// to the path at any size. Flutter mirror: flutter_app/lib/screens/challenge/voyage.dart
import pathDay from "@/assets/challenge/dawn-path.jpg";
import lambStand from "@/assets/challenge/lamb3d-stand.png";
import lambWalkA from "@/assets/challenge/lamb3d-walk-a.png";
import lambWalkB from "@/assets/challenge/lamb3d-walk-b.png";

export const VOYAGE_ART = { day: pathDay, night: pathDay, lamb: lambStand } as const;
/** Walk cycle: step, stand, other step, stand (same framing, feet aligned). */
export const LAMB_WALK = [lambWalkA, lambStand, lambWalkB, lambStand] as const;
export const LAMB_STEP_MS = 140;

/** Artwork aspect (width / height) and lamb sprite aspect. */
export const VOYAGE_ASPECT = 1920 / 800;
export const LAMB_ASPECT = 367 / 559;

/** Waypoint arrivals, one every 15 days; the final destination is the cross. */
export const ISLAND_DAYS = [15, 30, 45, 60, 75] as const;
export const VOYAGE_DAYS = 75;

type Pt = readonly [number, number];

/** Measured road centerline; every bend stays on the cinematic stone road. */
const ANCHORS: readonly Pt[] = [
  [0.2188, 0.8900], [0.3334, 0.7925], [0.4219, 0.7606], [0.5209, 0.7450], [0.6145, 0.7288], [0.6979, 0.7006], [0.7688, 0.6613], [0.7752, 0.6213], [0.7148, 0.5862], [0.6594, 0.5556], [0.6672, 0.5344], [0.7291, 0.5119], [0.7974, 0.4644], [0.8117, 0.4163], [0.7742, 0.3819], [0.7620, 0.3494], [0.7875, 0.3100],
];
const CONTROLS: readonly Pt[] = [
  [0.2917, 0.8150], [0.3750, 0.7700], [0.4688, 0.7512], [0.5729, 0.7388], [0.6562, 0.7188], [0.7396, 0.6825], [0.7979, 0.6400], [0.7526, 0.6025], [0.6771, 0.5700], [0.6417, 0.5413], [0.6927, 0.5275], [0.7656, 0.4963], [0.8292, 0.4325], [0.7943, 0.4000], [0.7542, 0.3638], [0.7698, 0.3350],
];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function quad(p0: Pt, c: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
}

/** Lamb width (fraction of artwork width) at a road height: smaller further away. */
const SIZE_BY_Y: readonly Pt[] = [[0.31, 0.02], [0.40, 0.024], [0.52, 0.03], [0.58, 0.034], [0.74, 0.046], [0.89, 0.078]];
function sizeAt(y: number): number {
  const t = SIZE_BY_Y;
  if (y <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (y <= t[i][0]) return t[i - 1][1] + ((y - t[i - 1][0]) / (t[i][0] - t[i - 1][0])) * (t[i][1] - t[i - 1][1]);
  }
  return t[t.length - 1][1];
}

/**
 * Every day is the same distance "in the world": screen length divided by
 * the lamb's perspective size, so steps shrink naturally uphill.
 */
const SAMPLES = 24;
const LEG_START: number[] = [];
const LEG_TABLE: number[][] = [];
(() => {
  let total = 0;
  const raw: number[][] = [];
  for (let leg = 0; leg < CONTROLS.length; leg++) {
    LEG_START.push(total);
    const row = [total];
    let prev = ANCHORS[leg];
    for (let i = 1; i <= SAMPLES; i++) {
      const p = quad(ANCHORS[leg], CONTROLS[leg], ANCHORS[leg + 1], i / SAMPLES);
      const dx = (p[0] - prev[0]) * VOYAGE_ASPECT, dy = p[1] - prev[1];
      total += Math.hypot(dx, dy) / sizeAt((p[1] + prev[1]) / 2);
      row.push(total);
      prev = p;
    }
    raw.push(row);
  }
  LEG_START.push(total);
  for (let i = 0; i < LEG_START.length; i++) LEG_START[i] = (LEG_START[i] / total) * VOYAGE_DAYS;
  for (const row of raw) LEG_TABLE.push(row.map((v) => (v / total) * VOYAGE_DAYS));
})();

/** Leg index and local t for a (fractional) day count. */
function legOf(days: number): { leg: number; t: number } {
  const d = clamp(days, 0, VOYAGE_DAYS);
  let leg = 0;
  while (leg < CONTROLS.length - 1 && d > LEG_START[leg + 1]) leg++;
  const row = LEG_TABLE[leg];
  let i = 0;
  while (i < SAMPLES - 1 && d > row[i + 1]) i++;
  const span = row[i + 1] - row[i];
  const f = span > 0 ? clamp((d - row[i]) / span, 0, 1) : 0;
  return { leg, t: (i + f) / SAMPLES };
}

export type VoyagePoint = { x: number; y: number; facing: number; /** lamb width as a fraction of the artwork width */ size: number };

/** Lamb position for a (fractional) number of completed days. */
export function voyagePoint(days: number): VoyagePoint {
  const { leg, t } = legOf(days);
  const [x, y] = quad(ANCHORS[leg], CONTROLS[leg], ANCHORS[leg + 1], t);
  const dx = (1 - t) * (CONTROLS[leg][0] - ANCHORS[leg][0]) + t * (ANCHORS[leg + 1][0] - CONTROLS[leg][0]);
  return { x, y, facing: dx < 0 ? -1 : 1, size: sizeAt(y) };
}

export function islandPoint(index: number): { x: number; y: number } {
  const { x, y } = voyagePoint(ISLAND_DAYS[clamp(index, 0, 4)]);
  return { x, y };
}

/**
 * Where each milestone day label sits relative to its marker. The path climbs
 * into day 30 from below, so its label sits to the left instead.
 */
export const LABEL_SIDE: readonly ("below" | "left")[] = ["below", "left", "below", "below", "below"];
export const LABEL_W = 28;
export const LABEL_H = 18;
const LABEL_GAP = 11;

type Box = { l: number; t: number; r: number; b: number };

/** Label pill box in artwork pixels (art is `w` × `h`). */
export function labelBox(index: number, w: number, h: number): Box {
  const p = islandPoint(index);
  const cx = p.x * w, cy = p.y * h;
  if (LABEL_SIDE[index] === "left") {
    return { l: cx - LABEL_GAP - LABEL_W, t: cy - LABEL_H / 2, r: cx - LABEL_GAP, b: cy + LABEL_H / 2 };
  }
  const t = cy + (index < 2 ? 12 : 9);
  return { l: cx - LABEL_W / 2, t, r: cx + LABEL_W / 2, b: t + LABEL_H };
}

/** Visible lamb body (transparent margins trimmed), artwork pixels. */
export function lambBox(days: number, w: number, h: number): Box {
  const s = voyagePoint(days);
  const sw = s.size * w, sh = sw / LAMB_ASPECT;
  const x = s.x * w, y = s.y * h;
  return { l: x - 0.5 * sw, t: y - 0.985 * sh, r: x + 0.5 * sw, b: y + 0.015 * sh };
}

/** True while the lamb covers a waypoint label — that label fades out. */
export function labelHidden(index: number, days: number, w: number, h: number): boolean {
  const a = labelBox(index, w, h), b = lambBox(days, w, h);
  return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
}

/** Sub-curve of one leg between t0 and t1, as an SVG "Q" command chain start. */
function subLeg(leg: number, t0: number, t1: number, w: number, h: number, move: boolean): string {
  const p0 = ANCHORS[leg], c = CONTROLS[leg], p1 = ANCHORS[leg + 1];
  const a = quad(p0, c, p1, t0);
  const b = quad(p0, c, p1, t1);
  // Control of the [t0,t1] slice: B(t0) + (t1 - t0) * B'(t0) / 2
  const dx = (1 - t0) * (c[0] - p0[0]) + t0 * (p1[0] - c[0]);
  const dy = (1 - t0) * (c[1] - p0[1]) + t0 * (p1[1] - c[1]);
  const q: Pt = [a[0] + (t1 - t0) * dx, a[1] + (t1 - t0) * dy];
  const f = (p: Pt) => `${(p[0] * w).toFixed(1)} ${(p[1] * h).toFixed(1)}`;
  return `${move ? `M ${f(a)} ` : ""}Q ${f(q)} ${f(b)}`;
}

/** SVG path for the route between two (fractional) day counts. */
export function voyagePath(from: number, to: number, w = 1000, h = 800): string {
  const a = clamp(Math.min(from, to), 0, VOYAGE_DAYS);
  const b = clamp(Math.max(from, to), 0, VOYAGE_DAYS);
  if (b - a < 0.001) return "";
  const parts: string[] = [];
  let first = true;
  for (let leg = 0; leg < CONTROLS.length; leg++) {
    const s = LEG_START[leg], e = LEG_START[leg + 1];
    if (b <= s || a >= e) continue;
    const t0 = a <= s ? 0 : legOf(a).t;
    const t1 = b >= e ? 1 : legOf(b).t;
    parts.push(subLeg(leg, t0, t1, w, h, first));
    first = false;
  }
  return parts.join(" ");
}

/** Next waypoint the lamb is heading for (index 0–4), or null at the cross. */
export function nextIsland(completed: number): { index: number; day: number } | null {
  const i = ISLAND_DAYS.findIndex((d) => completed < d);
  return i === -1 ? null : { index: i, day: ISLAND_DAYS[i] };
}

/* ── "last seen" position so the lamb visibly walks forward on return ── */

const SEEN_KEY = "prayly_voyage_seen_v1";

export function getVoyageSeen(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setVoyageSeen(days: number) {
  try { localStorage.setItem(SEEN_KEY, String(days)); } catch { /* storage blocked */ }
}
