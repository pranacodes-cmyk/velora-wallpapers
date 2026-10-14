import { useState } from "react";
import { Bell, RotateCcw } from "lucide-react";
import { useT } from "@/i18n";
import { haptic } from "@/utils/haptics";
import { resetChallenge, setMode, setReminders, type ChallengeState } from "@/services/challenge";
import { requestChallengeNotificationPermission } from "@/services/challengeReminders";
import { track } from "@/services/analytics";
import { BottomSheet } from "./BottomSheet";

type Props = { open: boolean; state: ChallengeState; onClose: () => void };

const MORNING_TIMES = ["06:00", "07:00", "08:00", "09:00"];

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => { haptic("light"); onToggle(); }}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}

export function ChallengeSettingsSheet({ open, state, onClose }: Props) {
  const { t, lang } = useT();
  const [confirm, setConfirm] = useState(false);
  const r = state.reminders;
  const label = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    try { return new Date(2024, 0, 1, h, m).toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" }); } catch { return hhmm; }
  };

  return (
    <BottomSheet open={open} title={t("ch.hub.settings")} onClose={() => { setConfirm(false); onClose(); }} closeLabel={t("ch.settings.done")}>
      <section className="rounded-2xl border border-border/70 bg-background/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Bell className="h-[18px] w-[18px] text-primary" />
            <span className="text-[15px] font-semibold">{t("ch.settings.reminders")}</span>
          </div>
          <Switch
            on={r.enabled}
            label={t("ch.settings.reminders")}
            onToggle={() => {
              const enabled = !r.enabled;
              setReminders({ enabled });
              if (enabled) void requestChallengeNotificationPermission();
              track("challenge_reminders_toggled", { enabled });
            }}
          />
        </div>
        {r.enabled && (
          <>
            <p className="mb-2 mt-4 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("ch.settings.morning")}</p>
            <div className="grid grid-cols-4 gap-2">
              {MORNING_TIMES.map((time) => (
                <button
                  key={time}
                  onClick={() => { haptic("light"); setReminders({ morning: time }); }}
                  className={`rounded-xl border py-2.5 text-[13.5px] font-semibold tabular-nums ${r.morning === time ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-card text-foreground"}`}
                >
                  {label(time)}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[14px] leading-snug">{t("ch.settings.evening")}</span>
              <Switch on={r.evening} label={t("ch.settings.evening")} onToggle={() => setReminders({ evening: !r.evening })} />
            </div>
          </>
        )}
      </section>

      <section className="mt-4">
        <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("ch.settings.path")}</p>
        <div className="grid grid-cols-2 gap-2">
          {(["grace", "covenant"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { haptic("light"); setMode(m); track("challenge_mode_changed", { mode: m }); }}
              className={`rounded-2xl border p-3 text-left ${state.mode === m ? "border-primary/70 bg-primary/10" : "border-border/70 bg-background/50"}`}
            >
              <p className="text-[14.5px] font-semibold">{t(`ch.mode.${m}.t`)}</p>
              <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-muted-foreground">{t(`ch.mode.${m}.s`)}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5">
        {!confirm ? (
          <button
            onClick={() => { haptic("light"); setConfirm(true); }}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-destructive/40 py-3 text-[14.5px] font-semibold text-destructive"
          >
            <RotateCcw className="h-4 w-4" /> {t("ch.settings.restart")}
          </button>
        ) : (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-[14px] leading-snug">{t("ch.settings.restartConfirm")}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirm(false)} className="rounded-full border border-border py-2.5 text-[14px] font-semibold">{t("ch.circle.cancel")}</button>
              <button
                onClick={() => {
                  haptic("heavy");
                  track("challenge_restarted", { completed: Object.keys(state.completed).length });
                  resetChallenge();
                  setConfirm(false);
                  onClose();
                }}
                className="rounded-full bg-destructive py-2.5 text-[14px] font-semibold text-destructive-foreground"
              >
                {t("ch.settings.confirm")}
              </button>
            </div>
          </div>
        )}
      </section>
    </BottomSheet>
  );
}
