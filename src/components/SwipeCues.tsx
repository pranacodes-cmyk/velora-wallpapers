import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Apple-style mini directional cues that flash briefly on the sides
 * after each swipe — a subtle reminder once the user has learned
 * the gesture (full pill is dismissed permanently after first 2 swipes).
 *
 * `direction` is "left" when the user just swiped to the previous
 * wallpaper, "right" for next. `key` (set by parent via `wallpaperId`)
 * re-triggers the animation on each navigation.
 */
export function SwipeMiniCues({
  show,
  topOffset = 0,
  bottomOffset = 0,
}: {
  show: boolean;
  topOffset?: number;
  bottomOffset?: number;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="mini-cues"
          className="absolute left-0 right-0 z-[8] pointer-events-none flex items-center justify-between px-3"
          style={{
            top: topOffset || "50%",
            bottom: bottomOffset || undefined,
            transform: !bottomOffset && !topOffset ? "translateY(-50%)" : undefined,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            initial={{ x: 6, opacity: 0 }}
            animate={{ x: 0, opacity: 0.55 }}
            exit={{ x: 6, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-7 h-12 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(0, 0, 0, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}
          >
            <ChevronLeft className="w-4 h-4 text-white" strokeWidth={2.4} />
          </motion.div>
          <motion.div
            initial={{ x: -6, opacity: 0 }}
            animate={{ x: 0, opacity: 0.55 }}
            exit={{ x: -6, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-7 h-12 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(0, 0, 0, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
            }}
          >
            <ChevronRight className="w-4 h-4 text-white" strokeWidth={2.4} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
