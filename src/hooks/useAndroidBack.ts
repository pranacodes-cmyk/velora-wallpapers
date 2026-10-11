import { useEffect, useRef, useState, useCallback } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

type BackHandlerEntry = {
  id: symbol;
  getHandler: () => (() => void) | undefined;
};

const backHandlerStack: BackHandlerEntry[] = [];
let nativeBackListener: Promise<{ remove: () => void }> | null = null;

function ensureNativeBackListener() {
  if (!Capacitor.isNativePlatform()) return;
  if (nativeBackListener) return;

  nativeBackListener = App.addListener("backButton", () => {
    for (let i = backHandlerStack.length - 1; i >= 0; i--) {
      const handler = backHandlerStack[i]?.getHandler();
      if (handler) {
        handler();
        return;
      }
    }
  });
}

/**
 * Hook to handle Android hardware back button via Capacitor App plugin.
 * Calls onBack when back is pressed. Use on sub-pages to navigate back.
 */
export function useAndroidBack(onBack?: () => void) {
  const callbackRef = useRef(onBack);
  const idRef = useRef<symbol | null>(null);
  callbackRef.current = onBack;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    ensureNativeBackListener();
    const id = Symbol("android-back-handler");
    idRef.current = id;
    backHandlerStack.push({ id, getHandler: () => callbackRef.current });

    return () => {
      const idx = backHandlerStack.findIndex((entry) => entry.id === id);
      if (idx >= 0) backHandlerStack.splice(idx, 1);
      if (idRef.current === id) idRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !onBack || !idRef.current) return;
    const idx = backHandlerStack.findIndex((entry) => entry.id === idRef.current);
    if (idx < 0 || idx === backHandlerStack.length - 1) return;
    const [entry] = backHandlerStack.splice(idx, 1);
    backHandlerStack.push(entry);
  }, [Boolean(onBack)]);
}

/**
 * Hook for homepage exit confirmation — shows a beautiful dialog on back press.
 * Returns state to render the ExitConfirmDialog component.
 */
export function useExitOnBack() {
  const [showExit, setShowExit] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = App.addListener("backButton", () => {
      // Don't show exit prompt if any overlay/modal/sheet/dialog is open.
      // We check explicit opt-in (`data-back-consumer`) AND any Radix-based
      // dialog/sheet/popover/drawer that is currently in the open state, so
      // pressing back on the Premium sheet, Reflection sheet, etc. simply
      // dismisses the overlay instead of asking the user to quit the app.
      const overlaySelectors = [
        "[data-back-consumer]",
        '[role="dialog"][data-state="open"]',
        '[role="alertdialog"][data-state="open"]',
        '[data-radix-popper-content-wrapper]',
        '[data-vaul-drawer][data-state="open"]',
      ];
      for (const sel of overlaySelectors) {
        if (document.querySelector(sel)) {
          // Try to close it by simulating Escape — Radix listens for it.
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          return;
        }
      }
      // If any subpage back handler is registered, let it handle back instead
      // of showing the exit prompt.
      for (let i = backHandlerStack.length - 1; i >= 0; i--) {
        const handler = backHandlerStack[i]?.getHandler();
        if (handler) {
          handler();
          return;
        }
      }
      setShowExit(true);

    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  const closeExit = useCallback(() => setShowExit(false), []);

  return { showExit, closeExit };
}

/**
 * @deprecated Use useExitOnBack() with ExitConfirmDialog instead
 */
export function useExitOnDoubleBack() {
  const { showExit, closeExit } = useExitOnBack();
  // Keep backwards compat but this is now unused
  return { showExit, closeExit };
}
