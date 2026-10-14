import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useT } from "@/i18n";
import { useChallenge } from "@/hooks/useChallenge";
import { challengeDay, REQUIRED_TASKS, TASK_IDS } from "@/data/challenge75";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { VoyagePoster } from "./VoyagePoster";

/** Home entry for the Journey: the voyage strip, today's progress and one action. */
export default function ChallengeHomeCard() {
  const navigate = useNavigate();
  const { t } = useT();
  const { state, day, completed, lit, done } = useChallenge();
  const idle = state.status === "idle";
  const finished = state.status === "finished";
  const plan = challengeDay(day);
  const steps = REQUIRED_TASKS.filter((id) => done.includes(id)).length;

  const open = () => {
    haptic("medium");
    track("challenge_home_card_tapped", { status: state.status, day, lit });
    navigate(idle || lit || finished ? "/challenge" : "/challenge/day");
  };

  return (
    <div className="mx-3 mb-6">
      <button
        onClick={open}
        className="block w-full overflow-hidden rounded-xl border border-border/50 bg-card text-left shadow-[0_22px_44px_-30px_hsl(var(--primary)/0.6)] transition-transform active:scale-[0.99]"
      >
        <div className="px-4 pb-3 pt-4">
          <h3 className="text-[20px] font-semibold leading-tight text-foreground">{t("ch.name")}</h3>
          {!idle && <p className="mt-1 text-[12px] text-muted-foreground">{t("ch.hub.daysProgress", { n: completed })}</p>}
        </div>
        <VoyagePoster days={idle ? 0 : completed} label={t("ch.voyage.a11y", { n: completed })} />
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            {idle ? (
              <p className="text-[13.5px] leading-snug text-muted-foreground">{t("ch.home.startSub")}</p>
            ) : finished ? (
              <p className="text-[14px] font-semibold text-foreground">{t("ch.home.finished")}</p>
            ) : (
              <>
                <p className="truncate text-[14.5px] font-semibold text-foreground">
                  {t("ch.day", { day: plan.day })} · <span className="font-normal text-muted-foreground">{plan.title}</span>
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex shrink-0 gap-1" aria-hidden>
                    {TASK_IDS.map((id, i) => (
                      <span key={id} className={`h-1.5 w-4 rounded-full ${(id === "reflect" ? done.includes(id) : i < steps) ? "bg-primary" : "bg-muted"}`} />
                    ))}
                  </div>
                  <span className="line-clamp-2 min-w-0 text-[12px] leading-[1.3] text-muted-foreground">{lit ? t("ch.circle.lit") : t("ch.hub.stepsDone", { n: steps })}</span>
                </div>
              </>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] py-2 pl-3.5 pr-2.5 text-[13px] font-bold text-[hsl(var(--paywall-cta-foreground))]">
            {idle ? t("ch.home.start") : t("ch.home.continue")}<ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </button>
    </div>
  );
}
