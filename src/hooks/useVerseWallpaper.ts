import { useState, useEffect, useCallback, useRef } from "react";
import { useDailyVerse } from "@/hooks/useDailyVerse";
import { getDefaultBackgroundForToday } from "@/data/verseBackgrounds";

// Match modern iPhone aspect (~9:19.5) so the wallpaper fills the device
// without object-cover cropping the verse on the sides.
const W = 1170;
const H = 2532;

/** Returns the URL of today's auto-rotating background. */
export function getActiveBackgroundUrl(): string {
  return getDefaultBackgroundForToday().url;
}

/** Pick a background based on day-of-year (kept for backwards-compat callers). */
export function getBgForDay(date?: Date): string {
  return getDefaultBackgroundForToday(date).url;
}

/** Small card-size preview of a day's background (for mockups, not wallpapers). */
export function getBgCardForDay(date?: Date): string {
  return getDefaultBackgroundForToday(date).cardUrl;
}

/** Word-wrap text into lines that fit a given pixel width */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Module-level cache so the rendered wallpaper survives Today remounts
// (tab switches). Key = bg URL + verse ref + verse text + scale. Without this,
// every time the user navigates back to "/", the canvas re-renders from scratch
// and shows a blank frame for ~300-800ms on low-end Android WebViews.
const wallpaperCache = new Map<string, string>();

// The on-screen use of this image is a ~200px-wide phone mockup, but we were
// rendering (and JPEG-encoding) the full 1170x2532 wallpaper synchronously on
// every home-screen mount — profiled at ~1s of blocked main thread on a mid
// Android, plus a 12 MB bitmap. Preview now renders at half scale (4x fewer
// pixels); the full-resolution image is only built when the user actually
// downloads or shares it.
const PREVIEW_SCALE = 0.5;

function canvasToObjectUrl(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("wallpaper-encode-failed")); return; }
      resolve(URL.createObjectURL(blob));
    }, "image/jpeg", quality);
  });
}

