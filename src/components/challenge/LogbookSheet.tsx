import { useNavigate } from "react-router-dom";
import { useT } from "@/i18n";
import { STAGES } from "@/data/challenge75";
import { haptic } from "@/utils/haptics";
import { BottomSheet } from "./BottomSheet";

type Props = {
  open: boolean;
  completed: number;
  currentDay: number;
  lit: boolean;
  onClose: () => void;
};

/** Every day of the voyage, grouped by island. Completed days reopen for review. */
export function LogbookSheet({ open, completed, currentDay, lit, onClose }: Props) {
  const { t } = useT();
  const navigate = useNavigate();

  return (
    <BottomSheet open={open} title={t("ch.logbook")} onClose={onClose} closeLabel={t("ch.settings.done")}>
      <p className="-mt-2 mb-4 text-[13.5px] text-muted-foreground">{t("ch.hub.completed", { n: completed })}</p>
      <div className="space-y-4">
        {STAGES.map((s, i) => (
          <section key={s.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-[14px] font-semibold text-foreground">{t("ch.island.n", { n: i + 1 })} · {t(`ch.stage.${s.key}`)}</p>
              <p className="text-[12px] tabular-nums text-muted-foreground">{t("ch.stage.range", { from: s.from, to: s.to })}</p>
            </div>
            <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[3px]">
              {Array.from({ length: s.to - s.from + 1 }, (_, k) => s.from + k).map((d) => {
                const got = d <= completed;
                const isToday = !lit && d === currentDay;
                return (
                  <button
                    key={d}
                    disabled={!got && !isToday}
                    aria-label={t("ch.day", { day: d })}
                    onClick={() => {
                      haptic("light");
                      onClose();
                      navigate(got ? `/challenge/day/${d}` : "/challenge/day");
                    }}
                    className={`grid aspect-square place-items-center rounded-[6px] text-[9.5px] font-bold tabular-nums transition-transform active:scale-90 ${
                      got
                        ? "bg-primary text-primary-foreground"
                        : isToday
                          ? "bg-primary/10 text-primary ring-2 ring-primary"
                          : "bg-muted text-muted-foreground/70"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </BottomSheet>
  );
}
