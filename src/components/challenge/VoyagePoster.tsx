import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ISLAND_DAYS, LABEL_SIDE, LAMB_ASPECT, LAMB_STEP_MS, LAMB_WALK, VOYAGE_ART, VOYAGE_ASPECT, VOYAGE_DAYS, islandPoint, labelHidden, nextIsland, voyagePath,
  voyagePoint,
} from "./voyage";
import { JourneyAvatar } from "./JourneyAvatar";

type Crop = { x0: number; y0: number; x1: number; y1: number };

type Props = {
  /** Completed days (0–75); the lamb stands here. */
  days: number;
  /** When set (and lower than `days`), the lamb walks from here to `days`. */
  fromDays?: number | null;
  /** Visible window of the artwork (normalized). Defaults to the whole path. */
  crop?: Crop;
  /** Milestone day labels under each stop. */
  labels?: boolean;
  showRoute?: boolean;
  priority?: boolean;
  /** Legacy presentation hint; Journey scenery stays daytime in every theme. */
  sea?: "auto" | "night";
  label?: string;
  className?: string;
  /** Delay before the lamb starts walking, ms. */
  sailDelay?: number;
  sailMs?: number;
  onArrive?: () => void;
  /** Friends walking the same road (ghost lambs with their avatar). */
  buddies?: { id: string; days: number; avatar: string; name?: string }[];
  children?: ReactNode;
};

/** Framed on the road and the Cross so the lamb stays readable on phones. */
const ROAD: Crop = { x0: 0.16, y0: 0.1, x1: 0.88, y1: 1 };
const CROSS = { x: 0.787, y: 0.2 };
const FRAMES = [VOYAGE_ART.lamb, LAMB_WALK[0], LAMB_WALK[2]] as const;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Walk pace: soft start and stop, steady stride in between. */
const ease = (t: number) => {
  const a = 0.18;
  if (t < a) return (t * t) / (2 * a * (1 - a));
  if (t > 1 - a) return 1 - ((1 - t) * (1 - t)) / (2 * a * (1 - a));
  return (t - a / 2) / (1 - a);
};

/**
 * The pilgrimage artwork: mountain path, five waypoints, a cross ahead and
 * the away-facing lamb placed on the path by progress. Always daylight.
 */
