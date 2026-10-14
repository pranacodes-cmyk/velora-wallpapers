import { Check } from "lucide-react";
import { useT } from "@/i18n";
import { TASK_IDS, type TaskId } from "@/data/challenge75";
import { TASK_ICON } from "./taskIcons";
import { JourneyInfo } from "./JourneyInfo";
import { Button } from "@/components/ui/button";

type Props = {
  done: TaskId[];
  allDone: boolean;
  subtitles: Record<TaskId, string>;
  onOpen: (id: TaskId) => void;
};

/** Today's four steps as glowing stones on a short path. */
export function TodayPath({ done, allDone, onOpen }: Props) {
  const { t } = useT();
  const isDone = (id: TaskId) => (id === "reflect" ? done.includes(id) : allDone || done.includes(id));
  const requiredCount = TASK_IDS.filter((id) => id !== "reflect" && isDone(id)).length;
  const next = TASK_IDS.find((id) => !isDone(id));

  return (
    <div className="py-1">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div><h2 className="text-[17px] font-semibold text-foreground">{t("ch.hub.steps")}</h2><p className="mt-0.5 text-[12px] text-muted-foreground">{t("ch.hub.stepsDone", { n: requiredCount })}</p></div>
        <JourneyInfo kind="steps" />
      </div>
      <div>
        <ol className="relative grid grid-cols-4">
          {TASK_IDS.map((id) => {
            const d = isDone(id);
            const Icon = TASK_ICON[id];
            const current = id === next;
            return (
              <li key={id} className="flex flex-col items-center">
                <Button variant="ghost" size="icon"
                  onClick={() => onOpen(id)}
                  aria-label={`${t(`ch.task.${id}`)}${d ? ` · ${t("ch.task.done")}` : ""}`}
                  className={`relative grid h-11 w-11 place-items-center rounded-full transition-all active:scale-95 ${
                    d
                      ? "bg-primary text-primary-foreground"
                      : current
                        ? "bg-primary/10 text-primary ring-1 ring-primary/50"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {d ? <Check className="h-5 w-5" strokeWidth={3} /> : <Icon className="h-5 w-5" strokeWidth={1.9} />}
                </Button>
                <span className={`mt-1.5 max-w-full break-words text-center text-[12.5px] font-semibold ${d || current ? "text-foreground" : "text-muted-foreground"}`}>
                  {t(`ch.task.${id}`)}
                  {id === "reflect" && !d && <span className="block text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">{t("ch.task.optional")}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

    </div>
  );
}
