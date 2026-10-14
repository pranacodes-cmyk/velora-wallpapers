import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, Check, ChevronDown, ChevronLeft, HandHeart, Lock, PenLine, RotateCcw, Sparkles } from "lucide-react";
import { useT } from "@/i18n";
import { useChallenge } from "@/hooks/useChallenge";
import { usePremium } from "@/hooks/usePremium";
import { challengeDay, REQUIRED_TASKS, stageForDay, type TaskId } from "@/data/challenge75";
import { CHALLENGE_AD_FLAG, completeTask, readJournal, saveJournal, undoTask, type CompletionResult } from "@/services/challenge";
import { syncChallengeReminders } from "@/services/challengeReminders";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { nativeShare } from "@/utils/nativeShare";
import { maybeRequestRating } from "@/services/rating";
import { CelebrationOverlay } from "@/components/challenge/CelebrationOverlay";
import { HoldButton } from "@/components/challenge/HoldButton";
import { TASK_ICON } from "@/components/challenge/taskIcons";
import { setVoyageSeen } from "@/components/challenge/voyage";
import { useChapter } from "@/components/challenge/useReading";
import { Button } from "@/components/ui/button";

type Mode = "today" | "review" | "locked";

function TaskGlyph({ id, done }: { id: TaskId; done: boolean }) {
  const Icon = TASK_ICON[id];
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${done ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
      <Icon className="h-5 w-5" strokeWidth={1.9} />
    </span>
  );
}

