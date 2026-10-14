// Break Free — choose the battle and write an if-then plan.
// Flutter mirror: `flutter_app/lib/screens/projourney/battle_setup.dart`.
import { useState } from "react";
import { Lock } from "lucide-react";
import { useT } from "@/i18n";
import { BATTLE_EMOJI, BATTLES, type Battle } from "@/data/proJourneys";
import { setBattle, setPlan } from "@/services/proJourneys";
import { haptic } from "@/utils/haptics";
import { track } from "@/services/analytics";
import { Button } from "@/components/ui/button";
import { useProJourneys } from "./useProJourneys";

export function BattleSetup({ onSaved }: { onSaved?: () => void }) {
  const { t } = useT();
  const store = useProJourneys();
  const [battle, setLocalBattle] = useState<Battle | null>(store.freedom.battle);
  const [when, setWhen] = useState(store.freedom.when);
  const [then, setThen] = useState(store.freedom.then);
  const ready = Boolean(battle) && when.trim().length >= 2 && then.trim().length >= 2;

  return (
    <div>
      <p className="text-[17px] font-semibold leading-snug text-foreground">{t("pj.fr.pick")}</p>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{t("pj.fr.pickSub")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {BATTLES.map((b) => {
          const on = battle === b;
          return (
            <button
              key={b}
              type="button"
              aria-pressed={on}
              onClick={() => { haptic("light"); setLocalBattle(b); }}
              className={`flex min-h-[48px] items-center gap-2 rounded-2xl px-3 py-2 text-left text-[13.5px] font-semibold leading-tight transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-background/60 text-foreground ring-1 ring-border/70"} ${b === "other" ? "col-span-2" : ""}`}
            >
              <span aria-hidden className="text-[18px]">{BATTLE_EMOJI[b]}</span>
              <span className="min-w-0">{t(`pj.fr.b.${b}`)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><Lock className="h-3 w-3" />{t("pj.fr.private")}</p>

      <div className="mt-5 rounded-[20px] border border-primary/25 bg-primary/[0.06] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t("pj.fr.planTitle")}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{t("pj.fr.planHint")}</p>
        <label className="mt-3 block text-[13px] font-bold text-foreground">{t("pj.fr.when")}</label>
        <input
          value={when}
          onChange={(e) => setWhen(e.target.value.slice(0, 120))}
          placeholder={t("pj.fr.whenPh")}
          className="mt-1 h-11 w-full rounded-xl border border-border/70 bg-background/70 px-3 text-[14.5px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
        />
        <label className="mt-3 block text-[13px] font-bold text-foreground">{t("pj.fr.then")}</label>
        <input
          value={then}
          onChange={(e) => setThen(e.target.value.slice(0, 120))}
          placeholder={t("pj.fr.thenPh")}
          className="mt-1 h-11 w-full rounded-xl border border-border/70 bg-background/70 px-3 text-[14.5px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
        />
        <Button
          disabled={!ready}
          onClick={() => {
            if (!battle) return;
            haptic("medium");
            setBattle(battle);
            setPlan(when, then);
            track("pro_journey_plan_saved", { battle });
            onSaved?.();
          }}
          className="mt-4 w-full rounded-full py-3 text-[14.5px] font-bold"
        >
          {t("pj.fr.save")}
        </Button>
      </div>
    </div>
  );
}
