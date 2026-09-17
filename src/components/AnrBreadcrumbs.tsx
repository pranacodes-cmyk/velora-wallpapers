import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Writes lightweight breadcrumbs to localStorage on every route change and
 * user interaction. If Play Console reports an ANR next, we can read these
 * from the device (adb shell run-as ... localStorage) or ship them via the
 * next analytics event to know which screen + last action the user was on.
 *
 * Zero rendering. No network. Passive listeners. The performance service
 * uploads these on the next launch after an abnormal process exit.
 */
export const AnrBreadcrumbs = () => {
  const location = useLocation();

  useEffect(() => {
    try {
      const now = Date.now();
      localStorage.setItem("anr_last_route", location.pathname + location.search);
      localStorage.setItem("anr_last_route_ts", String(now));
    } catch {}
  }, [location.pathname, location.search]);

  useEffect(() => {
    // Never write localStorage inside the tap path — a synchronous write in the
    // capture phase delays React's own handler and shows up as tap lag on
    // low-end Android. Coalesce and flush after the interaction is handled.
    let pending: string | null = null;
    let pendingTs = 0;
    let scheduled = false;

    const flush = () => {
      scheduled = false;
      if (pending === null) return;
      try {
        localStorage.setItem("anr_last_action", pending);
        localStorage.setItem("anr_last_action_ts", String(pendingTs));
      } catch {}
      pending = null;
    };

    const stamp = (kind: string) => {
      pending = kind;
      pendingTs = Date.now();
      if (scheduled) return;
      scheduled = true;
      const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      if (idle) idle(flush, { timeout: 600 });
      else window.setTimeout(flush, 200);
    };

    const onPointer = () => stamp("pointerdown");
    const onVisibility = () => {
      stamp("vis:" + document.visibilityState);
      // Backgrounding may kill the process before idle fires.
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pointerdown", onPointer, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisibility, { passive: true });
    return () => {
      flush();
      window.removeEventListener("pointerdown", onPointer, { capture: true } as EventListenerOptions);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
};
