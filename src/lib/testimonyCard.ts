// ---------------------------------------------------------------------------
// Testimony card — the highest-emotion artefact in the app.
//
// When a user marks a prayer as answered we render their own words into a
// share-ready image ("God answered — 14 days"). Free users get one watermarked
// card; Pro removes the watermark, unlocks every card and the lock-screen size.
// Everything is drawn on a local canvas: no network, no AI cost, works offline.
// ---------------------------------------------------------------------------

export type TestimonySize = "card" | "wallpaper";

export interface TestimonyInput {
  /** "GOD ANSWERED" eyebrow (localised). */
  label: string;
  /** The prayer title, in the user's own words. */
  title: string;
  /** What happened (optional). */
  note?: string;
  /** "Answered in 14 days" line (localised, already formatted). */
  meta: string;
  /** A short scripture line. */
  verse?: string;
  /** Footer signature, e.g. "Prayly". */
  footer: string;
  /** Free tier: stamped across the bottom. */
  watermark?: string;
  size?: TestimonySize;
}

const DIMS: Record<TestimonySize, { w: number; h: number }> = {
  card: { w: 1080, h: 1350 },
  wallpaper: { w: 1080, h: 1920 },
};

const FONT = `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", sans-serif`;

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    // Ellipsise the last line if we ran out of room.
    const consumed = lines.join(" ").length;
    if (consumed < text.length - 1) {
      let last = lines[maxLines - 1];
      while (last.length > 4 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

/** Draws the card and returns a PNG data URL. */
export function renderTestimonyCard(input: TestimonyInput): string {
  const { w, h } = DIMS[input.size ?? "card"];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  // --- Background: deep midnight navy with a warm glow behind the cross ---
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#0a1024");
  bg.addColorStop(0.55, "#0d1630");
  bg.addColorStop(1, "#070b18");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w / 2, h * 0.2, 0, w / 2, h * 0.2, w * 0.85);
  glow.addColorStop(0, "rgba(212,175,85,0.30)");
  glow.addColorStop(0.45, "rgba(212,175,85,0.07)");
  glow.addColorStop(1, "rgba(212,175,85,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // --- Gold cross mark ---
  const cx = w / 2;
  const top = h * 0.11;
  ctx.fillStyle = "rgba(230,192,106,0.95)";
  ctx.shadowColor = "rgba(230,192,106,0.55)";
  ctx.shadowBlur = 42;
  ctx.fillRect(cx - 9, top, 18, 122);
  ctx.fillRect(cx - 44, top + 38, 88, 18);
  ctx.shadowBlur = 0;

  // --- Eyebrow ---
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(230,192,106,0.95)";
  ctx.font = `800 34px ${FONT}`;
  const eyebrow = input.label.toUpperCase();
  ctx.letterSpacing = "6px";
  ctx.fillText(eyebrow, cx, top + 214);
  ctx.letterSpacing = "0px";

  // --- Title (their own words) ---
  let y = top + 320;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 74px ${FONT}`;
  const titleLines = wrap(ctx, input.title, w - 200, 4);
  for (const line of titleLines) {
    ctx.fillText(line, cx, y);
    y += 92;
  }

  // --- Divider ---
  y += 26;
  ctx.strokeStyle = "rgba(230,192,106,0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 70, y);
  ctx.lineTo(cx + 70, y);
  ctx.stroke();
  y += 66;

  // --- Answer note ---
  if (input.note?.trim()) {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = `400 44px ${FONT}`;
    for (const line of wrap(ctx, input.note, w - 210, 5)) {
      ctx.fillText(line, cx, y);
      y += 62;
    }
    y += 24;
  }

  // --- Meta ("Answered in 14 days") ---
  ctx.fillStyle = "rgba(230,192,106,0.92)";
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText(input.meta, cx, y);

  // --- Verse near the bottom ---
  const footerY = h - (input.watermark ? 190 : 120);
  if (input.verse?.trim()) {
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = `italic 400 38px ${FONT}`;
    const verseLines = wrap(ctx, input.verse, w - 200, 3);
    let vy = footerY - 60 - (verseLines.length - 1) * 52;
    for (const line of verseLines) {
      ctx.fillText(line, cx, vy);
      vy += 52;
    }
  }

  // --- Footer signature ---
  ctx.fillStyle = "rgba(230,192,106,0.85)";
  ctx.font = `800 34px ${FONT}`;
  ctx.letterSpacing = "3px";
  ctx.fillText(input.footer, cx, footerY);
  ctx.letterSpacing = "0px";

  // --- Free-tier watermark strip ---
  if (input.watermark) {
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(input.watermark, cx, h - 88);
  }

  return canvas.toDataURL("image/png");
}

/** Shares a data-URL image through the OS sheet (native → web → download). */
export async function shareTestimonyImage(
  dataUrl: string,
  opts: { text: string; filename?: string },
): Promise<"shared" | "saved" | "failed"> {
  const filename = opts.filename ?? `testimony-${Date.now()}.png`;
  const base64 = dataUrl.split(",")[1] ?? "";

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const written = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      const { Share } = await import("@capacitor/share");
      await Share.share({ text: opts.text, files: [written.uri], dialogTitle: "Share" });
      return "shared";
    }
  } catch (err: any) {
    if (!String(err?.message ?? "").toLowerCase().includes("cancel")) {
      console.error("testimony native share failed", err);
    } else {
      return "shared";
    }
  }

  // Web Share with a real file, when supported.
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: opts.text });
      return "shared";
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return "saved";
  } catch (err: any) {
    if (err?.name === "AbortError") return "shared";
    console.error("testimony share failed", err);
    return "failed";
  }
}
