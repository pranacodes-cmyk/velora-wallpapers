import { useT } from "@/i18n";
import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { listBooksWithCounts, QUIZ_PACKS, getPackSize } from "@/data/quizPacks";
import { getBookMastery } from "@/hooks/useQuiz";
import { BookOpen, Crown } from "lucide-react";
import { haptic } from "@/utils/haptics";

type Kind = "book" | "pack" | null;

interface Props {
  open: boolean;
  kind: Kind;
  onClose: () => void;
  onPickBook: (book: string) => void;
  onPickPack: (packId: string) => void;
}

export function ProQuizPicker({ open, kind, onClose, onPickBook, onPickPack }: Props) {
  const { t } = useT();
  const books = useMemo(() => (kind === "book" ? listBooksWithCounts(4) : []), [kind]);
  const mastery = useMemo(() => (kind === "book" ? getBookMastery() : {}), [kind, open]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-h-[85vh] overflow-y-auto p-0 border-t"
        style={{ background: "hsl(var(--background))" }}
      >
        <SheetHeader className="px-5 pt-5 pb-3 sticky top-0 z-10"
          style={{
            background: "hsl(var(--nav-blur))",
            backdropFilter: "blur(20px) saturate(1.5)",
            borderBottom: "1px solid hsl(var(--glass-border))",
          }}
        >
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4" style={{ color: "hsl(42 85% 52%)" }} />
            <SheetTitle className="text-base font-black text-foreground">
              {kind === "book" ? t("quiz.picker.book.title") : t("quiz.picker.pack.title")}
            </SheetTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-left">
            {kind === "book"
              ? t("quiz.picker.book.desc")
              : t("quiz.picker.pack.desc")}
          </p>
        </SheetHeader>

        <div className="px-4 py-4 grid grid-cols-1 gap-2">
          {kind === "book" && books.map((b) => {
            const best = mastery[b.book] || 0;
            const mastered = best >= 3000; // arbitrary threshold for "mastered" crown
            return (
              <button
                key={b.book}
                onClick={() => { haptic("soft"); onPickBook(b.book); }}
                className="flex items-center gap-3 p-3.5 rounded-2xl text-left active:scale-[0.98] transition-transform"
                style={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--glass-border))",
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: mastered
                      ? "linear-gradient(135deg, hsl(42 85% 52%), hsl(35 90% 55%))"
                      : "hsl(var(--primary) / 0.12)",
                  }}
                >
                  {mastered
                    ? <Crown className="w-5 h-5 text-white" />
                    : <BookOpen className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground truncate">{b.book}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: b.testament === "Old" ? "hsl(35 60% 50% / 0.15)" : "hsl(210 80% 55% / 0.15)",
                        color: b.testament === "Old" ? "hsl(35 80% 50%)" : "hsl(210 80% 60%)",
                      }}
                    >
                      {b.testament === "Old" ? t("quiz.picker.ot") : t("quiz.picker.nt")}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {t("quiz.picker.questions", { count: b.count })} · {t("quiz.picker.best", { score: best > 0 ? best.toLocaleString() : "—" })}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">›</span>
              </button>
            );
          })}

          {kind === "pack" && QUIZ_PACKS.map((p) => {
            const size = getPackSize(p.id);
            return (
              <button
                key={p.id}
                onClick={() => { haptic("soft"); onPickPack(p.id); }}
                disabled={size < 5}
                className="flex items-center gap-3 p-3.5 rounded-2xl text-left active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--glass-border))",
                }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--accent) / 0.12))",
                  }}
                >
                  {p.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-foreground truncate">{p.title}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                    {p.description}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">›</span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
