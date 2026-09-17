import { useEffect, useRef, useState } from "react";
import { isAndroidPerfMode } from "@/lib/androidPerf";

/**
 * Shared tilt engine for parallax previews.
 * - iOS: requires DeviceOrientationEvent.requestPermission().
 * - Android/desktop: DeviceOrientation auto-attaches; falls back to mouse.
 * Returns a `bind` ref for the container (used only for mouse fallback bounds)
 * and a `current` position vector { x, y } in the -1..1 range that the
 * consumer reads inside its own requestAnimationFrame loop.
 */
export function useParallaxTilt(opts?: { enableMouse?: boolean; container?: React.RefObject<HTMLElement> }) {
  const enableMouse = opts?.enableMouse ?? true;
  // Parallax tilt is a star conversion feature — never freeze on Android.
  const freezeForAndroid = false;
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const [needsPermission, setNeedsPermission] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (freezeForAndroid) return;
    let raf = 0;
    const loop = () => {
      current.current.x += (target.current.x - current.current.x) * 0.1;
      current.current.y += (target.current.y - current.current.y) * 0.1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [freezeForAndroid]);

  useEffect(() => {
    if (!granted || freezeForAndroid) return;
    const handler = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      const beta = (e.beta ?? 45) - 45;
      target.current.x = -Math.max(-1, Math.min(1, gamma / 22));
      target.current.y = -Math.max(-1, Math.min(1, beta / 22));
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, [freezeForAndroid, granted]);

  useEffect(() => {
    if (!enableMouse || freezeForAndroid) return;
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
  }, [enableMouse, freezeForAndroid, opts?.container]);

  useEffect(() => {
    if (freezeForAndroid) return;
    const AnyEvt = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (typeof AnyEvt.requestPermission === "function") setNeedsPermission(true);
    else setGranted(true);
  }, [freezeForAndroid]);

  const requestPerm = async () => {
    const AnyEvt = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    try {
      const res = await AnyEvt.requestPermission?.();
      if (res === "granted") {
        setGranted(true);
        setNeedsPermission(false);
      }
    } catch {
      /* noop */
    }
  };

  const skipPermission = () => {
    setGranted(true);
    setNeedsPermission(false);
  };

  return { current, needsPermission, granted, requestPerm, skipPermission };
}
