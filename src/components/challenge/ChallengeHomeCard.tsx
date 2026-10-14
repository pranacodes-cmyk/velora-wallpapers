import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Flame } from "lucide-react";
import { useT } from "@/i18n";
import { useChallenge } from "@/hooks/useChallenge";
import { useIsLightTheme } from "@/hooks/useIsLightTheme";
import { challengeDay, TASK_IDS } from "@/data/challenge75";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { ChallengeLamp } from "./ChallengeLamp";
import { HERO, TASK_ART } from "./challengeAssets";

/** Home entry for 75 Days of Light (replaces the old Journey card). */
export default function ChallengeHomeCard() {
  const navigate = useNavigate();
  const { t } = useT();
  const light = useIsLightTheme();
  const { state, day, completed, lit, done, streak, tier, intensity } = useChallenge();
  const idle = state.status === "idle";
  const finished = state.status === "finished";
  const plan = challengeDay(day);

  const open = () => {
    haptic("medium");
    track("challenge_home_card_tapped", { status: state.status, day, lit });
    navigate(idle || lit || finished ? "/challenge" : "/challenge/day");
  };

  return (
    <div className="mx-3 mb-6">
      <button
        onClick={open}
        className="relative block w-full overflow-hidden rounded-[26px] border border-primary/30 text-left shadow-[0_22px_50px_-30px_hsl(var(--primary)/0.85)] active:scale-[0.99] transition-transform"
      >
        <img src={light ? HERO.dawn : HERO.night} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
        <div className="relative flex items-center gap-1 p-4 pr-3 text-white">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-amber-200">{t("ch.home.kicker")}</p>
            <h3 className="mt-1 font-serif text-[23px] font-semibold leading-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.5)]">{t("ch.name")}</h3>
            {idle ? (
              <p className="mt-1 text-[13px] leading-snug text-white/80">{t("ch.home.startSub")}</p>
            ) : finished ? (
              <p className="mt-1 text-[13px] font-semibold text-amber-100">{t("ch.home.finished")}</p>
            ) : (
              <>
                <p className="mt-1 line-clamp-1 text-[13.5px] text-white/85">
                  <span className="font-semibold text-amber-100">{t("ch.day", { day: plan.day })}</span> · {plan.title}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-200" style={{ width: `${(completed / 75) * 100}%` }} />
                  </div>
                  <span className="text-[11.5px] font-semibold tabular-nums text-white/75">{completed}/75</span>
                  {streak > 0 && <span className="flex items-center gap-0.5 text-[11.5px] font-bold tabular-nums text-orange-200"><Flame className="h-3 w-3" />{streak}</span>}
                </div>
              </>
            )}
            <div className="mt-3 flex items-center gap-1.5">
              {TASK_IDS.map((id) => {
                const isDone = !idle && done.includes(id);
                return (
                  <span key={id} className={`relative h-7 w-7 shrink-0 overflow-hidden rounded-lg ring-1 ${isDone ? "ring-amber-300" : "ring-white/25"}`}>
                    <img src={TASK_ART[id]} alt="" className={`h-full w-full object-cover ${isDone ? "" : "opacity-75"}`} loading="lazy" />
                    {isDone && <span className="absolute inset-0 grid place-items-center bg-black/35"><Check className="h-3.5 w-3.5 text-amber-200" strokeWidth={3} /></span>}
                  </span>
                );
              })}
              <span className="ml-auto flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] py-1.5 pl-3 pr-2 text-[12.5px] font-bold text-[hsl(var(--paywall-cta-foreground))]">
                {idle ? t("ch.home.start") : t("ch.home.continue")}<ChevronRight className="h-4 w-4" />
              </span>
            </div>
            {lit && !finished && <p className="mt-2 text-[11.5px] text-white/70">{t("ch.home.lit")}</p>}
          </div>
          <div className="-mr-1 w-[104px] shrink-0">
            <ChallengeLamp tier={tier} intensity={idle ? 0.3 : intensity} state={idle ? "ember" : lit || finished ? "lit" : "waiting"} width={104} />
          </div>
        </div>
      </button>
    </div>
  );
}
