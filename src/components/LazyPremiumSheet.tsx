import { lazy, Suspense, useEffect } from "react";

// PremiumSheet is ~940 lines + framer-motion + RevenueCat glue. Every page
// that offers a paywall used to import it eagerly, mounting the entire tree
// on cold nav even when the sheet was closed. This wrapper defers the whole
// chunk until the sheet is opened for the first time — AND warms the chunk
// during browser idle so the first tap has no visible stall.
const load = () =>
  import("./PremiumSheet").then((m) => ({ default: m.PremiumSheet }));
const PremiumSheetImpl = lazy(load);

let warmed = false;
function warm() {
  if (warmed) return;
  warmed = true;
  // Also warm the two side imports the sheet fires on open, so the very
  // first tap doesn't network-stall while showing an empty modal.
  void load();
  void import("@/services/analytics");
  void import("@/services/meta-capi");
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUnlock?: () => void;
  trigger?: string;
  context?: {
    journeyTitle?: string;
    day?: number;
    totalDays?: number;
  };
}

export function LazyPremiumSheet(props: Props) {
  // Prefetch the chunk shortly after mount so the first open feels instant.
  useEffect(() => {
    if (props.isOpen) {
      warm();
      return;
    }
    const w = typeof window !== "undefined" ? (window as any) : null;
    const ric: (cb: () => void) => number =
      w?.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const cic: (id: number) => void =
      w?.cancelIdleCallback ?? ((id: number) => window.clearTimeout(id));
    const id = ric(warm);
    return () => cic(id);
  }, [props.isOpen]);

  if (!props.isOpen) return null;
  return (
    <Suspense fallback={null}>
      <PremiumSheetImpl {...props} />
    </Suspense>
  );
}

export default LazyPremiumSheet;
