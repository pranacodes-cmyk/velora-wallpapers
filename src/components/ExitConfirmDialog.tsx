import { motion, AnimatePresence } from "framer-motion";
import { LogOut, X } from "lucide-react";
import { App } from "@capacitor/app";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";

interface ExitConfirmDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExitConfirmDialog({ open, onClose }: ExitConfirmDialogProps) {
  const { t } = useT();
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed inset-0 z-[101] flex items-center justify-center px-8"
          >
            <div className="w-full max-w-[300px] glass-surface golden-border rounded-3xl overflow-hidden">
              {/* Header */}
              <div className="pt-7 pb-4 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <LogOut className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground font-display">
                  {t("ov.exit.title")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {t("ov.exit.body")}
                </p>
              </div>

              {/* Actions */}
              <div className="px-5 pb-6 flex gap-3">
                <button
                  onClick={() => { haptic("soft"); onClose(); }}
                  className="flex-1 py-3 rounded-xl bg-muted text-foreground font-semibold text-sm transition-colors active:scale-95"
                >
                  {t("ov.exit.stay")}
                </button>
                <button
                  onClick={() => { haptic("heavy"); App.exitApp(); }}
                  className="flex-1 py-3 rounded-xl premium-gradient text-black font-bold text-sm transition-transform active:scale-95"
                >
                  {t("ov.exit.exit")}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
