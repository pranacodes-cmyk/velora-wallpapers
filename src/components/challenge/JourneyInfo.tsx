import { Info } from "lucide-react";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TASK_IDS, STAGES } from "@/data/challenge75";
import { TASK_ICON } from "./taskIcons";

export function JourneyInfo({ kind }: { kind: "steps" | "badges" | "lamb" }) {
  const { t } = useT();
  const title = t(kind === "steps" ? "ch.hub.steps" : kind === "lamb" ? "ch.help.lambTitle" : "ch.hub.badges");
  return <Dialog>
    <DialogTrigger asChild>
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-primary" aria-label={`${title} · ${t("ch.intro.how")}`} title={t("ch.intro.how")}><Info className="h-[18px] w-[18px]" /></Button>
    </DialogTrigger>
    <DialogContent className="w-[calc(100%-24px)] max-h-[85dvh] overflow-y-auto rounded-[20px] border-border bg-card p-5">
      <DialogTitle className="pr-7 leading-snug tracking-normal">{title}</DialogTitle>
      <DialogDescription className="leading-relaxed">{t(`ch.help.${kind}`)}</DialogDescription>
      {kind === "steps" && <ol className="space-y-4">{TASK_IDS.map(id => {
        const Icon = TASK_ICON[id];
        return <li key={id} className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><div><h3 className="text-sm font-semibold">{t(`ch.task.${id}`)}{id === "reflect" && <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{t("ch.task.optional")}</span>}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`ch.help.${id}`)}</p></div></li>;
      })}</ol>}
      {kind === "badges" && <ol className="space-y-3">{STAGES.map(s => <li key={s.key} className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{s.to}</span><div><h3 className="text-sm font-semibold">{t(`ch.stage.${s.key}`)}</h3><p className="text-sm text-muted-foreground">{t("ch.stage.range", { from: s.from, to: s.to })}</p></div></li>)}</ol>}
    </DialogContent>
  </Dialog>;
}