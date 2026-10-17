export const offeringPlanOrder = ["yearly", "weekly", "monthly", "lifetime"] as const;
export type OfferingPlanId = typeof offeringPlanOrder[number];

export function visibleOfferingPlans(available: Iterable<string>): OfferingPlanId[] {
  const ids = new Set(available);
  return offeringPlanOrder.filter(id => ids.has(id));
}

export function selectedOfferingPlan(available: Iterable<string>, selected?: string): OfferingPlanId | undefined {
  const plans = visibleOfferingPlans(available);
  return plans.find(id => id === selected) ?? plans[0];
}

export function freeTrialPeriod(plan: string, isoPeriod?: string | null, cycles = 1) {
  if (plan === "lifetime" || !isoPeriod || !Number.isInteger(cycles) || cycles < 1) return null;
  const match = /^P(\d+)([DWMY])$/.exec(isoPeriod);
  if (!match || Number(match[1]) < 1) return null;
  const units: Record<string, string> = { D: "day", W: "week", M: "month", Y: "year" };
  return { count: Number(match[1]) * cycles, unit: units[match[2]] };
}