function TaskCard({
  id, title, sub, done, children, onUndo, undoLabel, doneLabel, badge,
}: {
  id: TaskId; title: string; sub: string; done: boolean; children: React.ReactNode;
  onUndo?: () => void; undoLabel: string; doneLabel: string; badge?: string;
}) {
  return (
    <section
      id={`task-${id}`}
      className={`relative scroll-mt-24 overflow-hidden rounded-[20px] border bg-card transition-colors ${done ? "border-primary/45" : "border-border/60"}`}
    >
      {done && <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />}
      <header className="relative flex items-center gap-3 p-3.5 pb-0">
        <TaskGlyph id={id} done={done} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold leading-tight text-foreground">
            {title}
            {badge && <span className="ml-2 inline-block rounded-full bg-muted px-2 py-0.5 align-[2px] text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{badge}</span>}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{sub}</p>
        </div>
        {done ? (
          <div className="flex flex-col items-end gap-1">
            <span className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[12px] font-bold text-primary-foreground">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />{doneLabel}
            </span>
            {onUndo && (
              <button onClick={onUndo} className="flex items-center gap-1 text-[11.5px] font-semibold text-muted-foreground">
                <RotateCcw className="h-3 w-3" />{undoLabel}
              </button>
            )}
          </div>
        ) : (
          <span className="h-7 w-7 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/40" aria-hidden />
        )}
      </header>
      <div className="relative p-3.5">{children}</div>
    </section>
  );
}

const goldBtn =
  "flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-bold text-primary-foreground active:scale-[0.985] disabled:opacity-45";

export default function ChallengeDay() {
  const navigate = useNavigate();
  const params = useParams<{ n?: string }>();
  const [search] = useSearchParams();
  const focusTask = search.get("task");
  const { t, lang } = useT();
  const { isPremium } = usePremium();
  const view = useChallenge();
  const { state, completed, lit, done } = view;

  const requested = params.n ? Number(params.n) : null;
  const dayNumber = requested && Number.isFinite(requested) ? Math.min(75, Math.max(1, requested)) : view.day;
  const mode: Mode = useMemo(() => {
    if (state.status === "idle") return "locked";
    // Today stays in "today" mode even after lighting, so the optional
    // reflection can still be recorded.
    if (dayNumber === view.day && state.status === "active") return "today";
    if (state.completed[String(dayNumber)]) return "review";
    return "locked";
  }, [state, dayNumber, view.day]);

  const plan = challengeDay(dayNumber);
  const stage = stageForDay(dayNumber);
  const chapter = useChapter(lang, plan);
  // Reflection is optional: on today's page, show exactly what was completed.
  const isToday = dayNumber === view.day && state.status === "active";
  const isDone = (id: TaskId) => (isToday ? done.includes(id) : mode === "review");

  const [readOpen, setReadOpen] = useState(false);
  const [readEnd, setReadEnd] = useState(false);
  const [note, setNote] = useState(() => readJournal()[String(dayNumber)] ?? "");
  const [noteSaved, setNoteSaved] = useState(false);
  const [celebration, setCelebration] = useState<CompletionResult | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setNote(readJournal()[String(dayNumber)] ?? ""); setReadOpen(false); setReadEnd(false); }, [dayNumber]);
  useEffect(() => { track("challenge_day_viewed", { day: dayNumber, mode }); }, [dayNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opened from a step on the Journey hub: bring that step into view.
  useEffect(() => {
    if (!focusTask || focusTask === "read") return;
    const timer = setTimeout(() => document.getElementById(`task-${focusTask}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    return () => clearTimeout(timer);
  }, [focusTask]);

  useEffect(() => {
    if (!readOpen || chapter.status !== "ready" || !endRef.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setReadEnd(true);
    }, { threshold: 0.6 });
    io.observe(endRef.current);
    return () => io.disconnect();
  }, [readOpen, chapter.status]);

  const finishTask = (id: TaskId) => {
    if (done.includes(id)) return;
    if (mode !== "today" && !(isToday && id === "reflect")) return;
    const result = completeTask(id, isPremium);
    haptic(result.lit ? "heavy" : "medium");
    track("challenge_task_done", { task: id, day: plan.day });
    if (result.lit) {
      track("challenge_day_lit", { day: result.day, streak: result.streak, mode: state.mode, finished: result.finished });
      setCelebration(result);
    } else {
      const next = (["read", "pray", "live", "reflect"] as TaskId[]).find((x) => x !== id && !done.includes(x));
      if (next) setTimeout(() => document.getElementById(`task-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 280);
    }
    void syncChallengeReminders(t);
  };

  const undo = (id: TaskId) => { haptic("light"); undoTask(id); };

  const keyVerse = chapter.status === "ready" ? chapter.verses[plan.verse - 1] : "";
  const ref = chapter.bookName ? `${chapter.bookName} ${plan.chapter}` : "";
  const keyRef = chapter.bookName ? `${chapter.bookName} ${plan.chapter}:${plan.verse}` : "";
  const requiredDone = REQUIRED_TASKS.filter((id) => done.includes(id)).length;
  const doneCount = mode === "review" ? 3 : requiredDone;
  const back = () => navigate("/challenge", { replace: false });

  if (state.status === "idle") return <Navigate to="/challenge" replace />;

  if (mode === "locked") {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background px-8 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-muted"><Lock className="h-7 w-7 text-muted-foreground" /></div>
        <h1 className="mt-4 font-serif text-[24px] font-semibold text-foreground">{t("ch.day", { day: dayNumber })}</h1>
        <p className="mt-2 max-w-xs text-[14.5px] leading-relaxed text-muted-foreground">
          {lit && dayNumber === completed + 1
            ? t("ch.lit.rest")
            : t("ch.d.locked", { day: dayNumber, prev: Math.max(1, dayNumber - 1) })}
        </p>
        <button onClick={back} className="mt-6 rounded-full border border-border px-6 py-3 text-[14.5px] font-semibold text-foreground">{t("ch.back")}</button>
      </div>
    );
  }

  const litOn = state.completed[String(dayNumber)];
  const litOnLabel = litOn ? new Date(`${litOn}T12:00:00`).toLocaleDateString(lang, { day: "numeric", month: "long" }) : "";

  return (
    <div className="scroll-container h-full overflow-y-auto bg-background pb-[calc(40px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-background/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={back} aria-label={t("ch.back")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card ring-1 ring-border/60 active:scale-95">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-foreground">{t("ch.dayOf", { day: dayNumber })}</p>
            <p className="text-[12px] text-muted-foreground">
              {mode === "review" ? t("ch.d.review", { date: litOnLabel }) : t("ch.d.progress", { n: doneCount })}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-colors duration-500 ${(i < 3 ? i < doneCount : mode === "review" || done.includes("reflect")) ? "bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))]" : "bg-muted"}`} />
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[560px] space-y-3 px-4 pt-1">
        {/* Day intro */}
        <section className="challenge-rise px-1 pb-1 pt-1">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.2em] text-primary">{t(`ch.stage.${stage.key}`)} · {t("ch.day", { day: dayNumber })}</p>
          <h1 className="mt-1 font-serif text-[26px] font-semibold leading-[1.1] text-foreground [text-wrap:balance]">{plan.title}</h1>
          <p className="mt-2 text-[14px] leading-snug text-foreground/80 [text-wrap:pretty]">{plan.insight}</p>
        </section>

        {/* 1 · Read */}
        <TaskCard id="read" title={t("ch.task.read")} sub={ref || t("ch.task.read.sub")} done={isDone("read")} doneLabel={t("ch.task.done")} undoLabel={t("ch.task.undo")} onUndo={mode === "today" ? () => undo("read") : undefined}>
          {chapter.status === "loading" && <p className="text-[14px] text-muted-foreground">{t("ch.read.loading")}</p>}
          {chapter.status === "error" && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] text-muted-foreground">{t("ch.read.error")}</p>
              <button onClick={chapter.retry} className="text-[13.5px] font-bold text-primary">{t("ch.read.retry")}</button>
            </div>
          )}
          {chapter.status === "ready" && (
            <>
              <figure className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3.5">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-primary">{t("ch.read.keyVerse")}</p>
                <blockquote className="mt-1.5 font-serif text-[18px] leading-relaxed text-foreground">“{keyVerse}”</blockquote>
                <figcaption className="mt-1.5 text-[12.5px] font-semibold text-muted-foreground">{keyRef}</figcaption>
              </figure>
              {!readOpen ? (
                <button onClick={() => { haptic("light"); setReadOpen(true); track("challenge_chapter_opened", { day: dayNumber }); }} className={`mt-3.5 ${isDone("read") ? "flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-[14.5px] font-semibold text-foreground" : goldBtn}`}>
                  <BookOpen className="h-[18px] w-[18px]" />{t("ch.read.btn", { ref })}
                </button>
              ) : (
                <div className="mt-4">
                  <article className="rounded-2xl bg-background/60 px-4 py-4 ring-1 ring-border/50">
                    <h3 className="mb-3 font-serif text-[21px] font-semibold text-foreground">{ref}</h3>
                    <div className="space-y-2.5 font-serif text-[17px] leading-[1.75] text-foreground/90">
                      {chapter.verses.map((v, i) => (
                        <p key={i} className={i + 1 === plan.verse ? "-mx-2 rounded-lg bg-primary/10 px-2" : undefined}>
                          <sup className="mr-1 font-sans text-[10.5px] font-bold text-primary">{i + 1}</sup>{v}
                        </p>
                      ))}
                    </div>
                    <div ref={endRef} className="h-2" />
                  </article>
                  <div className="mt-3.5">
                    {!isDone("read") ? (
                      <>
                        <button disabled={!readEnd} onClick={() => finishTask("read")} className={goldBtn}>
                          <Check className="h-[18px] w-[18px]" />{t("ch.read.done")}
                        </button>
                        {!readEnd && <p className="mt-2 text-center text-[12.5px] text-muted-foreground">{t("ch.read.hint")}</p>}
                      </>
                    ) : (
                      <button onClick={() => setReadOpen(false)} className="flex w-full items-center justify-center gap-1.5 py-2 text-[13.5px] font-semibold text-muted-foreground">
                        <ChevronDown className="h-4 w-4 rotate-180" />{t("ch.read.hide")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </TaskCard>

        {/* 2 · Pray */}
        <TaskCard id="pray" title={t("ch.task.pray")} sub={t("ch.task.pray.sub")} done={isDone("pray")} doneLabel={t("ch.task.done")} undoLabel={t("ch.task.undo")} onUndo={mode === "today" ? () => undo("pray") : undefined}>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-primary">{t("ch.pray.focus")}</p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-foreground">{plan.focus}</p>
          <div className="mt-2.5 rounded-xl bg-background/60 p-3.5 ring-1 ring-border/50">
            <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground"><HandHeart className="h-3.5 w-3.5" />{t("ch.pray.withMe")}</p>
            <p className="font-serif text-[16px] italic leading-[1.55] text-foreground/90">{plan.prayer}</p>
          </div>
          {!isDone("pray") && (
            <div className="mt-3.5">
              <HoldButton label={t("ch.pray.hold")} holdingLabel={t("ch.pray.amen")} onComplete={() => finishTask("pray")} durationMs={1600} />
            </div>
          )}
        </TaskCard>

        {/* 3 · Live it */}
        <TaskCard id="live" title={t("ch.task.live")} sub={t("ch.task.live.sub")} done={isDone("live")} doneLabel={t("ch.task.done")} undoLabel={t("ch.task.undo")} onUndo={mode === "today" ? () => undo("live") : undefined}>
          <p className="text-[10.5px] font-bold uppercase tracking-normal text-primary">{t("ch.live.title", { day: String(plan.day).padStart(2, "0") })}</p>
          <h2 className="mt-2 text-[22px] font-semibold leading-snug text-foreground">{plan.missionTitle} <span aria-hidden>{plan.missionEmoji}</span></h2>
          <p className="mt-2 text-[15px] leading-relaxed text-foreground/90">{plan.how}</p>
          <div className="mt-4 border-l-2 border-primary/50 pl-3">
            <p className="text-[12px] font-semibold text-primary">{t("ch.live.why")}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{plan.missionWhy}</p>
          </div>
          {!isDone("live") && (
            <>
              <Button variant="outline" onClick={() => finishTask("live")} className="mt-4 h-auto min-h-12 w-full justify-start gap-3 whitespace-normal rounded-lg border-primary/40 py-3 text-left text-[14px] font-semibold text-foreground">
                <span className="h-5 w-5 shrink-0 rounded border-2 border-primary" aria-hidden />{t("ch.live.done")}
              </Button>
              <p className="mt-2 text-center text-[12.5px] text-muted-foreground">{t("ch.live.later")}</p>
            </>
          )}
        </TaskCard>

        {/* 4 · Reflect */}
        <TaskCard id="reflect" title={t("ch.task.reflect")} sub={t("ch.task.reflect.sub")} badge={t("ch.task.optional")} done={isDone("reflect")} doneLabel={t("ch.task.done")} undoLabel={t("ch.task.undo")} onUndo={mode === "today" ? () => undo("reflect") : undefined}>
          <p className="font-serif text-[18px] leading-snug text-foreground">{plan.question}</p>
          <textarea
            value={note}
            onChange={(e) => { setNote(e.target.value.slice(0, 600)); setNoteSaved(false); }}
            placeholder={t("ch.reflect.placeholder")}
            rows={3}
            className="mt-3 w-full resize-none rounded-2xl border border-border/70 bg-background/60 p-3.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><PenLine className="h-3.5 w-3.5" />{t("ch.reflect.private")}</p>
            {(isDone("reflect") || mode === "review") && note.trim() && (
              <button
                onClick={() => { saveJournal(dayNumber, note.trim()); setNoteSaved(true); haptic("light"); }}
                className="text-[13px] font-bold text-primary"
              >
                {noteSaved ? t("ch.reflect.saved") : t("ch.reflect.save")}
              </button>
            )}
          </div>
          {!isDone("reflect") && (
            <button
              disabled={note.trim().length < 3}
              onClick={() => { saveJournal(dayNumber, note.trim()); setNoteSaved(true); finishTask("reflect"); }}
              className={`mt-3 ${goldBtn}`}
            >
              <Check className="h-[18px] w-[18px]" />{t("ch.reflect.save")}
            </button>
          )}
        </TaskCard>

        <p className="px-4 pt-2 text-center font-serif text-[13px] italic text-muted-foreground">
          “{t("ch.verse")}”<span className="mt-1 block text-[12px] not-italic">{t("ch.verseRef")}</span>
        </p>
      </main>

      {celebration && (
        <CelebrationOverlay
          result={celebration}
          onShare={() => {
            track("challenge_day_shared", { day: celebration.day });
            void nativeShare({
              title: t("ch.name"),
              text: celebration.finished ? t("ch.share.finished") : t("ch.share.day", { day: celebration.day, ref }),
              includeAppLink: true,
            });
          }}
          onDone={() => {
            const r = celebration;
            setCelebration(null);
            setVoyageSeen(r.day);
            if (!isPremium && r.day >= 2 && !r.finished) {
              try { sessionStorage.setItem(CHALLENGE_AD_FLAG, String(Date.now())); } catch { /* storage blocked */ }
            }
            navigate("/challenge", { replace: true });
            if (r.day === 7 || r.finished) setTimeout(() => maybeRequestRating(), 1200);
          }}
        />
      )}
    </div>
  );
}
