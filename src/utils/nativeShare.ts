import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { toast } from "sonner";

export const APP_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.jesuswallpaperbible.app";

interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
  /** Set to false to opt out of auto-appending the app link (rare). */
  includeAppLink?: boolean;
}

/**
 * Always returns a string that ends with the app's Play Store link so every
 * share is also an organic install opportunity.
 */
function withAppLink(text: string | undefined, url: string | undefined): {
  text: string;
  url: string;
} {
  const finalUrl = url || APP_PLAY_STORE_URL;
  const baseText = (text || "").trim();

  // Only skip appending when the link is already IN THE TEXT. Android's
  // share sheet delivers only the text payload to most apps (WhatsApp,
  // Telegram, Messages) and drops the separate `url` field — so the link
  // must live inside the text or it never reaches the recipient.
  const alreadyHasLink = baseText.includes(APP_PLAY_STORE_URL);

  const finalText = alreadyHasLink
    ? baseText
    : baseText
      ? `${baseText}\n\n📲 Get the app: ${APP_PLAY_STORE_URL}`
      : `📲 Get Prayly: Bible Prayer & Verse: ${APP_PLAY_STORE_URL}`;

  return { text: finalText, url: finalUrl };
}

/**
 * Universal share that opens the native Android/iOS share sheet when running
 * inside Capacitor, falls back to Web Share API in mobile browsers, and finally
 * copies to clipboard on desktop browsers. Always includes the app link.
 */
export async function nativeShare(opts: ShareOptions): Promise<void> {
  const {
    title,
    dialogTitle = "Share via",
    includeAppLink = true,
  } = opts;

  const { text, url } = includeAppLink
    ? withAppLink(opts.text, opts.url)
    : { text: opts.text || "", url: opts.url || "" };

  const reportShare = (method: string, status: "shown" | "cancelled" | "failed" | "copied") => {
    import("@/services/analytics").then((a) =>
      a.track("share_invoked", { method, status, title: title || null }),
    ).catch(() => {});
  };

  // Native (Capacitor) — always prefer the OS share sheet
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({ title, text, url, dialogTitle });
      reportShare("native", "shown");
      return;
    } catch (err: any) {
      // User cancelled — silent
      if (err?.message?.toLowerCase().includes("cancel")) {
        reportShare("native", "cancelled");
        return;
      }
      // Fall through to clipboard fallback
    }
  }

  // Web Share API (mobile browsers)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      reportShare("web_share_api", "shown");
      return;
    } catch (err: any) {
      if (err?.name === "AbortError") {
        reportShare("web_share_api", "cancelled");
        return;
      }
    }
  }

  // Clipboard fallback (desktop)
  const composed = [text, url].filter(Boolean).join("\n");
  try {
    await navigator.clipboard.writeText(composed);
    toast.success("Copied to clipboard!");
    reportShare("clipboard", "copied");
  } catch {
    toast.error("Unable to share");
    reportShare("clipboard", "failed");
  }
}


