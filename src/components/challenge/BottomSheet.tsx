import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
};

/** Lightweight themed bottom sheet used across the challenge screens. */
export function BottomSheet({ open, title, onClose, children, closeLabel = "Close" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="challenge-rise max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-border bg-card px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 text-card-foreground shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-serif text-[23px] font-semibold leading-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