export function useVerseWallpaper() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { verse } = useDailyVerse();
  const bgSrc = getDefaultBackgroundForToday().url;
  const baseKey = `${bgSrc}|${verse.reference}|${verse.text}`;
  const cacheKey = `${baseKey}|${PREVIEW_SCALE}`;
  const cached = wallpaperCache.get(cacheKey) || null;
  const [dataUrl, setDataUrl] = useState<string | null>(cached);
  const [loading, setLoading] = useState(!cached);

  const draw = useCallback(async (scale: number): Promise<string | null> => {
    const key = `${baseKey}|${scale}`;
    const hit = wallpaperCache.get(key);
    if (hit) return hit;
    const { reportWork } = await import("@/services/perf-attribution");
    const drawStart = performance.now();


    const canvas = scale === PREVIEW_SCALE
      ? (canvasRef.current || document.createElement("canvas"))
      : document.createElement("canvas");
    if (scale === PREVIEW_SCALE) canvasRef.current = canvas;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // All drawing below is authored in full-resolution coordinates.
    if (scale !== 1) ctx.scale(scale, scale);


    // Load background
    const img = new Image();
    img.crossOrigin = "anonymous";

    const backgroundLoaded = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = bgSrc;
    });

    // Draw background
    if (backgroundLoaded) {
      ctx.drawImage(img, 0, 0, W, H);
    } else {
      const fallback = ctx.createLinearGradient(0, 0, 0, H);
      fallback.addColorStop(0, "#070b18");
      fallback.addColorStop(0.45, "#14213f");
      fallback.addColorStop(1, "#090611");
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, W, H);
    }

    // Dark gradient overlay for text readability — strongest in the middle band
    // where the verse sits, with a soft fade so the bottom branding stays clean.
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0.18)");
    grad.addColorStop(0.20, "rgba(0,0,0,0.28)");
    grad.addColorStop(0.38, "rgba(0,0,0,0.55)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.62)");
    grad.addColorStop(0.72, "rgba(0,0,0,0.55)");
    grad.addColorStop(0.88, "rgba(0,0,0,0.40)");
    grad.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // === Safe-area aware vertical layout ===
    // Lock screens reserve top ~22% (clock/date) and bottom ~22% (shortcuts +
    // nav). Push the verse block UP into the upper-middle band so it sits in
    // the cleanest, most-visible zone of the screen.
    const blockCenterY = H * 0.42; // shifted up from 0.50
    const crossY = blockCenterY - 220;

    // Canvas shadow blur is a per-draw gaussian pass and was the second-largest
    // main-thread cost on the home screen. The preview is displayed inside a
    // ~200px phone mockup, so a softer glow is visually identical there — full
    // strength is kept for the real, exported wallpaper.
    const blur = (px: number) => (scale === PREVIEW_SCALE ? Math.round(px * 0.35) : px);

    // Brighter, more saturated gold so it survives system dimming
    const GOLD = "#f5cc6e";
    const GOLD_SOFT = "rgba(245, 204, 110, 1)";
    const GOLD_LINE = "rgba(232, 188, 89, 0.85)";

    // === Elegant cross icon (bigger, brighter, strong glow for lock visibility) ===
    ctx.save();
    ctx.strokeStyle = GOLD;
    ctx.lineCap = "round";
    ctx.lineWidth = 7;
    ctx.shadowColor = "rgba(245, 204, 110, 0.95)";
    ctx.shadowBlur = blur(22);
    const crossH = 72;
    const crossArm = 28;
    const crossArmY = crossY - crossH / 2 + 22;
    // vertical
    ctx.beginPath();
    ctx.moveTo(W / 2, crossY - crossH / 2);
    ctx.lineTo(W / 2, crossY + crossH / 2);
    ctx.stroke();
    // horizontal
    ctx.beginPath();
    ctx.moveTo(W / 2 - crossArm, crossArmY);
    ctx.lineTo(W / 2 + crossArm, crossArmY);
    ctx.stroke();
    ctx.restore();

    // === Date row: hairline — DATE — hairline (clean, professional) ===
    const monthNames = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
    const today = new Date();
    const dateLabel = `${monthNames[today.getMonth()]} ${today.getDate()} · ${today.getFullYear()}`;

    const dateY = crossY + 78;
    ctx.save();
    ctx.font = "700 24px 'Georgia', serif";
    ctx.fillStyle = GOLD_SOFT;
    ctx.textAlign = "center";
    ctx.letterSpacing = "8px";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = blur(16);
    // Visually compensate for letter-spacing pushing text right
    ctx.fillText(dateLabel, W / 2 + 4, dateY);
    const dateMetrics = ctx.measureText(dateLabel);
    ctx.restore();

    // Hairline accents flanking the date
    ctx.save();
    ctx.strokeStyle = GOLD_LINE;
    ctx.lineWidth = 1;
    const halfText = dateMetrics.width / 2 + 24;
    const lineLen = 60;
    ctx.beginPath();
    ctx.moveTo(W / 2 - halfText - lineLen, dateY - 8);
    ctx.lineTo(W / 2 - halfText, dateY - 8);
    ctx.moveTo(W / 2 + halfText, dateY - 8);
    ctx.lineTo(W / 2 + halfText + lineLen, dateY - 8);
    ctx.stroke();
    ctx.restore();

    // === Verse text (elegant serif, centered, BOLDER for impact) ===
    const maxTextWidth = W - 140;
    const fontSize = 64;
    const lineHeight = fontSize * 1.45;

    ctx.save();
    ctx.font = `italic 600 ${fontSize}px 'Georgia', 'Times New Roman', serif`;
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = blur(32);
    ctx.shadowOffsetY = 5;

    const verseText = `"${verse.text}"`;
    const lines = wrapText(ctx, verseText, maxTextWidth);
    const totalTextH = lines.length * lineHeight;
    const textStartY = dateY + 100;

    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, textStartY + i * lineHeight);
    });
    ctx.restore();


    // === Reference ===
    ctx.save();
    ctx.font = "bold 28px 'Georgia', serif";
    ctx.fillStyle = GOLD;
    ctx.textAlign = "center";
    ctx.letterSpacing = "5px";
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = blur(14);
    ctx.fillText(
      `— ${verse.reference.toUpperCase()}`,
      W / 2 + 3,
      textStartY + totalTextH + 44
    );
    ctx.restore();

    // === App branding footer (elegant, restrained) ===
    // Sits in the bottom safe zone so it never crowds the verse but still
    // attributes every shared image back to Prayly.
    const brandY = H - 180;

    // Soft gold divider above the brand mark
    ctx.save();
    const divGrad = ctx.createLinearGradient(W / 2 - 140, 0, W / 2 + 140, 0);
    divGrad.addColorStop(0, "rgba(245,204,110,0)");
    divGrad.addColorStop(0.5, "rgba(245,204,110,0.85)");
    divGrad.addColorStop(1, "rgba(245,204,110,0)");
    ctx.fillStyle = divGrad;
    ctx.fillRect(W / 2 - 140, brandY - 46, 280, 1.5);
    ctx.restore();

    // Tiny cross glyph before the wordmark
    ctx.save();
    ctx.strokeStyle = GOLD;
    ctx.lineCap = "round";
    ctx.lineWidth = 3.5;
    ctx.shadowColor = "rgba(245,204,110,0.85)";
    ctx.shadowBlur = blur(12);
    const bcx = W / 2;
    const bcy = brandY;
    ctx.beginPath();
    ctx.moveTo(bcx, bcy - 18);
    ctx.lineTo(bcx, bcy + 12);
    ctx.moveTo(bcx - 9, bcy - 9);
    ctx.lineTo(bcx + 9, bcy - 9);
    ctx.stroke();
    ctx.restore();

    // Wordmark
    ctx.save();
    ctx.font = "700 36px 'Georgia', serif";
    ctx.fillStyle = GOLD_SOFT;
    ctx.textAlign = "center";
    ctx.letterSpacing = "6px";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = blur(16);
    ctx.fillText("PRAYLY", W / 2 + 3, brandY + 52);
    ctx.restore();

    // Tagline
    ctx.save();
    ctx.font = "500 20px 'Georgia', serif";
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.textAlign = "center";
    ctx.letterSpacing = "4px";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = blur(12);
    ctx.fillText("BIBLE PRAYER & VERSE", W / 2 + 2, brandY + 86);
    ctx.restore();



    // toDataURL performs JPEG encoding synchronously on the UI thread. Preview
    // encoding uses toBlob so taps/scroll remain responsive; full resolution is
    // still generated only after an explicit share/download action.
    const url = scale === PREVIEW_SCALE
      ? await canvasToObjectUrl(canvas, 0.85)
      : canvas.toDataURL("image/jpeg", 0.92);
    wallpaperCache.set(key, url);
    reportWork("wallpaper_canvas_draw", performance.now() - drawStart, {
      scale,
      canvas_px: canvas.width * canvas.height,
    });
    return url;
  }, [bgSrc, verse, baseKey]);

  // Render the preview after the home screen has painted, never during it.
  useEffect(() => {
    let cancelled = false;
    const hit = wallpaperCache.get(cacheKey);
    if (hit) {
      setDataUrl(hit);
      setLoading(false);
      return;
    }
    setLoading(true);
    const run = () => {
      draw(PREVIEW_SCALE).then((url) => {
        if (cancelled) return;
        if (url) setDataUrl(url);
        setLoading(false);
      }).catch(() => { if (!cancelled) setLoading(false); });
    };
    const ric = (window as any).requestIdleCallback;
    const handle = ric ? ric(run, { timeout: 1500 }) : window.setTimeout(run, 350);
    return () => {
      cancelled = true;
      if (ric && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(handle);
      else window.clearTimeout(handle as number);
    };
  }, [draw, cacheKey]);

  /** Full-resolution wallpaper — built on demand for download / share. */
  const getFullResUrl = useCallback(async () => (await draw(1)) || dataUrl, [draw, dataUrl]);

  const download = useCallback(async () => {
    const full = await getFullResUrl();
    if (!full) return;
    const a = document.createElement("a");
    a.href = full;
    a.download = `daily-verse-${verse.reference.replace(/\s/g, "-")}.jpg`;
    a.click();
  }, [getFullResUrl, verse]);


  const share = useCallback(async () => {
    // Share the full-resolution image (built on demand — the on-screen preview
    // is half-scale to keep the home screen fast).
    const shareUrl = await getFullResUrl();
    if (!shareUrl) return;
    const caption = `"${verse.text}" — ${verse.reference} ✝️\n\n📲 Get Prayly: Bible Prayer & Verse: https://play.google.com/store/apps/details?id=com.jesuswallpaperbible.app`;

    const { Capacitor } = await import("@capacitor/core");

    // Native (Capacitor): write the JPEG to cache, then share the file via the
    // OS share sheet. The plain Web Share API doesn't exist inside Android
    // WebView, which is why our previous implementation silently fell through
    // to the clipboard fallback.
    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        // shareUrl is "data:image/jpeg;base64,XXXX" — strip the prefix
        const base64 = shareUrl.split(",")[1];
        const fileName = `daily-verse-${Date.now()}.jpg`;
        const written = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: "Daily Bible Verse",
          text: caption,
          url: written.uri, // file:// URI — Android share sheet will attach the image
          dialogTitle: "Share today's verse",
        });
        return;
      } catch (err: any) {
        if (err?.message?.toLowerCase?.().includes("cancel")) return;
        // Fall through to web/clipboard fallback below
      }
    }

    // Web fallback: try Web Share API with files, then text-only, then clipboard.
    try {
      const blob = await (await fetch(shareUrl)).blob();
      const file = new File([blob], "daily-verse.jpg", { type: "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ text: caption, files: [file] });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text: caption });
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
    try { await navigator.clipboard?.writeText(caption); } catch {}
  }, [getFullResUrl, verse]);

  return { dataUrl, loading, verse, download, share, bgSrc };
}
