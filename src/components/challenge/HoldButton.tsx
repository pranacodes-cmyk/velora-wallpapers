import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { haptic } from "@/utils/haptics";

type Props = {
  label: ReactNode;
  holdingLabel?: ReactNode;
  onComplete: () => void;
  durationMs?: number;
  className?: string;
  disabled?: boolean;
};

/**
 * Press-and-hold commitment button. A gold fill sweeps across while held;
 * releasing early resets it. Keyboard users can confirm with Enter/Space.
 */
export function HoldButton({ label, holdingLabel, onComplete, durationMs = 1300, className, disabled }: Props) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const done = useRef(false);
  const lastTick = useRef(0);

  const stop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    setHolding(false);
    if (!done.current) setProgress(0);
  }, []);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const tick = useCallback(() => {
    const p = Math.min(1, (performance.now() - start.current) / durationMs);
    setProgress(p);
    const step = Math.floor(p * 5);
    if (step > lastTick.current) { lastTick.current = step; haptic("light"); }
    if (p >= 1) {
      done.current = true;
      raf.current = null;
      setHolding(false);
      haptic("heavy");
      onComplete();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }, [durationMs, onComplete]);

  const begin = useCallback(() => {
    if (disabled || done.current) return;
    start.current = performance.now();
    lastTick.current = 0;
    setHolding(true);
    haptic("soft");
    raf.current = requestAnimationFrame(tick);
  }, [disabled, tick]);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); begin(); }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={() => { if (holding) stop(); }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !done.current) {
          e.preventDefault();
          done.current = true;
          setProgress(1);
          haptic("heavy");
          onComplete();
        }
      }}
      className={[
        "relative isolate flex h-14 w-full touch-none select-none items-center justify-center overflow-hidden rounded-full",
        "border border-primary/40 bg-card text-[15px] font-bold text-foreground shadow-[0_10px_28px_-14px_hsl(var(--primary)/0.8)]",
        "transition-transform active:scale-[0.985] disabled:opacity-50",
        className,
      ].filter(Boolean).join(" ")}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 -z-10 bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))]"
        style={{ width: `${progress * 100}%`, transition: holding ? "none" : "width 220ms ease-out" }}
      />
      <span className={progress > 0.5 ? "text-[hsl(var(--paywall-cta-foreground))]" : undefined}>
        {holding && holdingLabel ? holdingLabel : label}
      </span>
    </button>
  );
}
