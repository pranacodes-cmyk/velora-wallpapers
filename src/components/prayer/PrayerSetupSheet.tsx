import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Check, ShieldCheck, BellOff, Star, ChevronRight, AlertTriangle, Plus, Trash2, Pencil, Lock } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { usePrayerAlarms } from "@/hooks/usePrayerAlarms";
import PrayerAlarm from "@/plugins/prayer-alarm";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";


interface Props {
  open: boolean;
  onClose: () => void;
  /** Fires once alarms are scheduled successfully. */
  onScheduled?: () => void;
}

/**
 * Prayer bells management sheet.
 *
 * "Appear on top" (SYSTEM_ALERT_WINDOW) is REQUIRED for proper alarms when
 * the phone is unlocked — without it Android can only show a quiet heads-up
 * notification, not the full prayer takeover. We gate the Schedule button
 * on it.
 */
export function PrayerSetupSheet({ open, onClose, onScheduled }: Props) {
  const { t } = useT();
  const { config, status, enable, disable, update, addAlarm, removeAlarm, renameAlarm, refreshStatus } = usePrayerAlarms();
  const wasEnabled = config.enabled;
  const [phase, setPhase] = useState<"idle" | "saving" | "success">("idle");

  useEffect(() => { if (open) { setPhase("idle"); refreshStatus(); } }, [open, refreshStatus]);

  // Re-poll overlay status when window regains focus (user returns from settings).
  useEffect(() => {
    if (!open) return;
    const onFocus = () => { refreshStatus(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [open, refreshStatus]);

  const overlayOk = !!status?.overlayAllowed;
  const notifOk = status?.notificationsAllowed !== false;
  const fsiOk = status?.fullScreenIntentAllowed !== false;

  const handleSchedule = async () => {
    haptic("medium");
    setPhase("saving");
    try {
      await enable({ times: config.times, soundEnabled: config.soundEnabled });
      setPhase("success");
      setTimeout(() => {
        onScheduled?.();
        onClose();
      }, 1300);
    } catch {
      setPhase("idle");
    }
  };

  const handleTimeChange = async (idx: number, value: string) => {
    const [h, m] = value.split(":").map((n) => parseInt(n, 10));
    if (isNaN(h) || isNaN(m)) return;
    const nextTimes = config.times.map((t, i) =>
      i === idx ? { ...t, hour: h, minute: m } : t,
    );
    haptic("soft");
    try { await update({ times: nextTimes }); } catch { /* ignore */ }
  };

  const handleTest = async () => {
    haptic("soft");
    try { await PrayerAlarm.preview({ label: "Prayer Time", soundEnabled: config.soundEnabled }); } catch { /* ignore */ }
  };

  const handleGrantOverlay = async () => {
    haptic("soft");
    try { await PrayerAlarm.openOverlaySettings(); } catch { /* ignore */ }
  };

  const handleGrantNotif = async () => {
    haptic("soft");
    try { await PrayerAlarm.openNotificationSettings(); } catch { /* ignore */ }
  };

  const handleGrantFsi = async () => {
    haptic("soft");
    try { await PrayerAlarm.openFullScreenIntentSettings(); } catch { /* ignore */ }
  };

  const handleDisable = async () => {
    haptic("medium");
    try { await disable(); } catch { /* ignore */ }
    onClose();
  };

  const handleAdd = async () => {
    haptic("soft");
    // Pick a sensible default slot the user hasn't used yet.
    const taken = new Set(config.times.map((t) => t.hour * 60 + t.minute));
    const candidates: Array<{ hour: number; minute: number; label: string }> = [
      { hour: 12, minute: 0, label: "Midday Prayer" },
      { hour: 15, minute: 0, label: "Afternoon Prayer" },
      { hour: 21, minute: 0, label: "Night Prayer" },
      { hour: 9, minute: 0, label: "Mid-morning Prayer" },
      { hour: 6, minute: 0, label: "Dawn Prayer" },
      { hour: 22, minute: 30, label: "Bedtime Prayer" },
    ];
    const pick = candidates.find((c) => !taken.has(c.hour * 60 + c.minute))
      ?? { hour: 12, minute: 0, label: "Custom Reminder" };
    try { await addAlarm(pick); } catch { /* ignore */ }
  };

  const handleRemove = async (idx: number) => {
    haptic("soft");
    try { await removeAlarm(idx); } catch { /* ignore */ }
  };

  const handleRename = async (idx: number, label: string) => {
    try { await renameAlarm(idx, label); } catch { /* ignore */ }
  };


  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-auto max-h-[92vh] z-[10001] rounded-t-3xl border-t border-primary/20 bg-background p-0 overflow-hidden flex flex-col [&>button]:hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-foreground/5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
              <Bell className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
            </div>
            <p className="text-[14px] font-bold text-foreground">{t("pr.setup.title")}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-foreground/50 hover:bg-foreground/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — pads bottom for the Android nav bar / iOS home indicator */}
        <div
          className="flex-1 overflow-y-auto px-5 pt-5 scroll-container"
          style={{ paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom) + 1.25rem))" }}
        >
          {phase === "success" ? (
            <SuccessView wasEnabled={wasEnabled} />
          ) : wasEnabled ? (
            <ManageView
              times={config.times}
              overlayOk={overlayOk}
              notifOk={notifOk}
              fsiOk={fsiOk}
              onTimeChange={handleTimeChange}
              onTest={handleTest}
              onGrantOverlay={handleGrantOverlay}
              onGrantNotif={handleGrantNotif}
              onGrantFsi={handleGrantFsi}
              onDisable={handleDisable}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onRename={handleRename}
            />

          ) : (
            <FirstTimeView
              overlayOk={overlayOk}
              notifOk={notifOk}
              fsiOk={fsiOk}
              onGrantOverlay={handleGrantOverlay}
              onGrantNotif={handleGrantNotif}
              onGrantFsi={handleGrantFsi}
              onSchedule={handleSchedule}
              saving={phase === "saving"}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ───────────────── Permission primer (shared) ───────────────── */

function PermPrimer({
  overlayOk, notifOk, fsiOk, onGrantOverlay, onGrantNotif, onGrantFsi,
}: {
  overlayOk: boolean; notifOk: boolean; fsiOk: boolean;
  onGrantOverlay: () => void; onGrantNotif: () => void; onGrantFsi: () => void;
}) {
  const { t } = useT();
  if (overlayOk && notifOk && fsiOk) return null;
  return (
    <div className="mt-5 space-y-2.5">
      {!fsiOk && (
        <button
          onClick={onGrantFsi}
          className="flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left"
          style={{
            background: "hsl(var(--primary) / 0.08)",
            border: "1.5px solid hsl(var(--primary) / 0.55)",
          }}
        >
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-extrabold text-foreground">
              Required · Allow full-screen on lock screen
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-foreground/65">
              Android 14 blocks this by default — without it the prayer bell only plays sound on your lock screen with no visual. Tap to enable.
            </p>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        </button>
      )}
      {!overlayOk && (
        <button
          onClick={onGrantOverlay}
          className="flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left"
          style={{
            background: "hsl(var(--primary) / 0.08)",
            border: "1.5px solid hsl(var(--primary) / 0.55)",
          }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-extrabold text-foreground">
              Required · Allow "Appear on top"
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-foreground/65">
              Without this, prayer bells just buzz like a normal notification when your phone is in use. Tap to enable.
            </p>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        </button>
      )}
      {!notifOk && (
        <button
          onClick={onGrantNotif}
          className="flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left"
          style={{ border: "1px dashed hsl(var(--primary) / 0.35)" }}
        >
          <Star className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold text-foreground/90">{t("pr.setup.notif.title")}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-foreground/55">
              Lets the prayer bell show on your lock screen.
            </p>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground/40" />
        </button>
      )}
    </div>
  );
}

/* ───────────────── First-time CTA ───────────────── */

function FirstTimeView({
  onSchedule, saving, overlayOk, notifOk, fsiOk, onGrantOverlay, onGrantNotif, onGrantFsi,
}: {
  onSchedule: () => void; saving: boolean;
  overlayOk: boolean; notifOk: boolean; fsiOk: boolean;
  onGrantOverlay: () => void; onGrantNotif: () => void; onGrantFsi: () => void;
}) {
  const blocked = !overlayOk || !fsiOk;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <motion.div
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary) / 0.95), hsl(var(--primary) / 0.7))",
          boxShadow: "0 10px 30px -10px hsl(var(--primary) / 0.55)",
        }}
      >
        <Bell className="h-7 w-7" style={{ color: "hsl(var(--primary-foreground))" }} strokeWidth={2.2} />
      </motion.div>

      <h2 className="text-center text-[22px] font-extrabold leading-tight tracking-tight text-foreground">
        Pause your day to pray
      </h2>
      <p className="mx-auto mt-2 max-w-[300px] text-center text-[13px] leading-relaxed text-foreground/60">
        A gentle bell at the times you choose — even when your phone is silent or locked.
      </p>

      <PermPrimer
        overlayOk={overlayOk} notifOk={notifOk} fsiOk={fsiOk}
        onGrantOverlay={onGrantOverlay} onGrantNotif={onGrantNotif} onGrantFsi={onGrantFsi}
      />

      {!blocked && (
        <p className="mt-3 text-center text-[10.5px] text-foreground/40">
          Tip: keep this app's notifications on so the bell can fully take over your lock screen.
        </p>
      )}

      <button
        onClick={onSchedule}
        disabled={saving || blocked}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold transition-transform active:scale-[0.98] disabled:opacity-50"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))",
          color: "hsl(var(--primary-foreground))",
          boxShadow: "0 8px 24px -8px hsl(var(--primary) / 0.5)",
        }}
      >
        {saving ? "Setting up…" : blocked ? "Allow 'Appear on top' first" : "Schedule my prayer bells"}
        {!saving && !blocked && <ChevronRight className="h-4 w-4" />}
      </button>
    </motion.div>
  );
}

