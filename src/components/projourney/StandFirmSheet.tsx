// Break Free — the 90-second rescue: breathe, read 1 Corinthians 10:13,
// remember your plan and take one way out.
// Flutter mirror: `flutter_app/lib/screens/projourney/stand_firm_sheet.dart`.
import { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { useT } from "@/i18n";
import { SOS_PASSAGE } from "@/data/proJourneys";
import { recordSos } from "@/services/proJourneys";
import { haptic } from "@/utils/haptics";
import { track } from "@/services/analytics";
import { BottomSheet } from "@/components/challenge/BottomSheet";
import { Button } from "@/components/ui/button";
import { BreathPrayer } from "./BreathPrayer";
import { PassageCard } from "./PassageCard";
import { useProJourneys } from "./useProJourneys";

export function StandFirmSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const store = useProJourneys();
  const [won, setWon] = useState(false);
  const close = () => { setWon(false); onClose(); };
  const plan = store.freedom.when && store.freedom.then
    ? t("pj.fr.planLine", { when: store.freedom.when, then: store.freedom.then })
    : "";

  return (
    <BottomSheet open={open} title={t("pj.sos.title")} onClose={close} closeLabel={t("pj.close")}>
      {won ? (
        <div className="challenge-rise py-6 text-center">
          <span className="challenge-pop mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] text-[hsl(var(--paywall-cta-foreground))]">
            <ShieldCheck className="h-10 w-10" />
          </span>
          <p className="mx-auto mt-4 max-w-[280px] font-serif text-[22px] font-semibold leading-snug text-foreground">{t("pj.sos.won")}</p>
          <Button onClick={close} className="mt-6 w-full rounded-full py-3.5 text-[15px] font-bold">{t("pj.cele.done")}</Button>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="-mt-2 text-[14px] text-muted-foreground">{t("pj.sos.sub")}</p>
          <BreathPrayer cycles={6} onComplete={() => track("pro_journey_sos_breathed")} />
          <PassageCard passage={SOS_PASSAGE} size="sm" />
          {plan && (
            <div className="rounded-2xl bg-background/60 p-4 ring-1 ring-border/60">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t("pj.fr.yourPlan")}</p>
              <p className="mt-1 text-[15px] font-semibold leading-snug text-foreground">{plan}</p>
            </div>
          )}
          <div>
            <p className="text-[13px] font-bold text-foreground">{t("pj.sos.after")}</p>
            <ul className="mt-2 space-y-1.5">
              {["a1", "a2", "a3", "a4"].map((k) => (
                <li key={k} className="flex items-center gap-2.5 text-[14px] text-foreground/90">
                  <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.6} />{t(`pj.sos.${k}`)}
                </li>
              ))}
            </ul>
          </div>
          <Button
            onClick={() => { haptic("heavy"); recordSos(); track("pro_journey_sos_won"); setWon(true); }}
            className="w-full rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] py-3.5 text-[15px] font-extrabold text-[hsl(var(--paywall-cta-foreground))]"
          >
            <ShieldCheck className="h-[18px] w-[18px]" />{t("pj.sos.done")}
          </Button>
          <p className="text-center text-[11.5px] leading-relaxed text-muted-foreground">{t("pj.fr.help")}</p>
        </div>
      )}
    </BottomSheet>
  );
}
