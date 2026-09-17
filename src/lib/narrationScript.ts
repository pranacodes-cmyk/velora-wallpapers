// Shared narration script composer.
// Used by both the client (NarrationPlayer) and the bulk pre-gen script so
// the text sent to ElevenLabs — and therefore the cached MP3 — stays identical
// across surfaces. If you change rules here, all cached audio becomes stale.
import type { RichDay } from "@/data/journeyRichContent";

export function composeNarrationScript(rich: RichDay): string {
  const parts: string[] = [];

  rich.slides.forEach((s, idx) => {
    if (idx > 0) parts.push(""); // paragraph break

    if (s.kind === "verse" && s.verse) {
      const ref = s.reference
        ? s.reference
            .replace(/(\d+):(\d+)/, "chapter $1, verse $2")
            .replace(/^(\w+)\s+(chapter)/, "$1, $2")
        : "scripture";
      parts.push(s.title);
      parts.push("");
      parts.push(`From ${ref}…`);
      parts.push("");
      parts.push(`"${s.verse}"`);
      parts.push("");
      parts.push(...(s.paragraphs ?? []));
      return;
    }

    if (s.kind === "pray") {
      if (s.title) parts.push(s.title);
      parts.push("");
      if (s.breathPrayer) {
        parts.push(
          `Breathe in… ${s.breathPrayer.inhale}. Breathe out… ${s.breathPrayer.exhale}.`,
        );
        parts.push("");
      }
      parts.push(...(s.paragraphs ?? []));
      if (s.prayer) {
        parts.push("");
        const softened = s.prayer
          .replace(/^(Lord|Jesus|Father|God)([,.])/i, "$1,$2")
          .replace(/(Lord|Jesus|Father|God),/gi, "$1,");
        parts.push(softened);
      }
      return;
    }

    parts.push(s.title);
    parts.push("");
    parts.push(...(s.paragraphs ?? []));
  });

  return parts
    .map((p) => p.trim())
    .filter((_, i, arr) => !(arr[i] === "" && arr[i - 1] === ""))
    .join("\n\n");
}

// Per-slide cumulative character ratio (0..1) within the composed script.
// Used by the player to auto-advance slides as the voice progresses.
export function narrationSlideBoundaries(rich: RichDay): number[] {
  const lens = rich.slides.map((s) => {
    const parts: string[] = [s.title];
    if (s.kind === "verse" && s.verse) parts.push(s.verse, s.reference ?? "");
    if (s.breathPrayer) parts.push(s.breathPrayer.inhale, s.breathPrayer.exhale);
    parts.push(...(s.paragraphs ?? []));
    if (s.prayer) parts.push(s.prayer);
    return parts.join(" ").length;
  });
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const cum: number[] = [];
  let acc = 0;
  for (const l of lens) {
    acc += l;
    cum.push(acc / total);
  }
  return cum;
}
