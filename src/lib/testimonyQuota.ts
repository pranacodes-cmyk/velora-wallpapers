// ---------------------------------------------------------------------------
// Testimony quota — free users may share ONE clean-ish (watermarked) card.
// After that, the card is still rendered and previewed (they see exactly what
// they'd get) but sharing / HD / lock-screen needs Pro. Effort is free, the
// reward is paid: that's the whole conversion mechanic.
// ---------------------------------------------------------------------------

const KEY = "pb_testimony_shared_v1";

export const FREE_TESTIMONY_SHARES = 1;

export function testimonySharesUsed(): number {
  try {
    return Math.max(0, parseInt(localStorage.getItem(KEY) ?? "0", 10) || 0);
  } catch {
    return 0;
  }
}

export function recordTestimonyShare(): void {
  try {
    localStorage.setItem(KEY, String(testimonySharesUsed() + 1));
  } catch {
    /* quota */
  }
}

export function freeTestimonySharesLeft(): number {
  return Math.max(0, FREE_TESTIMONY_SHARES - testimonySharesUsed());
}
