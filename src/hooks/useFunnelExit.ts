import { useCallback, useState } from "react";
import { toast } from "sonner";
import { bumpExitCount, readExitCount } from "@/lib/dailyFunnel";
import { useTodayTasks } from "@/hooks/useTodayTasks";

/**
 * Escalating exit-intent rescue for mid-funnel exits.
 *  1st exit → soft toast nudge
 *  2nd+ exit → confirm modal (handled by caller via `showModal` state)
 *  Final exit → schedule a +2h push notification
 *
 * Caller wires `tryExit` to their close/back button. If it returns `true`,
 * the caller proceeds with the close. If `false`, a modal must be shown.
 */
export function useFunnelExit(opts: { from: "prayer" | "reflection" }) {
  const tasks = useTodayTasks();
  const [showModal, setShowModal] = useState(false);

  const tryExit = useCallback((): boolean => {
    // If they're already done with the funnel, no rescue.
    if (tasks.allDone) return true;
    // If their current step is done (e.g. they finished reflection and are
    // legitimately leaving), no rescue.
    if (opts.from === "prayer" && tasks.prayer) return true;
    if (opts.from === "reflection" && tasks.reflection) return true;

    const count = readExitCount();
    if (count === 0) {
      // First exit attempt today — soft toast, allow exit
      bumpExitCount();
      toast("🙏 Just two more minutes — finish your walk today", {
        description: "Your streak is one tap away.",
        duration: 2600,
      });
      schedulePush();
      return true;
    }
    // 2nd+ → block and show modal
    bumpExitCount();
    setShowModal(true);
    return false;
  }, [tasks.allDone, tasks.prayer, tasks.reflection, opts.from]);

  const confirmExit = useCallback(() => {
    setShowModal(false);
    schedulePush();
  }, []);

  const dismissModal = useCallback(() => setShowModal(false), []);

  return { tryExit, showModal, confirmExit, dismissModal };
}

/** Disabled: all pushes now come from native prayer/content systems only. */
function schedulePush() {
  return;
}
