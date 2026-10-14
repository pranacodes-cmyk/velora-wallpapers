import { useSyncExternalStore } from "react";
import { getProJourneysSnapshot, subscribeProJourneys } from "@/services/proJourneys";

/** Re-renders whenever Pro Journey progress, the prayer list or the battle plan changes. */
export function useProJourneys() {
  return useSyncExternalStore(subscribeProJourneys, getProJourneysSnapshot, getProJourneysSnapshot);
}
