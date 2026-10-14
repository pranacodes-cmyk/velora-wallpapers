import { memo, useId } from "react";
import { LAMPS } from "./challengeAssets";

type Props = {
  tier: number;
  /** 0–1 brightness across the journey */
  intensity: number;
  /** lit = today's day is done, waiting = alive but today not done, ember = not started / streak broken */
  state: "lit" | "waiting" | "ember";
  width: number;
  className?: string;
  priority?: boolean;
};

/**
 * Oil lamp with a live, code-drawn flame sitting on the wick of the tier's art.
 * The flame and its halo grow with the journey; Radiance adds rays, Beacon
 * adds rising sparks.
 */
export const ChallengeLamp = memo(function ChallengeLamp({ tier, intensity, state, width, className, priority }: Props) {
  const uid = useId().replace(/:/g, "");
  const lamp = LAMPS[Math.max(0, Math.min(4, tier))];
  const height = (width * lamp.h) / lamp.w;
  const power = state === "lit" ? intensity : state === "waiting" ? intensity * 0.72 : 0.12;
  const flameH = width * (0.12 + 0.26 * power);
  const flameW = flameH * 0.62;
  const glow = width * (0.38 + 1.05 * power);
  const wx = lamp.wick[0] * width;
  const wy = lamp.wick[1] * height;
  // Leave room for the flame and halo above and to the right of the wick.
  const padTop = Math.max(0, flameH + glow * 0.18 - wy);
  const padRight = Math.max(0, wx + flameW * 0.6 - width);

  return (
    <div
      className={["challenge-lamp relative select-none", className].filter(Boolean).join(" ")}
      style={{ width: width + padRight, height: height + padTop }}
      aria-hidden
    >
      <div className="absolute left-0" style={{ top: padTop, width, height }}>
        {/* halo */}
        <span
          className="challenge-halo pointer-events-none absolute rounded-full"
          style={{
            left: wx - glow / 2,
            top: wy - flameH * 0.55 - glow / 2,
            width: glow,
            height: glow,
            opacity: state === "ember" ? 0.25 : 0.55 + power * 0.45,
          }}
        />
        {tier >= 3 && state !== "ember" && (
          <span
            className="challenge-rays pointer-events-none absolute rounded-full"
            style={{ left: wx - glow * 0.75, top: wy - flameH * 0.55 - glow * 0.75, width: glow * 1.5, height: glow * 1.5 }}
          />
        )}
        <img
          src={lamp.src}
          width={lamp.w}
          height={lamp.h}
          alt=""
          draggable={false}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="relative block h-full w-full object-contain drop-shadow-[0_18px_22px_hsl(222_60%_4%/0.45)]"
        />
        {/* flame */}
        <span
          className={`challenge-flame pointer-events-none absolute ${state === "ember" ? "challenge-flame--ember" : ""}`}
          style={{ left: wx - flameW / 2, top: wy - flameH + flameH * 0.08, width: flameW, height: flameH }}
        >
          <svg viewBox="0 0 40 64" width="100%" height="100%" overflow="visible">
            <defs>
              <radialGradient id={`cf-outer-${uid}`} cx="50%" cy="78%" r="70%">
                <stop offset="0%" stopColor="#FFF8D6" />
                <stop offset="38%" stopColor="#FFC94A" />
                <stop offset="72%" stopColor="#FF8A1F" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#FF5A00" stopOpacity="0" />
              </radialGradient>
              <radialGradient id={`cf-inner-${uid}`} cx="50%" cy="80%" r="60%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="55%" stopColor="#FFF1B0" />
                <stop offset="100%" stopColor="#FFD45C" stopOpacity="0" />
              </radialGradient>
              <radialGradient id={`cf-core-${uid}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#9CC8FF" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#5B8CFF" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g className="challenge-flame-outer">
              <path d="M20 1 C 27 15, 37 26, 37 41 C 37 55, 29 63, 20 63 C 11 63, 3 55, 3 41 C 3 26, 13 15, 20 1 Z" fill={`url(#cf-outer-${uid})`} />
            </g>
            <g className="challenge-flame-inner">
              <path d="M20 18 C 24 28, 30 35, 30 45 C 30 54, 25 60, 20 60 C 15 60, 10 54, 10 45 C 10 35, 16 28, 20 18 Z" fill={`url(#cf-inner-${uid})`} />
            </g>
            <ellipse cx="20" cy="57" rx="6" ry="4.5" fill={`url(#cf-core-${uid})`} />
          </svg>
        </span>
        {tier >= 4 && state === "lit" && (
          <span className="pointer-events-none absolute" style={{ left: wx - 30, top: wy - flameH - 30, width: 60, height: 60 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="challenge-spark absolute rounded-full" style={{ left: 10 + i * 10, bottom: 0, animationDelay: `${i * 0.55}s` }} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
});
