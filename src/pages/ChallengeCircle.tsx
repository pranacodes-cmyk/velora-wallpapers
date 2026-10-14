import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronLeft, Copy, Flame, HandHeart, Loader2, LogOut, Plus, Share2, ThumbsUp, BellRing } from "lucide-react";
import { useT } from "@/i18n";
import { useChallenge } from "@/hooks/useChallenge";
import { lampTierFor } from "@/data/challenge75";
import { inviteText, leaveCircle, sendCheer, type CheerKind, type CircleMember } from "@/services/challengeCircle";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { nativeShare } from "@/utils/nativeShare";
import { CircleSheets, type CircleFlow } from "@/components/challenge/CircleSheets";
import { circleErrorKey, useCircles } from "@/components/challenge/useCircles";
import { CIRCLE_ART, LAMPS } from "@/components/challenge/challengeAssets";
import { toast } from "sonner";

const CHEERS: { kind: CheerKind; icon: typeof ThumbsUp; label: string }[] = [
  { kind: "cheer", icon: ThumbsUp, label: "ch.circle.cheer" },
  { kind: "pray", icon: HandHeart, label: "ch.circle.pray" },
  { kind: "nudge", icon: BellRing, label: "ch.circle.nudge" },
];

function MemberRow({ m, rank, circleId, onSent }: { m: CircleMember; rank: number; circleId: string; onSent: () => void }) {
  const { t } = useT();
  const [busy, setBusy] = useState<CheerKind | null>(null);
  const [sent, setSent] = useState<string[]>(m.sentToday);
  useEffect(() => setSent((prev) => Array.from(new Set([...prev, ...m.sentToday]))), [m.sentToday]);
  const lamp = LAMPS[lampTierFor(m.completedDays)];
  const status = !m.started ? t("ch.circle.notStarted") : m.litToday ? t("ch.circle.lit") : t("ch.circle.progress", { n: m.todayDone });

  const cheer = async (kind: CheerKind) => {
    if (busy || sent.includes(kind)) return;
    setBusy(kind);
    haptic("light");
    try {
      await sendCheer(circleId, m.id, kind);
      setSent((s) => [...s, kind]);
      track("challenge_cheer_sent", { kind });
      toast(t("ch.cheer.sent", { name: m.name }));
      onSent();
    } catch (err) {
      toast(t(circleErrorKey(err)));
    } finally {
      setBusy(null);
    }
  };

  // Nudge only makes sense when the person hasn't lit today.
  const options = CHEERS.filter((c) => c.kind !== "nudge" || (m.started && !m.litToday));

  return (
    <li className={`rounded-2xl border p-3.5 ${m.isMe ? "border-primary/45 bg-primary/[0.07]" : "border-border/60 bg-card"}`}>
      <div className="flex items-center gap-3">
        <span className="w-5 text-center text-[13px] font-bold tabular-nums text-muted-foreground">{rank}</span>
        <div className="relative">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-muted text-[20px]">{m.avatar}</span>
          {m.litToday && <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card"><Flame className="h-3 w-3" /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {m.name}{m.isMe && <span className="ml-1.5 text-[12px] font-semibold text-primary">· {t("ch.circle.you")}</span>}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <span className="tabular-nums">{t("ch.day", { day: m.completedDays })}</span>
            {m.streak > 0 && <span className="flex items-center gap-0.5 tabular-nums"><Flame className="h-3 w-3 text-orange-400" />{m.streak}</span>}
            <span className={`truncate ${m.litToday ? "font-semibold text-primary" : ""}`}>{status}</span>
          </p>
        </div>
        <img src={lamp.src} alt="" className={`h-8 w-12 shrink-0 object-contain ${m.started ? "" : "opacity-35 grayscale"}`} loading="lazy" />
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))]" style={{ width: `${(m.completedDays / 75) * 100}%` }} />
      </div>
      {!m.isMe && (
        <div className="mt-3 flex gap-2">
          {options.map(({ kind, icon: Icon, label }) => {
            const done = sent.includes(kind);
            return (
              <button
                key={kind}
                disabled={done || busy !== null}
                onClick={() => void cheer(kind)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border py-2 text-[12.5px] font-semibold transition-colors ${
                  done ? "border-primary/40 bg-primary/10 text-primary" : "border-border/70 text-foreground active:bg-muted"
                }`}
              >
                {busy === kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span className="truncate">{done ? t("ch.circle.sent") : t(label)}</span>
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}

export default function ChallengeCircle() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { t } = useT();
  useChallenge(); // keeps own progress synced while here
  const { identity, overview, loading, error, refresh, setOverview } = useCircles();
  const joinCode = params.get("join") ?? "";
  const [flow, setFlow] = useState<CircleFlow>(joinCode ? "join" : null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const circles = overview?.circles ?? [];
  const selectedId = params.get("id") ?? circles[0]?.id ?? null;
  const circle = circles.find((c) => c.id === selectedId) ?? circles[0] ?? null;

  useEffect(() => { track("challenge_circle_viewed", { circles: circles.length }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setConfirmLeave(false); }, [circle?.id]);

  const ranked = useMemo(
    () => [...(circle?.members ?? [])].sort((a, b) => b.completedDays - a.completedDays || b.streak - a.streak || Number(b.litToday) - Number(a.litToday)),
    [circle],
  );

  const select = (id: string) => { haptic("light"); setParams({ id }, { replace: true }); };

  const share = () => {
    if (!circle) return;
    haptic("light");
    track("challenge_invite_shared", { members: circle.members.length });
    void nativeShare({ title: t("ch.name"), text: inviteText(circle.name, circle.code, t), includeAppLink: true });
  };

  const copy = async () => {
    if (!circle) return;
    try { await navigator.clipboard.writeText(circle.code); } catch { /* clipboard blocked */ }
    haptic("light");
    toast(t("ch.circle.copied"));
  };

  const leave = async () => {
    if (!circle) return;
    try {
      const next = await leaveCircle(circle.id);
      setOverview(next);
      track("challenge_circle_left");
      setParams({}, { replace: true });
      if (!next.circles.length) navigate("/challenge", { replace: true });
    } catch (err) {
      toast(t(circleErrorKey(err)));
    }
  };

  return (
    <div className="scroll-container h-full overflow-y-auto bg-background pb-[calc(112px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-background/95 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <button onClick={() => navigate("/challenge")} aria-label={t("ch.back")} className="grid h-10 w-10 place-items-center rounded-full bg-card ring-1 ring-border/60 active:scale-95">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center font-serif text-[19px] font-semibold text-foreground">{t("ch.circle.title")}</h1>
        <button onClick={() => setFlow("create")} aria-label={t("ch.circle.add")} className="grid h-10 w-10 place-items-center rounded-full bg-card ring-1 ring-border/60 active:scale-95">
          <Plus className="h-5 w-5 text-foreground" />
        </button>
      </header>

      <main className="mx-auto max-w-[540px] space-y-4 px-4 pt-2">
        {circles.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {circles.map((c) => (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-semibold ${c.id === circle?.id ? "border-primary bg-primary/15 text-foreground" : "border-border/70 text-muted-foreground"}`}
              >
                <span>{c.emoji}</span><span className="max-w-[140px] truncate">{c.name}</span>
              </button>
            ))}
          </div>
        )}

        {!circle ? (
          <div className="overflow-hidden rounded-[26px] border border-border/60 bg-card">
            <img src={CIRCLE_ART} alt="" className="h-44 w-full object-cover" />
            <div className="p-5">
              {loading && identity ? (
                <p className="flex items-center gap-2 text-[14px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("ch.circle.loading")}</p>
              ) : (
                <>
                  <p className="font-serif text-[22px] font-semibold text-foreground">{t("ch.circle.empty.t")}</p>
                  <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{t("ch.circle.empty.s")}</p>
                  {error && (
                    <p className="mt-3 text-[13px] text-destructive">
                      {t(error)} <button onClick={() => void refresh()} className="font-bold underline">{t("ch.circle.retry")}</button>
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button onClick={() => setFlow("create")} className="rounded-full bg-primary py-3 text-[14px] font-bold text-primary-foreground">{t("ch.circle.create")}</button>
                    <button onClick={() => setFlow("join")} className="rounded-full border border-border py-3 text-[14px] font-bold text-foreground">{t("ch.circle.join")}</button>
                  </div>
                  <p className="mt-3 text-[12px] leading-snug text-muted-foreground">{t("ch.circle.privacy")}</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Circle flame */}
            <section className="relative overflow-hidden rounded-[28px] border border-primary/30 bg-card p-5">
              <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
              <div className="relative flex items-center gap-3.5">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-[28px]">{circle.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-serif text-[23px] font-semibold leading-tight text-foreground">{circle.name}</h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{t("ch.circle.members", { n: circle.members.length })} · {t("ch.circle.litToday", { n: circle.litToday, total: circle.members.length })}</p>
                </div>
              </div>
              <div className="relative mt-4">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground"><Flame className="h-4 w-4 text-primary" />{t("ch.circle.flame")}</span>
                  <span className="tabular-nums text-muted-foreground">{t("ch.circle.flameSub", { days: circle.totalDays })}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-[hsl(var(--premium-gold))] to-yellow-200 shadow-[0_0_14px_hsl(var(--primary)/0.7)] transition-[width] duration-700" style={{ width: `${Math.max(2, circle.flame * 100)}%` }} />
                </div>
                <div className="mt-3 flex -space-x-2">
                  {circle.members.map((m) => (
                    <span key={m.id} title={m.name} className={`grid h-9 w-9 place-items-center rounded-full border-2 border-card text-[16px] ${m.litToday ? "bg-primary/30 ring-2 ring-primary/60" : "bg-muted opacity-70"}`}>{m.avatar}</span>
                  ))}
                </div>
              </div>
            </section>

            {/* Invite */}
            <section className="rounded-[24px] border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{t("ch.circle.code")}</p>
                  <p className="mt-0.5 font-mono text-[26px] font-bold tracking-[0.25em] text-foreground">{circle.code}</p>
                </div>
                <button onClick={() => void copy()} aria-label={t("ch.circle.copy")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border/70 text-foreground active:scale-95">
                  <Copy className="h-[18px] w-[18px]" />
                </button>
              </div>
              <button onClick={share} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] py-3.5 text-[15px] font-bold text-[hsl(var(--paywall-cta-foreground))] active:scale-[0.985]">
                <Share2 className="h-[18px] w-[18px]" />{t("ch.circle.invite")}
              </button>
            </section>

            {/* Members */}
            <ol className="space-y-2.5">
              {ranked.map((m, i) => (
                <MemberRow key={m.id} m={m} rank={i + 1} circleId={circle.id} onSent={() => void refresh()} />
              ))}
            </ol>

            <div className="pt-2">
              {!confirmLeave ? (
                <button onClick={() => setConfirmLeave(true)} className="flex w-full items-center justify-center gap-2 py-3 text-[13.5px] font-semibold text-muted-foreground">
                  <LogOut className="h-4 w-4" />{t("ch.circle.leave")}
                </button>
              ) : (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
                  <p className="text-[14px] text-foreground">{t("ch.circle.leaveConfirm", { name: circle.name })}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => setConfirmLeave(false)} className="rounded-full border border-border py-2.5 text-[14px] font-semibold text-foreground">{t("ch.circle.cancel")}</button>
                    <button onClick={() => void leave()} className="rounded-full bg-destructive py-2.5 text-[14px] font-semibold text-destructive-foreground">{t("ch.circle.leave")}</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <CircleSheets
        flow={flow}
        initialCode={joinCode}
        onClose={() => { setFlow(null); if (joinCode) setParams({}, { replace: true }); }}
        onDone={(id) => { setFlow(null); setParams({ id }, { replace: true }); }}
      />
    </div>
  );
}
