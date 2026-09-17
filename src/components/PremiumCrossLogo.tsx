/**
 * Premium ornate cross logo mark used in app headers.
 * Features:
 *  - Deep gradient background (rich primary tones)
 *  - Larger, refined cross with subtle gold inner glow + drop shadow
 *  - Soft inner top highlight for a luxe glassy feel
 */
export function PremiumCrossLogo({ size = 32 }: { size?: number }) {
  const radius = Math.round(size * 0.3);
  return (
    <div
      className="relative flex items-center justify-center shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background:
          "linear-gradient(140deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.78) 55%, hsl(var(--primary) / 0.55) 100%)",
        boxShadow:
          "0 6px 18px hsl(var(--primary) / 0.38), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.18)",
      }}
    >
      {/* Glossy top highlight */}
      <div
        className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-t-[10px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0))",
          opacity: 0.6,
        }}
      />

      {/* Cross — zoomed in, ornate proportions */}
      <svg
        viewBox="0 0 24 24"
        width={size * 0.62}
        height={size * 0.62}
        className="relative z-10"
        style={{
          filter:
            "drop-shadow(0 1px 1px rgba(0,0,0,0.35)) drop-shadow(0 0 3px rgba(255,255,255,0.18))",
        }}
      >
        <defs>
          <linearGradient id="crossFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,1)" />
            <stop offset="100%" stopColor="rgba(255,248,225,0.95)" />
          </linearGradient>
        </defs>
        {/* Slim, elegant cross */}
        <path
          d="M11.1 3 h1.8 a0.6 0.6 0 0 1 0.6 0.6 v6.2 h5.4 a0.6 0.6 0 0 1 0.6 0.6 v1.8 a0.6 0.6 0 0 1 -0.6 0.6 h-5.4 v7.6 a0.6 0.6 0 0 1 -0.6 0.6 h-1.8 a0.6 0.6 0 0 1 -0.6 -0.6 v-7.6 h-5.4 a0.6 0.6 0 0 1 -0.6 -0.6 v-1.8 a0.6 0.6 0 0 1 0.6 -0.6 h5.4 v-6.2 a0.6 0.6 0 0 1 0.6 -0.6 z"
          fill="url(#crossFill)"
        />
      </svg>
    </div>
  );
}