/* ───────────────── Manage panel (already-enabled) ───────────────── */

function ManageView({
  times, overlayOk, fsiOk, onTimeChange, onGrantOverlay, onGrantFsi, onDisable, onAdd, onRemove, onRename,
}: {
  times: { hour: number; minute: number; label: string }[];
  overlayOk: boolean;
  notifOk: boolean;
  fsiOk: boolean;
  onTimeChange: (idx: number, value: string) => void;
  onTest: () => void;
  onGrantOverlay: () => void;
  onGrantNotif: () => void;
  onGrantFsi: () => void;
  onDisable: () => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onRename: (idx: number, label: string) => void;
}) {
  const { t } = useT();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  const startEdit = (idx: number, label: string) => {
    setEditingIdx(idx);
    setDraftLabel(label);
  };
  const commitEdit = () => {
    if (editingIdx === null) return;
    const trimmed = draftLabel.trim();
    if (trimmed && trimmed !== times[editingIdx]?.label) onRename(editingIdx, trimmed);
    setEditingIdx(null);
  };

  const atCap = times.length >= 8;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
        <ShieldCheck className="h-6 w-6 text-primary" strokeWidth={2.2} />
      </div>
      <h2 className="text-center text-[20px] font-extrabold leading-tight text-foreground">
        Your prayer bells are set
      </h2>
      <p className="mx-auto mt-1.5 max-w-[300px] text-center text-[12.5px] leading-relaxed text-foreground/55">
        Tap the time to change it, the name to rename, or add your own.
      </p>

      {/* Editable rows */}
      <div className="mt-5 space-y-2">
        <AnimatePresence initial={false}>
          {times.map((item, i) => (
            <motion.div
              key={`${i}-${item.label}`}
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, x: -12, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 rounded-2xl px-3 py-3"
              style={{
                background: "hsl(var(--glass))",
                border: "1px solid hsl(var(--primary) / 0.18)",
              }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 flex-shrink-0">
                <Bell className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
              </div>

              {/* Label (tap to rename) */}
              <div className="min-w-0 flex-1">
                {editingIdx === i ? (
                  <input
                    autoFocus
                    value={draftLabel}
                    maxLength={28}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingIdx(null);
                    }}
                    className="w-full bg-transparent text-[13px] font-semibold text-foreground outline-none border-b border-primary/40 pb-0.5"
                    aria-label={t("pr.manage.renameAria")}
                  />
                ) : (
                  <button
                    onClick={() => startEdit(i, item.label)}
                    className="group flex items-center gap-1.5 text-left"
                  >
                    <span className="text-[13px] font-semibold text-foreground/90 truncate">{item.label}</span>
                    <Pencil className="h-3 w-3 text-foreground/30 group-hover:text-foreground/60" />
                  </button>
                )}
              </div>

              {/* Time chip with hidden native picker */}
              <div className="relative flex items-center">
                <p className="text-[13px] font-bold tabular-nums text-foreground pointer-events-none px-2">
                  {formatTime(item)}
                </p>
                <input
                  type="time"
                  value={`${item.hour.toString().padStart(2, "0")}:${item.minute.toString().padStart(2, "0")}`}
                  onChange={(e) => onTimeChange(i, e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label={t("pr.manage.changeTimeAria", { label: item.label })}
                />
              </div>

              {/* Delete */}
              <button
                onClick={() => onRemove(i)}
                disabled={times.length <= 1}
                aria-label={t("pr.manage.removeAria", { label: item.label })}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-foreground/40 hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground/40 transition-colors flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add another */}
        <button
          onClick={onAdd}
          disabled={atCap}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-[12.5px] font-semibold text-primary/90 transition-colors hover:bg-primary/5 disabled:opacity-40 disabled:hover:bg-transparent"
          style={{ border: "1.5px dashed hsl(var(--primary) / 0.35)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          {atCap ? "Maximum 8 reminders" : "Add reminder"}
        </button>
      </div>


      {/* Troubleshoot primers */}
      {!fsiOk && (
        <button
          onClick={onGrantFsi}
          className="mt-3 flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left"
          style={{
            background: "hsl(var(--primary) / 0.08)",
            border: "1.5px solid hsl(var(--primary) / 0.55)",
          }}
        >
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-extrabold text-foreground">{t("pr.manage.fsi.title")}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-foreground/65">
              Android 14 needs your permission for full-screen alarms. Tap to allow.
            </p>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        </button>
      )}

      {!overlayOk && (
        <button
          onClick={onGrantOverlay}
          className="mt-3 flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-foreground/5"
          style={{ border: "1px dashed hsl(var(--primary) / 0.35)" }}
        >
          <Star className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold text-foreground/90">{t("pr.manage.overlay.title")}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-foreground/55">
              Turn on "Appear on top" so prayer bells pop over the lock screen on every device.
            </p>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground/40" />
        </button>
      )}

      {overlayOk && fsiOk && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-foreground/45">
          <Check className="h-3 w-3 text-primary" />
          Full-screen alarms enabled
        </div>
      )}

      {/* Turn off */}
      <button
        onClick={onDisable}
        className="mt-5 flex w-full items-center justify-center gap-1.5 py-2 text-[12px] font-medium text-foreground/45 hover:text-foreground/70"
      >
        <BellOff className="h-3.5 w-3.5" />
        Turn off prayer bells
      </button>
    </motion.div>
  );
}


/* ───────────────── Success splash ───────────────── */

function SuccessView({ wasEnabled }: { wasEnabled: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-8"
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 16 }}
        className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
          boxShadow: "0 16px 40px -10px hsl(var(--primary) / 0.6)",
        }}
      >
        <Check className="h-10 w-10" style={{ color: "hsl(var(--primary-foreground))" }} strokeWidth={3} />
      </motion.div>
      <h3 className="text-center text-[18px] font-extrabold leading-tight text-foreground">
        {wasEnabled ? "Updated" : "Your prayer bells are set"}
      </h3>
      <p className="mx-auto mt-1.5 max-w-[280px] text-center text-[12.5px] leading-relaxed text-foreground/55">
        We'll gently call you back to Jesus at the times you chose.
      </p>
    </motion.div>
  );
}

function formatTime(t: { hour: number; minute: number }): string {
  const h = t.hour % 12 || 12;
  const m = t.minute.toString().padStart(2, "0");
  const ap = t.hour < 12 ? "AM" : "PM";
  return `${h}:${m} ${ap}`;
}
