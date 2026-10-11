// Free-tier rule for the post-chapter Journey AI reflection.
// Free users get Day 1 of EVERY journey free, so they can sample many
// journeys before hitting the paywall. Day 2+ require Premium.
export function canUseJourneyReflection(day: number, isPremium: boolean): boolean {
  if (isPremium) return true;
  return day === 1;
}
