/**
 * Bible reader interstitial pacing for free users.
 * One ad after every VERSES_PER_AD distinct verses read, or when a chapter
 * is finished (Next chapter). Always routed through the global 45s cooldown.
 */
import { tryShowInterstitial } from "@/services/ad-cooldown";

const VERSES_PER_AD = 18;
const KEY = "prayly_bible_ad_count_v1";

function read(): number {
  try { return Number(localStorage.getItem(KEY) || 0); } catch { return 0; }
}
function write(n: number) {
  try { localStorage.setItem(KEY, String(n)); } catch { /* ignore */ }
}

export function recordBibleVerseView(isPremium: boolean) {
  if (isPremium) return;
  const n = read() + 1;
  if (n >= VERSES_PER_AD) {
    void tryShowInterstitial("bible_verses").then((shown) => write(shown ? 0 : n));
  } else write(n);
}

export function recordBibleChapterDone(isPremium: boolean) {
  if (isPremium) return;
  void tryShowInterstitial("bible_chapter").then((shown) => { if (shown) write(0); });
}
