import { useEffect, useRef } from "react";

/**
 * Shared tilt engine for parallax previews.
 * - DeviceOrientation auto-attaches where available (Android/desktop).
 * - Falls back to mouse movement on desktop.
 * Returns a `current` position vector { x, y } in the -1..1 range that the
 * consumer reads inside its own requestAnimationFrame loop.
 */
export function useParallaxTilt(opts?: { enableMouse?: boolean; container?: React.RefObject<HTMLElement> }) {
  const enableMouse = opts?.enableMouse ?? true;
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      current.current.x += (target.current.x - current.current.x) * 0.1;
      current.current.y += (target.current.y - current.current.y) * 0.1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const handler = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      const beta = (e.beta ?? 45) - 45;
      target.current.x = -Math.max(-1, Math.min(1, gamma / 20));
      target.current.y = -Math.max(-1, Math.min(1, beta / 20));
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  useEffect(() => {
    if (!enableMouse) return;
    const el = opts?.container?.current;
    const handler = (e: MouseEvent) => {
      if (el) {
        const r = el.getBoundingClientRect();
        target.current.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
        target.current.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      } else {
        target.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
        target.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
      }
    };
    const t = el ?? window;
    t.addEventListener("mousemove", handler as EventListener);
    return () => t.removeEventListener("mousemove", handler as EventListener);
  }, [enableMouse, opts?.container]);

  return { current };
}
