import { useRef, useCallback, useEffect, useState } from "react";
import { ImageIcon, BrainCircuit, Sun, BookOpen } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { haptic } from "@/utils/haptics";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n";

const tabs = [
  { path: "/", icon: Sun, labelKey: "nav.today", special: true },
  { path: "/wallpapers", icon: ImageIcon, labelKey: "nav.wallpapers" },
  { path: "/bible", icon: BookOpen, labelKey: "bible.title" },
  { path: "/quiz", icon: BrainCircuit, labelKey: "nav.quiz" },
] satisfies Array<{ path: string; icon: typeof Sun; labelKey: string; special?: boolean }>;


export function BottomNav() {
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const lastHoveredTab = useRef<string | null>(null);
  const isDragging = useRef(false);

  // Tab taps NEVER arm the prayer→reflection handoff. Only the explicit
  // "Continue" button on the prayer slide means "I'm done — take me on."
  // This stops the bug where tapping Today mid-prayer auto-jumped users
  // into the reflection sheet without ever showing the completion screen.
  const navigateTab = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/wallpapers") {
      return (
        location.pathname.startsWith("/wallpapers") ||
        location.pathname.startsWith("/live") ||
        location.pathname.startsWith("/static-wallpapers")
      );
    }
    return location.pathname.startsWith(path);
  };

  const getTabFromTouch = useCallback((clientX: number, clientY: number): string | null => {
    const nav = navRef.current;
    if (!nav) return null;
    for (const tab of tabs) {
      const el = nav.querySelector(`[data-tab="${tab.path}"]`) as HTMLElement;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return tab.path;
      }
    }
    return null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    lastHoveredTab.current = null;
    const touch = e.touches[0];
    const tab = getTabFromTouch(touch.clientX, touch.clientY);
    if (tab) lastHoveredTab.current = tab;
  }, [getTabFromTouch]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    const tab = getTabFromTouch(touch.clientX, touch.clientY);
    if (tab && tab !== lastHoveredTab.current) {
      lastHoveredTab.current = tab;
      haptic("soft");
      navigateTab(tab);
    }
  }, [navigateTab, getTabFromTouch]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging.current && lastHoveredTab.current) {
      navigateTab(lastHoveredTab.current);
    }
    isDragging.current = false;
    lastHoveredTab.current = null;
  }, [navigateTab]);

  // Listen to body data-attr to allow pages to hide nav (e.g. quiz in progress)
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.body.dataset.hideNav === "true");
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-hide-nav"] });
    return () => obs.disconnect();
  }, []);

  if (location.pathname.startsWith("/admin") || location.pathname.startsWith("/challenge/day")) return null;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          key="bottom-nav"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed bottom-4 left-4 right-4 z-50"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
      <nav
        ref={navRef}
        className="relative flex items-stretch justify-around rounded-[28px] overflow-hidden touch-none"
        style={{
          background: "hsl(var(--glass))",
          border: "1px solid hsl(var(--glass-border))",
          boxShadow: "0 8px 40px -8px rgba(0,0,0,0.5), 0 0 0 0.5px hsl(var(--primary) / 0.05), inset 0 1px 0 hsl(0 0% 100% / 0.04)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const isSpecial = tab.special;

          return (
            <button
              key={tab.path}
              data-tab={tab.path}
              onClick={() => {
                haptic("soft");
                navigateTab(tab.path);
              }}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-3.5 transition-all duration-200"
            >
              {/* Active indicator line */}
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-[1px] rounded-full"
                  style={{
                    width: 20,
                    height: 3,
                    left: "50%",
                    marginLeft: -10,
                    background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
                    boxShadow: "0 0 10px hsl(var(--primary) / 0.4)",
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}

              {/* Active glow behind icon */}
              {active && (
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: 36,
                    height: 36,
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -55%)",
                    background: "radial-gradient(circle, hsl(var(--primary) / 0.1) 0%, transparent 70%)",
                  }}
                />
              )}

              <tab.icon
                className={`h-[21px] w-[21px] transition-all duration-300 ${
                  active
                    ? isSpecial ? "text-primary" : "text-primary"
                    : "text-foreground/70"
                }`}
                strokeWidth={active ? 2.4 : 1.8}
                fill={isSpecial && active ? "currentColor" : "none"}
              />
              <span
                className={`text-[9px] font-bold leading-none transition-all duration-300 ${
                  active ? "text-primary" : "text-foreground/65"
                }`}
              >
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
