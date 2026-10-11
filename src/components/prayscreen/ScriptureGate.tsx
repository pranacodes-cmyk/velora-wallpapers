import { useEffect, useState } from "react";
import { BookOpen, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { loadPassage, markRead, refOf, type BibleVerse } from "@/services/bibleGate";

/**
 * Pro Sacred Pause: one KJV verse at a time, continuing where the user left
 * off. "Continue" is always available — reading is invited, never forced.
 * `preview` shows the same screen to free users with a Pro call to action.
 */
export function ScriptureGate({ preview = false, onDone, onUpgrade }: { preview?: boolean; onDone: () => void; onUpgrade?: () => void }) {
  const [verses, setVerses] = useState<BibleVerse[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    loadPassage().then((v) => {
      setVerses(v);
      if (v[0]) track("scripture_gate_shown", { reference: refOf(v[0]), preview });
    });
  }, [preview]);

  const verse = verses?.[index];
  const total = verses?.length ?? 0;
  const last = index >= total - 1;

  const finish = () => {
    if (verses?.length && !preview) {
      markRead(verses[index].id, index + 1);
      track("scripture_gate_completed", { from: refOf(verses[0]), to: refOf(verses[index]), verses_read: index + 1 });
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[200] flex animate-in fade-in duration-300 flex-col bg-background bg-[radial-gradient(circle_at_50%_18%,hsl(var(--primary)/0.16),transparent_70%)] px-7 pb-6 pt-[max(env(safe-area-inset-top),20px)]">
      <div className="flex items-center justify-center gap-1.5 pt-2 text-[10px] font-black uppercase tracking-[0.16em] text-primary">
        <BookOpen className="h-3.5 w-3.5" /> English Bible · KJV
        {preview && <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[8.5px] text-primary-foreground">PRO</span>}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto text-center">
        {!verse ? (
          <p className="text-sm text-foreground/60">{verses ? "Scripture needs a connection the first time." : "Opening Scripture…"}</p>
        ) : (
          <div key={verse.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">{refOf(verse)}</p>
            <p className="mt-5 font-serif text-[27px] font-bold leading-[1.3]">“{verse.text}”</p>
            <div className="mt-7 flex justify-center gap-1.5">
              {verses!.map((v, i) => <span key={v.id} className={`h-1.5 rounded-full transition-all ${i <= index ? "w-5 bg-primary" : "w-1.5 bg-primary/25"}`} />)}
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {verse && !last && (
          <Button onClick={() => { haptic("light"); setIndex((i) => i + 1); }} className="h-14 w-full rounded-full text-[14.5px] font-black">Next verse</Button>
        )}
        {preview && onUpgrade && last && (
          <Button onClick={onUpgrade} className="h-14 w-full rounded-full text-[14.5px] font-black"><Crown /> Read the whole Bible with Pro</Button>
        )}
        <Button variant={verse && !last ? "ghost" : preview ? "ghost" : "default"} onClick={finish} className="h-12 w-full rounded-full text-[13px] font-black">
          {preview ? "Close preview" : "I’ve read this · Continue"}
        </Button>
      </div>
    </div>
  );
}
