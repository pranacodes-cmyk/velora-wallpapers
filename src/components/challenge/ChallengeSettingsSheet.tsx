import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useT } from "@/i18n";
import { haptic } from "@/utils/haptics";
import { resetChallenge, setMode, type ChallengeState } from "@/services/challenge";
import { track } from "@/services/analytics";
import { BottomSheet } from "./BottomSheet";

type Props = { open: boolean; state: ChallengeState; onClose: () => void };

export function ChallengeSettingsSheet({ open, state, onClose }: Props) {
  const { t } = useT();
  const [confirm, setConfirm] = useState(false);

  return (
    <BottomSheet open={open} title={t("ch.hub.settings")} onClose={() => { setConfirm(false); onClose(); }} closeLabel={t("ch.settings.done")}>
      <section>
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
