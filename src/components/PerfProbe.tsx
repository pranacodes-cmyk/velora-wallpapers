import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Measures route shell commit. Real content readiness is separately marked by
 * heavy screens so this number is never presented as full interactivity.
 */
const PerfProbe = () => {
  const location = useLocation();
  const startRef = useRef<number>(performance.now());

  useEffect(() => {
    startRef.current = performance.now();
    let raf1 = 0;
    let cancelled = false;

    raf1 = requestAnimationFrame(() => {
      if (cancelled) return;
      const ms = performance.now() - startRef.current;
      import("@/services/perf")
        .then((m) => m.trackRouteMount(location.pathname, ms))
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
    };
  }, [location.pathname]);

  return null;
};

export default PerfProbe;