export const VoyagePoster = forwardRef<HTMLDivElement, Props>(function VoyagePoster({
  days, fromDays, crop = ROAD, labels = false, showRoute = false, priority = false, label, className = "",
  sailDelay = 450, sailMs = 2600, onArrive, buddies = [], children,
}, forwardedRef) {
  const target = Math.min(VOYAGE_DAYS, Math.max(0, days));
  const animate = fromDays != null && fromDays < target && !prefersReducedMotion();
  const [shown, setShown] = useState(animate ? Math.max(0, fromDays ?? target) : target);
  const [walking, setWalking] = useState(false);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!walking) { setFrame(0); return; }
    let i = 0;
    const id = window.setInterval(() => { i = (i + 1) % LAMB_WALK.length; setFrame(i); }, LAMB_STEP_MS);
    return () => window.clearInterval(id);
  }, [walking]);
  const frameSrc = walking ? LAMB_WALK[frame] : VOYAGE_ART.lamb;
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;
  // Artwork width in px, so milestone labels the lamb covers can fade out.
  const artRef = useRef<HTMLDivElement>(null);
  const [artW, setArtW] = useState(0);
  useEffect(() => {
    const el = artRef.current;
    if (!labels || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setArtW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [labels]);

  useEffect(() => {
    if (!animate) {
      setShown(target);
      // Reduced motion skips the walk, but the arrival still happened.
      if (fromDays != null && fromDays < target) arriveRef.current?.();
      return;
    }
    const start = Math.max(0, fromDays ?? target);
    setShown(start);
    let raf = 0;
    let t0 = 0;
    const timer = window.setTimeout(() => {
      setWalking(true);
      const step = (now: number) => {
        if (!t0) t0 = now;
        const p = Math.min(1, (now - t0) / sailMs);
        setShown(start + (target - start) * ease(p));
        if (p < 1) raf = requestAnimationFrame(step);
        else { setWalking(false); arriveRef.current?.(); }
      };
      raf = requestAnimationFrame(step);
    }, sailDelay);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [target, fromDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const lamb = voyagePoint(shown);
  const reached = Math.floor(shown + 0.001);
  const next = nextIsland(reached);
  const done = reached >= VOYAGE_DAYS;

  const cw = crop.x1 - crop.x0;
  const ch = crop.y1 - crop.y0;
  const aspect = cw * VOYAGE_ASPECT / ch;

  return (
    <div
      ref={forwardedRef}
      role="img"
      aria-label={label}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: String(aspect) }}
    >
      <div
        ref={artRef}
        className="absolute"
        style={{
          width: `${100 / cw}%`,
          height: `${100 / ch}%`,
          left: `${(-crop.x0 / cw) * 100}%`,
          top: `${(-crop.y0 / ch) * 100}%`,
        }}
      >
        <img
          src={VOYAGE_ART.day}
          alt=""
          width={1920}
          height={800}
          draggable={false}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...(priority ? { fetchpriority: "high" } : {})}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />

        {/* Light from the cross once the pilgrimage is complete */}
        {done && (
          <span
            aria-hidden
            className="voyage-cross-glow pointer-events-none absolute h-[38%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${CROSS.x * 100}%`, top: `${CROSS.y * 100}%` }}
          />
        )}

        {showRoute && <svg viewBox="0 0 1000 800" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d={voyagePath(shown, VOYAGE_DAYS)} className="voyage-route-ahead" />
          {shown > 0.05 && (
            <>
              <path d={voyagePath(0, shown)} className="voyage-route-glow" />
              <path d={voyagePath(0, shown)} className="voyage-route-done" />
            </>
          )}
          {ISLAND_DAYS.map((d, i) => {
            const p = islandPoint(i);
            const got = reached >= d;
            const isNext = next?.index === i;
            return (
              <g key={d} transform={`translate(${p.x * 1000} ${p.y * 800})`}>
                {isNext && <circle r="16" className="voyage-node-pulse" />}
                <circle r={got || isNext ? 8.5 : 6} className={got ? "voyage-node-done" : isNext ? "voyage-node-next" : "voyage-node"} />
                {got && <path d="M-3.6 0.2 L-1 2.8 L3.8 -2.4" className="voyage-node-check" />}
              </g>
            );
          })}
        </svg>}

        {labels && ISLAND_DAYS.map((d, i) => {
          const p = islandPoint(i);
          const left = LABEL_SIDE[i] === "left";
          const hidden = artW > 0 && labelHidden(i, shown, artW, artW / VOYAGE_ASPECT);
          return (
            <span
              key={d}
              aria-hidden
              className={`voyage-label absolute ${left ? "-translate-x-full -translate-y-1/2" : "-translate-x-1/2"} ${
                reached >= d ? "voyage-label--done" : ""
              } ${hidden ? "voyage-label--hidden" : ""}`}
              style={
                left
                  ? { left: `calc(${p.x * 100}% - 11px)`, top: `${p.y * 100}%` }
                  : { left: `${p.x * 100}%`, top: `calc(${p.y * 100}% + ${i < 2 ? 12 : 9}px)` }
              }
            >
              {d}
            </span>
          );
        })}

        {/* Buddies — smaller lambs on the same road, each with their avatar */}
        {buddies.slice(0, 6).map((b) => {
          const p = voyagePoint(Math.min(VOYAGE_DAYS, Math.max(0, b.days)));
          const w = p.size * 0.82;
          return (
            <div key={b.id} aria-hidden className="pointer-events-none absolute"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${w * 100}%`, transform: "translate(-50%, -98.5%)" }}>
              <span className="absolute left-1/2 top-0 block aspect-square w-[78%] min-w-[16px] -translate-x-1/2 -translate-y-[105%] overflow-hidden rounded-full bg-card ring-2 ring-primary shadow-[0_2px_6px_hsl(var(--background)/0.5)]">
                <JourneyAvatar avatar={b.avatar} />
              </span>
              <img src={VOYAGE_ART.lamb} alt="" draggable={false} decoding="async"
                className="block w-full select-none opacity-90" style={{ aspectRatio: String(LAMB_ASPECT), transform: `scaleX(${p.facing})` }} />
            </div>
          );
        })}

        {/* The lamb — feet anchored on the path */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: `${lamb.x * 100}%`,
            top: `${lamb.y * 100}%`,
            width: `${lamb.size * 100}%`,
            transform: "translate(-50%, -98.5%)",
          }}
        >
          <div style={{ transform: `scaleX(${lamb.facing})` }}>
          {/* Soft contact shade under the hooves grounds the lamb in the sunlight */}
          <span aria-hidden className="voyage-lamb-contact" />
          <div className={`voyage-lamb relative w-full ${walking ? "voyage-lamb--walking" : ""}`} style={{ aspectRatio: String(LAMB_ASPECT) }}>
            {FRAMES.map((src) => (
              <img
                key={src}
                src={src}
                alt=""
                width={367}
                height={559}
                draggable={false}
                decoding="async"
                className="absolute inset-0 block h-full w-full select-none"
                style={{ opacity: src === frameSrc ? 1 : 0 }}
              />
            ))}
          </div>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
});
