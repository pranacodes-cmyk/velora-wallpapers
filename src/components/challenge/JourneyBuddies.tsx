import { useEffect, useState } from "react";
import { Bell, Check, HandHeart, Share2 } from "lucide-react";
import { useT } from "@/i18n";
import {
  buddiesOf, CIRCLE_EVENT, fetchOverview, getCachedOverview, getIdentity, markCheersSeen, myBuddyCode, sendCheer,
  type Buddy, type CircleOverview,
} from "@/services/challengeCircle";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { nativeShare } from "@/utils/nativeShare";
import { toast } from "sonner";
import { JourneyAvatar } from "./JourneyAvatar";
import { Button } from "@/components/ui/button";

const TOTAL = 75;

/** Journey buddies — friends on the same road, one tap to pray for them. */
export function JourneyBuddies({ onJoin, onNeedProfile, isPremium }: { onJoin: () => void; onNeedProfile: () => void; isPremium: boolean }) {
  const { t } = useT();
  const [overview, setOverview] = useState<CircleOverview | null>(() => getCachedOverview());
  const [busy, setBusy] = useState(false);
  const [prayed, setPrayed] = useState<Set<string>>(new Set());
  const [nudged, setNudged] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sync = () => setOverview(getCachedOverview());
    window.addEventListener(CIRCLE_EVENT, sync);
    if (getIdentity()) fetchOverview().catch(() => {});
    return () => window.removeEventListener(CIRCLE_EVENT, sync);
  }, []);

  const buddies = buddiesOf(overview);
  const cheer = overview?.cheers?.[0];

  const invite = async () => {
    haptic("light");
    if (!getIdentity()) { onNeedProfile(); return; }
    setBusy(true);
    try {
      const code = await myBuddyCode();
      track("challenge_invite_tapped", { buddies: buddies.length });
      await nativeShare({ title: t("ch.name"), text: t("ch.buddy.msg", { code }), dialogTitle: t("ch.invite.cta"), includeAppLink: true });
    } catch {
      toast.error(t("ch.buddy.err"));
    } finally { setBusy(false); }
  };

  const pray = async (b: Buddy) => {
    haptic("medium");
    setPrayed((s) => new Set(s).add(b.id));
    try { await sendCheer(b.circleId, b.id, "pray"); track("challenge_buddy_prayed"); fetchOverview().catch(() => {}); }
    catch { setPrayed((s) => { const n = new Set(s); n.delete(b.id); return n; }); toast.error(t("ch.buddy.err")); }
  };

  const remind = async (b: Buddy) => {
    haptic("light");
    setNudged((s) => new Set(s).add(b.id));
    try {
      await sendCheer(b.circleId, b.id, "nudge");
      track("challenge_buddy_nudged");
      toast.success(t("ch.buddy.remindSent", { name: b.name }));
      fetchOverview().catch(() => {});
    } catch { setNudged((s) => { const n = new Set(s); n.delete(b.id); return n; }); toast.error(t("ch.buddy.err")); }
  };

  return (
    <section className="rounded-[24px] border border-primary/25 bg-card p-4 shadow-[0_18px_40px_-28px_hsl(var(--primary)/0.6)]">
      {cheer && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-primary/10 px-3 py-2.5 ring-1 ring-primary/25">
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-primary/40"><JourneyAvatar avatar={cheer.fromAvatar} /></span>
          <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-foreground">{t(`ch.buddy.${cheer.kind}.got`, { name: cheer.fromName })}</p>
          <Button variant="ghost" onClick={() => { haptic("light"); void markCheersSeen([cheer.id]).catch(() => {}); }}
            className="h-8 shrink-0 rounded-full px-3 text-[12.5px] font-bold text-primary">{t("ch.buddy.amen")}</Button>
        </div>
      )}

      {buddies.length === 0 ? (
        <div className="flex flex-col items-center text-center">
          <div className="flex -space-x-3">
            <span className="relative h-14 w-14 overflow-visible rounded-full ring-[3px] ring-card">
              <span className="block h-14 w-14 overflow-hidden rounded-full"><JourneyAvatar avatar={getIdentity()?.avatar ?? "🐑"} /></span>
              {isPremium && <span className="absolute -bottom-1 -left-1 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-black text-primary-foreground ring-2 ring-card">PRO</span>}
            </span>
            <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-primary/50 bg-primary/5 text-[22px] font-light text-primary ring-[3px] ring-card">+</span>
          </div>
          <h3 className="mt-3 text-[18px] font-semibold text-foreground">{t("ch.buddy.emptyTitle")}</h3>
          <p className="mt-1 max-w-[30ch] text-[13px] leading-relaxed text-muted-foreground">{t("ch.buddy.emptySub")}</p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.16em] text-primary">{t("ch.buddy.title")} · {buddies.length}</p>
          <ul className="divide-y divide-border">
            {buddies.slice(0, 8).map((b) => {
              const done = b.sentToday.includes("pray") || prayed.has(b.id);
              const canNudge = !b.litToday;
              const didNudge = b.sentToday.includes("nudge") || nudged.has(b.id);
              return (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <span className="relative h-11 w-11 shrink-0">
                    <span className="block h-11 w-11 overflow-hidden rounded-full ring-2 ring-border"><JourneyAvatar avatar={b.avatar} label={b.name} /></span>
                    {b.litToday && <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-1.5 text-[14.5px] font-semibold text-foreground"><span className="truncate">{b.name}</span>{b.isPro && <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[8px] font-black text-primary ring-1 ring-primary/30">PRO</span>}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (b.completedDays / TOTAL) * 100)}%` }} /></div>
                      <span className="shrink-0 text-[11.5px] text-muted-foreground">{t("ch.buddy.day", { n: b.completedDays })} · {b.litToday ? t("ch.buddy.done") : t("ch.buddy.notYet")}</span>
                    </div>
                  </div>
                  {canNudge && (
                    <Button variant="ghost" size="icon" disabled={didNudge} onClick={() => remind(b)}
                      aria-label={didNudge ? t("ch.buddy.reminded") : t("ch.buddy.remind")} title={didNudge ? t("ch.buddy.reminded") : t("ch.buddy.remind")}
                      className="h-9 w-9 shrink-0 rounded-full border border-border text-muted-foreground disabled:opacity-50">
                      {didNudge ? <Check className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <Button variant="outline" disabled={done} onClick={() => pray(b)}
                    className="h-9 shrink-0 gap-1.5 rounded-full border-primary/40 px-3 text-[12.5px] font-bold text-primary disabled:opacity-60">
                    {done ? <Check className="h-3.5 w-3.5" /> : <HandHeart className="h-3.5 w-3.5" />}{done ? t("ch.buddy.prayed") : t("ch.buddy.pray")}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Button onClick={invite} disabled={busy}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-bold text-primary-foreground active:scale-[0.985]">
        <Share2 className="h-4 w-4" />{t("ch.invite.cta")}
      </Button>
      <p className="mt-2 text-center text-[11.5px] text-muted-foreground">{t("ch.invite.verse")}</p>
      <Button variant="ghost" onClick={() => { haptic("light"); onJoin(); }} className="mt-1 h-9 w-full text-[13px] font-semibold text-muted-foreground">{t("ch.buddy.haveCode")}</Button>
    </section>
  );
}
